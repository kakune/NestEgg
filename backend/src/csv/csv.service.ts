import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransactionsService,
  CreateTransactionDto,
} from '../transactions/transactions.service';
import { IncomesService, CreateIncomeDto } from '../incomes/incomes.service';
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

// Interface for CSV row data
interface CsvRow {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// Interface for mapped row data
interface MappedRowData {
  amount?: string;
  description?: string;
  date?: string;
  category?: string;
  actor?: string;
  type?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export interface FieldMapping {
  csvField: string;
  systemField: string;
  required: boolean;
  defaultValue?: string | number | boolean | null;
  transform?: 'date' | 'number' | 'string' | 'boolean' | 'enum';
  enumValues?: string[];
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  sampleData: Record<string, string>[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  value: string | number | boolean | null;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  value: string | number | boolean | null;
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
      throw new BadRequestException(
        'CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '),
      );
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

    for (let i = 0; i < Math.min(parsed.data.length, 1000); i++) {
      // Preview first 1000 rows
      const row = parsed.data[i] as CsvRow;
      const rowNumber = i + 2; // +2 for header and 1-based indexing

      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateTransactionRow(
          mappedData,
          authContext,
        );

        if (validationResult.isValid) {
          preview.validRows++;

          // Check for duplicates
          const sourceHash = this.generateTransactionHash(mappedData);
          if (
            existingHashes.has(sourceHash) ||
            duplicateHashes.has(sourceHash)
          ) {
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
          preview.errors.push(
            ...validationResult.errors.map((error) => ({
              ...error,
              row: rowNumber,
            })),
          );
        }
      } catch (error: unknown) {
        preview.invalidRows++;
        preview.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
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
      throw new BadRequestException(
        'CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '),
      );
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
    const validTransactions: CreateTransactionDto[] = [];

    // First pass: validate and prepare all transactions
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as CsvRow;
      const rowNumber = i + 2;

      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateTransactionRow(
          mappedData,
          authContext,
        );

        if (!validationResult.isValid) {
          result.failed++;
          result.errors.push(
            ...validationResult.errors.map((error) => ({
              ...error,
              row: rowNumber,
            })),
          );
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

        validTransactions.push({
          ...mappedData,
          sourceHash,
        } as CreateTransactionDto);
        processedHashes.add(sourceHash);
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to validate transaction',
        });
      }
    }

    // Second pass: bulk create valid transactions
    if (validTransactions.length > 0) {
      const bulkResult = await this.transactionsService.createMany(
        validTransactions,
        authContext,
      );
      result.successful = bulkResult.count;

      // Add any bulk creation errors to the result
      for (const error of bulkResult.errors) {
        result.failed++;
        result.errors.push({
          row: 0, // We can't map back to specific row after bulk operation
          field: 'general',
          value: '',
          message: error.error,
        });
      }
    }

