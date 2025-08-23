import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { IncomesService } from '../incomes/incomes.service';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { UserRole, TransactionType } from '@prisma/client';
import * as Papa from 'papaparse';
import * as crypto from 'crypto';

export interface AuthContext {
  userId: string;
  householdId: string;
  role: UserRole;
}

export interface FieldMapping {
  csvField: string;
  systemField: string;
  required: boolean;
  defaultValue?: any;
  transform?: 'date' | 'number' | 'string' | 'boolean' | 'enum';
  enumValues?: string[];
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  sampleData: any[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface ImportResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  duplicates: number;
  errors: ImportError[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
  dateFormat?: string;
  includeHeaders?: boolean;
  fields?: string[];
}

@Injectable()
export class CsvService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly incomesService: IncomesService,
    private readonly actorsService: ActorsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // Transaction Import/Export
  async previewTransactionImport(
    csvData: string,
    fieldMapping: FieldMapping[],
    authContext: AuthContext,
  ): Promise<ImportPreview> {
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for validation
    });

    if (parsed.errors.length > 0) {
      throw new BadRequestException('CSV parsing failed: ' + parsed.errors.map(e => e.message).join(', '));
    }

    const preview: ImportPreview = {
      totalRows: parsed.data.length,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      sampleData: [],
      errors: [],
      warnings: [],
    };

    const duplicateHashes = new Set<string>();
    
    // Check for existing duplicates in database
    const existingHashes = await this.getExistingTransactionHashes(authContext);

