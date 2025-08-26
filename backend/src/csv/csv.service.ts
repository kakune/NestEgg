import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { IncomesService } from '../incomes/incomes.service';
import type { CreateIncomeDto } from '../incomes/incomes.service';
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
  // Transaction fields
  amount_yen?: string | number;
  note?: string;
  occurred_on?: string;
  category_id?: string;
  payer_actor_id?: string;
  type?: string;
  should_pay?: string;
  tags?: string[];
  source_hash?: string;
  // Income fields
  userId?: string;
  grossIncomeYen?: string | number;
  grossYen?: string | number;
  deductionYen?: string | number;
  deductionTaxYen?: string | number;
  year?: string | number;
  month?: string | number;
  description?: string;
  sourceDocument?: string;
  // Legacy field names for backward compatibility
  amountYen?: string;
  amount?: string;
  date?: string;
  occurredOn?: string;
  categoryId?: string;
  payerActorId?: string;
  shouldPay?: string;
  [key: string]: string | number | string[] | undefined;
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
          mappedData as Record<string, string | number | boolean | Date | null>,
          authContext,
        );

        if (validationResult.isValid) {
          preview.validRows++;

          // Check for duplicates
          const sourceHash = this.generateTransactionHash({
            amountYen: parseFloat(
              String(
                mappedData.amount_yen ||
                  mappedData.amountYen ||
                  mappedData.amount ||
                  '0',
              ),
            ),
            occurredOn: new Date(
              mappedData.occurred_on ||
                mappedData.occurredOn ||
                mappedData.date ||
                '',
            ),
            note: mappedData.note || mappedData.description || '',
            payerActorId:
              mappedData.payer_actor_id || mappedData.payerActorId || '',
            categoryId: mappedData.category_id || mappedData.categoryId || '',
          });
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
            preview.sampleData.push(mappedData as Record<string, string>);
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
          mappedData as Record<string, string | number | boolean | Date | null>,
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

        const sourceHash = this.generateTransactionHash({
          amountYen: parseFloat(
            String(
              mappedData.amount_yen ||
                mappedData.amountYen ||
                mappedData.amount ||
                '0',
            ),
          ),
          occurredOn: new Date(
            mappedData.occurred_on ||
              mappedData.occurredOn ||
              mappedData.date ||
              '',
          ),
          note: mappedData.note || mappedData.description || '',
          payerActorId:
            mappedData.payer_actor_id || mappedData.payerActorId || '',
          categoryId: mappedData.category_id || mappedData.categoryId || '',
        });

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

        validTransactions.push(
          this.convertToCreateTransactionDto(mappedData, sourceHash),
        );
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
      amount: Number(transaction.amountYen),
      type: transaction.type,
      description: String(transaction.note),
      date: this.formatDate(
        new Date(String(transaction.occurredOn)),
        String(options.dateFormat),
      ),
      category: transaction.category.name,
      categoryId: transaction.categoryId,
      actor: transaction.payerActor.name,
      actorId: String(transaction.payerActorId),
      tags: transaction.tags.join(';'),
      notes: String(transaction.note || ''),
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
          },
          select: {
            userId: true,
            month: true,
          },
        });
      },
    );

    const existingKeys = new Set(
      existingIncomes.map(
        (income) =>
          `${income.userId}-${income.month.getFullYear()}-${income.month.getMonth() + 1}`,
      ),
    );

    // First pass: validate and prepare all incomes
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as CsvRow;
      const rowNumber = i + 2;

      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateIncomeRow(
          mappedData as Record<string, string | number | boolean | Date | null>,
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

        validIncomes.push(this.convertToCreateIncomeDto(mappedData));
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
      grossIncomeYen: Number(income.grossYen),
      deductionTaxYen: Number(income.deductionTaxYen),
      deductionSocialYen: Number(income.deductionSocialYen),
      deductionOtherYen: Number(income.deductionOtherYen),
      allocatableYen: Number(income.allocatableYen),
      year: income.month.getFullYear(),
      month: income.month.getMonth() + 1,
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
          systemValue as string | number | boolean | null,
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

      mappedData[mapping.systemField] = systemValue as
        | string
        | number
        | string[]
        | undefined;
    }

    return mappedData;
  }

  private convertToCreateTransactionDto(
    mappedData: MappedRowData,
    sourceHash: string,
  ): CreateTransactionDto {
    return {
      type: mappedData.type as 'INCOME' | 'EXPENSE',
      amount_yen: Number(
        mappedData.amount_yen || mappedData.amountYen || mappedData.amount || 0,
      ),
      occurred_on:
        mappedData.occurred_on ||
        mappedData.occurredOn ||
        mappedData.date ||
        '',
      category_id: mappedData.category_id || mappedData.categoryId || '',
      payer_actor_id:
        mappedData.payer_actor_id || mappedData.payerActorId || '',
      should_pay: (mappedData.should_pay ||
        mappedData.shouldPay ||
        'HOUSEHOLD') as 'HOUSEHOLD' | 'USER',
      note: mappedData.note || mappedData.description || '',
      ...(mappedData.tags && {
        tags: Array.isArray(mappedData.tags)
          ? mappedData.tags
          : [mappedData.tags],
      }),
      source_hash: sourceHash,
    };
  }

  private convertToCreateIncomeDto(mappedData: MappedRowData): CreateIncomeDto {
    return {
      userId: mappedData.userId || '',
      grossIncomeYen: Number(
        mappedData.grossIncomeYen || mappedData.grossYen || 0,
      ),
      deductionYen: Number(
        mappedData.deductionYen || mappedData.deductionTaxYen || 0,
      ),
      year: Number(mappedData.year || new Date().getFullYear()),
      month: Number(mappedData.month || 1),
      description: mappedData.description || '',
      sourceDocument: mappedData.sourceDocument || '',
    };
  }

  private transformValue(
    value: string | number | boolean | null,
    transform: string,
    enumValues?: string[],
  ): string | number | boolean | Date | null {
    switch (transform) {
      case 'date': {
        if (!value) {
          throw new BadRequestException(`Invalid date format: ${value}`);
        }
        if (typeof value === 'boolean') {
          throw new BadRequestException(`Invalid date format: ${value}`);
        }
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
        if (!value) return false;
        return ['true', '1', 'yes', 'y'].includes(
          value.toString().toLowerCase(),
        );

      case 'enum': {
        if (!value) {
          throw new BadRequestException(`Invalid enum value: ${value}`);
        }
        const stringValue = value.toString();
        if (enumValues && !enumValues.includes(stringValue)) {
          throw new BadRequestException(
            `Invalid enum value: ${stringValue}. Must be one of: ${enumValues.join(', ')}`,
          );
        }
        return stringValue;
      }

      case 'string':
      default:
        return value ? value.toString() : '';
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
    const amountValue =
      typeof data.amount === 'number'
        ? data.amount
        : typeof data.amount === 'string'
          ? parseInt(data.amount)
          : 0;
    if (!Number.isInteger(amountValue) || amountValue === 0) {
      errors.push({
        row: 0,
        field: 'amount',
        value:
          typeof data.amount === 'object' && data.amount instanceof Date
            ? data.amount.toString()
            : (data.amount ?? null),
        message: 'Amount must be a non-zero integer',
      });
    }

    // Validate type and amount consistency
    if (data.type === TransactionType.INCOME && amountValue < 0) {
      errors.push({
        row: 0,
        field: 'type',
        value: data.type ?? null,
        message: 'Income transactions must have positive amounts',
      });
    } else if (data.type === TransactionType.EXPENSE && amountValue > 0) {
      errors.push({
        row: 0,
        field: 'type',
        value: data.type ?? null,
        message: 'Expense transactions must have negative amounts',
      });
    }

    // Validate category exists
    try {
      const categoryId =
        typeof data.categoryId === 'string'
          ? data.categoryId
          : String(data.categoryId);
      await this.categoriesService.findOne(categoryId, authContext);
    } catch {
      errors.push({
        row: 0,
        field: 'categoryId',
        value:
          typeof data.categoryId === 'object' && data.categoryId instanceof Date
            ? data.categoryId.toString()
            : (data.categoryId ?? null),
        message: 'Category not found',
      });
    }

    // Validate actor exists
    try {
      const actorId =
        typeof data.actorId === 'string' ? data.actorId : String(data.actorId);
      await this.actorsService.findOne(actorId, authContext);
    } catch {
      errors.push({
        row: 0,
        field: 'actorId',
        value:
          typeof data.actorId === 'object' && data.actorId instanceof Date
            ? data.actorId.toString()
            : (data.actorId ?? null),
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
    const grossIncomeValue =
      typeof data.grossIncomeYen === 'number'
        ? data.grossIncomeYen
        : typeof data.grossIncomeYen === 'string'
          ? parseInt(data.grossIncomeYen)
          : 0;
    const deductionValue =
      typeof data.deductionYen === 'number'
        ? data.deductionYen
        : typeof data.deductionYen === 'string'
          ? parseInt(data.deductionYen)
          : 0;

    if (!Number.isInteger(grossIncomeValue) || grossIncomeValue < 0) {
      errors.push({
        row: 0,
        field: 'grossIncomeYen',
        value:
          typeof data.grossIncomeYen === 'object' &&
          data.grossIncomeYen instanceof Date
            ? data.grossIncomeYen.toString()
            : (data.grossIncomeYen ?? null),
        message: 'Gross income must be a non-negative integer',
      });
    }

    if (!Number.isInteger(deductionValue) || deductionValue < 0) {
      errors.push({
        row: 0,
        field: 'deductionYen',
        value:
          typeof data.deductionYen === 'object' &&
          data.deductionYen instanceof Date
            ? data.deductionYen.toString()
            : (data.deductionYen ?? null),
        message: 'Deduction must be a non-negative integer',
      });
    }

    if (deductionValue > grossIncomeValue) {
      errors.push({
        row: 0,
        field: 'deductionYen',
        value:
          typeof data.deductionYen === 'object' &&
          data.deductionYen instanceof Date
            ? data.deductionYen.toString()
            : (data.deductionYen ?? null),
        message: 'Deduction cannot exceed gross income',
      });
    }

    // Validate year and month
    const yearValue =
      typeof data.year === 'number'
        ? data.year
        : typeof data.year === 'string'
          ? parseInt(data.year)
          : 0;
    const monthValue =
      typeof data.month === 'number'
        ? data.month
        : typeof data.month === 'string'
          ? parseInt(data.month)
          : 0;
    const currentYear = new Date().getFullYear();

    if (yearValue < 1900 || yearValue > currentYear + 5) {
      errors.push({
        row: 0,
        field: 'year',
        value:
          typeof data.year === 'object' && data.year instanceof Date
            ? data.year.toString()
            : (data.year ?? null),
        message: `Year must be between 1900 and ${currentYear + 5}`,
      });
    }

    if (monthValue < 1 || monthValue > 12) {
      errors.push({
        row: 0,
        field: 'month',
        value:
          typeof data.month === 'object' && data.month instanceof Date
            ? data.month.toString()
            : (data.month ?? null),
        message: 'Month must be between 1 and 12',
      });
    }

    // Validate user exists
    const userId =
      typeof data.userId === 'string' ? data.userId : String(data.userId);
    const user = await this.prismaService.prisma.user.findFirst({
      where: {
        ...(userId && { id: userId }),
        householdId: authContext.householdId,
        deletedAt: null,
      },
    });

    if (!user) {
      errors.push({
        row: 0,
        field: 'userId',
        value:
          typeof data.userId === 'object' && data.userId instanceof Date
            ? data.userId.toString()
            : (data.userId ?? null),
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

      return new Set(
        transactions
          .map((t) => t.sourceHash)
          .filter((hash): hash is string => Boolean(hash)),
      );
    });
  }

  private generateTransactionHash(data: {
    amountYen: number;
    occurredOn: Date;
    note: string;
    payerActorId: string;
    categoryId: string;
  }): string {
    const hashInput = `${data.amountYen}-${data.occurredOn.toISOString()}-${data.note}-${data.payerActorId}-${data.categoryId}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private formatDate(date: Date, format?: string): string {
    if (!format) {
      return date.toISOString().split('T')[0] || date.toISOString(); // YYYY-MM-DD
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
        return date.toISOString().split('T')[0] || date.toISOString();
    }
  }
}