    return result;
  }

  async exportTransactions(
    filters: Record<string, unknown>,
    options: ExportOptions,
    authContext: AuthContext,
  ): Promise<string> {
    const transactions = await this.transactionsService.findAll(
      filters,
      authContext,
    );

    const exportData = transactions.map((transaction) => ({
      id: transaction.id,
      amount: Number(transaction.amount),
      type: transaction.type,
      description: String(transaction.description),
      date: this.formatDate(
        new Date(String(transaction.date)),
        String(options.dateFormat),
      ),
      category: transaction.category.name,
      categoryId: transaction.categoryId,
      actor: transaction.actor.name,
      actorId: String(transaction.actorId),
      tags: transaction.tags.join(';'),
      notes: String(transaction.notes || ''),
      shouldPay: transaction.shouldPay,
      createdAt: this.formatDate(
        transaction.createdAt,
        String(options.dateFormat),
      ),
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
      throw new BadRequestException(
        'CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '),
      );
    }

    const result: ImportResult = {
      totalProcessed: parsed.data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    const validIncomes: CreateIncomeDto[] = [];
    const processedKeys = new Set<string>();

    // Get all existing incomes for the household to check duplicates efficiently
    const existingIncomes = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.income.findMany({
          where: {
            householdId: authContext.householdId,
            deletedAt: null,
          },
          select: {
            userId: true,
            year: true,
            month: true,
          },
        });
      },
    );

    const existingKeys = new Set(
      existingIncomes.map(
        (income) =>
          `${income.userId}-${String(income.year)}-${String(income.month)}`,
      ),
    );

    // First pass: validate and prepare all incomes
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as CsvRow;
      const rowNumber = i + 2;

      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateIncomeRow(
          mappedData,
          authContext,
        );

        if (!validationResult.isValid) {
          result.failed++;
          result.errors.push(
            ...validationResult.errors.map((error) => ({
              ...error,
              row: rowNumber,
            })),
          );
          continue;
        }

        const incomeKey = `${mappedData.userId}-${mappedData.year}-${mappedData.month}`;

        if (existingKeys.has(incomeKey) || processedKeys.has(incomeKey)) {
          result.duplicates++;
          if (!skipDuplicates) {
            result.errors.push({
              row: rowNumber,
              field: 'duplicate',
              value: incomeKey,
              message: 'Income for this user/month already exists',
            });
          }
          continue;
        }

        validIncomes.push(mappedData as CreateIncomeDto);
        processedKeys.add(incomeKey);
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          field: 'general',
          value: '',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to validate income',
        });
      }
    }

    // Second pass: bulk create valid incomes
    if (validIncomes.length > 0) {
      const bulkResult = await this.incomesService.createMany(
        validIncomes,
        authContext,
      );
      result.successful = bulkResult.count;

      // Add any bulk creation errors to the result
      for (const error of bulkResult.errors) {
        result.failed++;
        result.errors.push({
          row: 0, // We can't map back to specific row after bulk operation
          field: 'general',
          value: '',
          message: error.error,
        });
      }
    }

    return result;
  }

  async exportIncomes(
    filters: Record<string, unknown>,
    options: ExportOptions,
    authContext: AuthContext,
  ): Promise<string> {
    const incomes = await this.incomesService.findAll(filters, authContext);

    const exportData = incomes.map((income) => ({
      id: income.id,
      userId: income.userId,
      userName: income.user.name,
      userEmail: income.user.email,
      grossIncomeYen: Number(income.grossIncomeYen),
      deductionYen: Number(income.deductionYen),
      allocatableYen: Number(income.allocatableYen),
      year: Number(income.year),
      month: Number(income.month),
      description: String(income.description || ''),
      sourceDocument: String(income.sourceDocument || ''),
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
  private mapRowData(row: CsvRow, fieldMapping: FieldMapping[]): MappedRowData {
    const mappedData: MappedRowData = {};

    for (const mapping of fieldMapping) {
      const csvValue = row[mapping.csvField];
      let systemValue = csvValue;

      // Use default value if CSV field is empty/missing
      if (!csvValue && mapping.defaultValue !== undefined) {
        systemValue = mapping.defaultValue;
      }

      // Apply transformations
      if (systemValue && mapping.transform) {
        systemValue = this.transformValue(
          systemValue,
          mapping.transform,
          mapping.enumValues,
        );
      }

      // Validate required fields
      if (mapping.required && !systemValue && systemValue !== 0) {
        throw new BadRequestException(
          `Required field '${mapping.systemField}' is missing`,
        );
      }

      mappedData[mapping.systemField] = systemValue;
    }

    return mappedData;
  }

  private transformValue(
    value: string | number | boolean | null,
    transform: string,
    enumValues?: string[],
  ): string | number | boolean | Date | null {
    switch (transform) {
      case 'date': {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date format: ${value}`);
        }
        return date;
      }

      case 'number': {
        const num = parseFloat(String(value));
        if (isNaN(num)) {
          throw new BadRequestException(`Invalid number format: ${value}`);
        }
        return num;
      }

      case 'boolean':
        return ['true', '1', 'yes', 'y'].includes(
          value.toString().toLowerCase(),
        );

      case 'enum':
        if (enumValues && !enumValues.includes(value)) {
          throw new BadRequestException(
            `Invalid enum value: ${value}. Must be one of: ${enumValues.join(', ')}`,
          );
        }
        return value;

      case 'string':
      default:
        return value.toString();
    }
  }

  private async validateTransactionRow(
    data: Record<string, string | number | boolean | Date | null>,
    authContext: AuthContext,
  ): Promise<{
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
    } catch {
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
    } catch {
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

  private async validateIncomeRow(
    data: Record<string, string | number | boolean | Date | null>,
    authContext: AuthContext,
  ): Promise<{
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

  private async getExistingTransactionHashes(
    authContext: AuthContext,
  ): Promise<Set<string>> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const transactions = await prisma.transaction.findMany({
        where: {
          householdId: authContext.householdId,
          sourceHash: { not: null },
        },
        select: { sourceHash: true },
      });

      return new Set(transactions.map((t) => t.sourceHash).filter(Boolean));
    });
  }

  private generateTransactionHash(data: {
    amount: number;
    date: Date;
    description: string;
    actorId: string;
    categoryId: string;
  }): string {
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