    for (let i = 0; i < Math.min(parsed.data.length, 1000); i++) { // Preview first 1000 rows
      const row = parsed.data[i] as any;
      const rowNumber = i + 2; // +2 for header and 1-based indexing
      
      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateTransactionRow(mappedData, authContext);
        
        if (validationResult.isValid) {
          preview.validRows++;
          
          // Check for duplicates
          const sourceHash = this.generateTransactionHash(mappedData);
          if (existingHashes.has(sourceHash) || duplicateHashes.has(sourceHash)) {
            preview.duplicateRows++;
            preview.warnings.push({
              row: rowNumber,
              field: 'duplicate',
              value: sourceHash,
              message: 'Duplicate transaction detected',
            });
          } else {
            duplicateHashes.add(sourceHash);
          }
          
          if (preview.sampleData.length < 5) {
            preview.sampleData.push(mappedData);
          }
        } else {
          preview.invalidRows++;
          preview.errors.push(...validationResult.errors.map(error => ({
            ...error,
            row: rowNumber,
          })));
        }
      } catch (error) {
        preview.invalidRows++;
        preview.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message: error.message || 'Unknown error occurred',
        });
      }
    }

    return preview;
  }

  async importTransactions(
    csvData: string,
    fieldMapping: FieldMapping[],
    authContext: AuthContext,
    skipDuplicates: boolean = true,
  ): Promise<ImportResult> {
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0) {
      throw new BadRequestException('CSV parsing failed: ' + parsed.errors.map(e => e.message).join(', '));
    }

    const result: ImportResult = {
      totalProcessed: parsed.data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    const existingHashes = await this.getExistingTransactionHashes(authContext);
    const processedHashes = new Set<string>();

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as any;
      const rowNumber = i + 2;
      
      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateTransactionRow(mappedData, authContext);
        
        if (!validationResult.isValid) {
          result.failed++;
          result.errors.push(...validationResult.errors.map(error => ({
            ...error,
            row: rowNumber,
          })));
          continue;
        }

        const sourceHash = this.generateTransactionHash(mappedData);
        
        if (existingHashes.has(sourceHash) || processedHashes.has(sourceHash)) {
          result.duplicates++;
          if (!skipDuplicates) {
            result.errors.push({
              row: rowNumber,
              field: 'duplicate',
              value: sourceHash,
              message: 'Duplicate transaction',
            });
          }
          continue;
        }

        // Create transaction
        await this.transactionsService.create({
          ...mappedData,
          sourceHash,
        }, authContext);

        result.successful++;
        processedHashes.add(sourceHash);

      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message: error.message || 'Failed to create transaction',
        });
      }
    }

    return result;
  }

  async exportTransactions(
    filters: any,
    options: ExportOptions,
    authContext: AuthContext,
  ): Promise<string> {
    const transactions = await this.transactionsService.findAll(filters, authContext);

    const exportData = transactions.map(transaction => ({
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      date: this.formatDate(transaction.date, options.dateFormat),
      category: transaction.category.name,
      categoryId: transaction.categoryId,
      actor: transaction.actor.name,
      actorId: transaction.actorId,
      tags: transaction.tags.join(';'),
      notes: transaction.notes || '',
      shouldPay: transaction.shouldPay,
      createdAt: this.formatDate(transaction.createdAt, options.dateFormat),
    }));

    if (options.format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    return Papa.unparse(exportData, {
      header: options.includeHeaders !== false,
    });
  }

  // Income Import/Export
  async importIncomes(
    csvData: string,
    fieldMapping: FieldMapping[],
    authContext: AuthContext,
    skipDuplicates: boolean = true,
  ): Promise<ImportResult> {
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0) {
      throw new BadRequestException('CSV parsing failed: ' + parsed.errors.map(e => e.message).join(', '));
    }

    const result: ImportResult = {
      totalProcessed: parsed.data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as any;
      const rowNumber = i + 2;
      
      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateIncomeRow(mappedData, authContext);
        
        if (!validationResult.isValid) {
          result.failed++;
          result.errors.push(...validationResult.errors.map(error => ({
            ...error,
            row: rowNumber,
          })));
          continue;
        }

        // Check for existing income for same user/year/month
        const existingIncome = await this.incomesService.findByUserAndMonth(
          mappedData.userId,
          mappedData.year,
          mappedData.month,
          authContext,
        );

        if (existingIncome) {
          result.duplicates++;
          if (!skipDuplicates) {
            result.errors.push({
              row: rowNumber,
              field: 'duplicate',
              value: `${mappedData.userId}-${mappedData.year}-${mappedData.month}`,
              message: 'Income for this user/month already exists',
            });
          }
          continue;
        }

        // Create income
        await this.incomesService.create(mappedData, authContext);
        result.successful++;

      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message: error.message || 'Failed to create income',
        });
      }
    }

    return result;
  }

  async exportIncomes(
    filters: any,
    options: ExportOptions,
    authContext: AuthContext,
  ): Promise<string> {
    const incomes = await this.incomesService.findAll(filters, authContext);

    const exportData = incomes.map(income => ({
      id: income.id,
      userId: income.userId,
      userName: income.user.name,
      userEmail: income.user.email,
      grossIncomeYen: income.grossIncomeYen,
      deductionYen: income.deductionYen,
      allocatableYen: income.allocatableYen,
      year: income.year,
      month: income.month,
      description: income.description || '',
      sourceDocument: income.sourceDocument || '',
      createdAt: this.formatDate(income.createdAt, options.dateFormat),
    }));

    if (options.format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    return Papa.unparse(exportData, {
      header: options.includeHeaders !== false,
    });
  }

  // Utility methods
  private mapRowData(row: any, fieldMapping: FieldMapping[]): any {
    const mappedData: any = {};

    for (const mapping of fieldMapping) {
      const csvValue = row[mapping.csvField];
      let systemValue = csvValue;

      // Use default value if CSV field is empty/missing
      if (!csvValue && mapping.defaultValue !== undefined) {
        systemValue = mapping.defaultValue;
      }

      // Apply transformations
      if (systemValue && mapping.transform) {
        systemValue = this.transformValue(systemValue, mapping.transform, mapping.enumValues);
      }

      // Validate required fields
      if (mapping.required && (!systemValue && systemValue !== 0)) {
        throw new BadRequestException(`Required field '${mapping.systemField}' is missing`);
      }

      mappedData[mapping.systemField] = systemValue;
    }

    return mappedData;
  }

  private transformValue(value: any, transform: string, enumValues?: string[]): any {
    switch (transform) {
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date format: ${value}`);
        }
        return date;

      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new BadRequestException(`Invalid number format: ${value}`);
        }
        return num;

      case 'boolean':
        return ['true', '1', 'yes', 'y'].includes(value.toString().toLowerCase());

      case 'enum':
        if (enumValues && !enumValues.includes(value)) {
          throw new BadRequestException(`Invalid enum value: ${value}. Must be one of: ${enumValues.join(', ')}`);
        }
        return value;

      case 'string':
      default:
        return value.toString();
    }
  }

  private async validateTransactionRow(data: any, authContext: AuthContext): Promise<{
    isValid: boolean;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];

    // Validate amount
    if (!Number.isInteger(data.amount) || data.amount === 0) {
      errors.push({
        row: 0,
        field: 'amount',
        value: data.amount,
        message: 'Amount must be a non-zero integer',
      });
    }

    // Validate type and amount consistency
    if (data.type === TransactionType.income && data.amount < 0) {
      errors.push({
        row: 0,
        field: 'type',
        value: data.type,
        message: 'Income transactions must have positive amounts',
      });
    } else if (data.type === TransactionType.expense && data.amount > 0) {
      errors.push({
        row: 0,
        field: 'type',
        value: data.type,
        message: 'Expense transactions must have negative amounts',
      });
    }

    // Validate category exists
    try {
      await this.categoriesService.findOne(data.categoryId, authContext);
    } catch (error) {
      errors.push({
        row: 0,
        field: 'categoryId',
        value: data.categoryId,
        message: 'Category not found',
      });
    }

    // Validate actor exists
    try {
      await this.actorsService.findOne(data.actorId, authContext);
    } catch (error) {
      errors.push({
        row: 0,
        field: 'actorId',
        value: data.actorId,
        message: 'Actor not found',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validateIncomeRow(data: any, authContext: AuthContext): Promise<{
    isValid: boolean;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];

    // Validate amounts
    if (!Number.isInteger(data.grossIncomeYen) || data.grossIncomeYen < 0) {
      errors.push({
        row: 0,
        field: 'grossIncomeYen',
        value: data.grossIncomeYen,
        message: 'Gross income must be a non-negative integer',
      });
    }

    if (!Number.isInteger(data.deductionYen) || data.deductionYen < 0) {
      errors.push({
        row: 0,
        field: 'deductionYen',
        value: data.deductionYen,
        message: 'Deduction must be a non-negative integer',
      });
    }

    if (data.deductionYen > data.grossIncomeYen) {
      errors.push({
        row: 0,
        field: 'deductionYen',
        value: data.deductionYen,
        message: 'Deduction cannot exceed gross income',
      });
    }

    // Validate year and month
    const currentYear = new Date().getFullYear();
    if (data.year < 1900 || data.year > currentYear + 5) {
      errors.push({
        row: 0,
        field: 'year',
        value: data.year,
        message: `Year must be between 1900 and ${currentYear + 5}`,
      });
    }

    if (data.month < 1 || data.month > 12) {
      errors.push({
        row: 0,
        field: 'month',
        value: data.month,
        message: 'Month must be between 1 and 12',
      });
    }

    // Validate user exists
    const user = await this.prismaService.prisma.user.findFirst({
      where: {
        id: data.userId,
        householdId: authContext.householdId,
        deletedAt: null,
      },
    });

    if (!user) {
      errors.push({
        row: 0,
        field: 'userId',
        value: data.userId,
        message: 'User not found or does not belong to household',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async getExistingTransactionHashes(authContext: AuthContext): Promise<Set<string>> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const transactions = await prisma.transaction.findMany({
        where: {
          householdId: authContext.householdId,
          sourceHash: { not: null },
        },
        select: { sourceHash: true },
      });

      return new Set(transactions.map(t => t.sourceHash).filter(Boolean));
    });
  }

  private generateTransactionHash(data: any): string {
    const hashInput = `${data.amount}-${data.date.toISOString()}-${data.description}-${data.actorId}-${data.categoryId}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private formatDate(date: Date, format?: string): string {
    if (!format) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // Simple format mapping
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'us':
        return date.toLocaleDateString('en-US');
      case 'eu':
        return date.toLocaleDateString('en-GB');
      default:
        return date.toISOString().split('T')[0];
    }
  }
}