import { Response } from 'express';
import { CsvService, FieldMapping, ImportPreview, ImportResult } from './csv.service';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
interface CsvQueryParams {
    dateFrom?: string;
    dateTo?: string;
    categoryIds?: string | string[];
    actorIds?: string | string[];
    types?: string | string[];
    tags?: string | string[];
    search?: string;
    format?: string;
    dateFormat?: string;
    includeHeaders?: string;
}
interface IncomeExportQueryParams {
    userId?: string;
    year?: string;
    month?: string;
    yearFrom?: string;
    yearTo?: string;
    format?: string;
}
interface PreviewTransactionImportDto {
    csvData: string;
    fieldMapping: FieldMapping[];
}
interface ImportTransactionDto {
    csvData: string;
    fieldMapping: FieldMapping[];
    skipDuplicates?: boolean;
}
interface ImportIncomeDto {
    csvData: string;
    fieldMapping: FieldMapping[];
    skipDuplicates?: boolean;
}
export declare class CsvController {
    private readonly csvService;
    constructor(csvService: CsvService);
    private getAuthContext;
    uploadTransactionFile(file: Express.Multer.File): {
        fileName: string;
        fileSize: number;
        rowCount: number;
        headers: string[];
        sampleData: Record<string, string>[];
    };
    previewTransactionImport(dto: PreviewTransactionImportDto, user: AuthenticatedUser): Promise<ImportPreview>;
    importTransactions(dto: ImportTransactionDto, user: AuthenticatedUser): Promise<ImportResult>;
    exportTransactions(query: CsvQueryParams, user: AuthenticatedUser, res: Response): Promise<void>;
    uploadIncomeFile(file: Express.Multer.File): {
        fileName: string;
        fileSize: number;
        rowCount: number;
        headers: string[];
        sampleData: Record<string, string>[];
    };
    importIncomes(dto: ImportIncomeDto, user: AuthenticatedUser): Promise<ImportResult>;
    exportIncomes(query: IncomeExportQueryParams, user: AuthenticatedUser, res: Response): Promise<void>;
    getTransactionTemplate(res: Response): void;
    getIncomeTemplate(res: Response): void;
    getTransactionFieldMappings(): FieldMapping[];
    getIncomeFieldMappings(): FieldMapping[];
}
export {};
