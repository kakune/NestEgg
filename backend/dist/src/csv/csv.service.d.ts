import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { IncomesService } from '../incomes/incomes.service';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { UserRole } from '@prisma/client';
export interface AuthContext {
    userId: string;
    householdId: string;
    role: UserRole;
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
export declare class CsvService {
    private readonly prismaService;
    private readonly transactionsService;
    private readonly incomesService;
    private readonly actorsService;
    private readonly categoriesService;
    constructor(prismaService: PrismaService, transactionsService: TransactionsService, incomesService: IncomesService, actorsService: ActorsService, categoriesService: CategoriesService);
    previewTransactionImport(csvData: string, fieldMapping: FieldMapping[], authContext: AuthContext): Promise<ImportPreview>;
    importTransactions(csvData: string, fieldMapping: FieldMapping[], authContext: AuthContext, skipDuplicates?: boolean): Promise<ImportResult>;
    exportTransactions(filters: Record<string, unknown>, options: ExportOptions, authContext: AuthContext): Promise<string>;
    importIncomes(csvData: string, fieldMapping: FieldMapping[], authContext: AuthContext, skipDuplicates?: boolean): Promise<ImportResult>;
    exportIncomes(filters: Record<string, unknown>, options: ExportOptions, authContext: AuthContext): Promise<string>;
    private mapRowData;
    private transformValue;
    private validateTransactionRow;
    private validateIncomeRow;
    private getExistingTransactionHashes;
    private generateTransactionHash;
    private formatDate;
}
