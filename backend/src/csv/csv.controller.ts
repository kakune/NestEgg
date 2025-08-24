import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  CsvService,
  FieldMapping,
  ImportPreview,
  ImportResult,
  ExportOptions,
} from './csv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import { TransactionFilters } from '../transactions/transactions.service';
import { IncomeFilters } from '../incomes/incomes.service';

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

@Controller('csv')
@UseGuards(JwtAuthGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  // Transaction Import/Export
  @Post('transactions/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadTransactionFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.split('\n');
    const headers = lines[0]
      ? lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
      : [];

    return {
      fileName: file.originalname,
      fileSize: file.size,
      rowCount: lines.length - 1, // Excluding header
      headers,
      sampleData: lines.slice(1, 4).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      }),
    };
  }

  @Post('transactions/preview')
  @HttpCode(HttpStatus.OK)
  async previewTransactionImport(
    @Body() dto: PreviewTransactionImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportPreview> {
    return this.csvService.previewTransactionImport(
      dto.csvData,
      dto.fieldMapping,
      user,
    );
  }

  @Post('transactions/import')
  @HttpCode(HttpStatus.OK)
  async importTransactions(
    @Body() dto: ImportTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportResult> {
    return this.csvService.importTransactions(
      dto.csvData,
      dto.fieldMapping,
      user,
      dto.skipDuplicates ?? true,
    );
  }

  @Get('transactions/export')
  async exportTransactions(
    @Query() query: CsvQueryParams,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const authContext = user;
    const filters: TransactionFilters = {
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      categoryIds: query.categoryIds
        ? Array.isArray(query.categoryIds)
          ? query.categoryIds
          : [query.categoryIds]
        : undefined,
      actorIds: query.actorIds
        ? Array.isArray(query.actorIds)
          ? query.actorIds
          : [query.actorIds]
        : undefined,
      types: query.types
        ? Array.isArray(query.types)
          ? query.types
          : [query.types]
        : undefined,
      tags: query.tags
        ? Array.isArray(query.tags)
          ? query.tags
          : [query.tags]
        : undefined,
      search: query.search,
    };

    const options: ExportOptions = {
      format: query.format === 'json' ? 'json' : 'csv',
      dateFormat: query.dateFormat || 'iso',
      includeHeaders: query.includeHeaders !== 'false',
    };

    const exportData = await this.csvService.exportTransactions(
      filters,
      options,
      authContext,
    );

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `transactions_${timestamp}.${options.format}`;

    res.setHeader(
      'Content-Type',
      options.format === 'json' ? 'application/json' : 'text/csv',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(exportData);
  }

  // Income Import/Export
  @Post('incomes/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadIncomeFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.split('\n');
    const headers = lines[0]
      ? lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
      : [];

    return {
      fileName: file.originalname,
      fileSize: file.size,
      rowCount: lines.length - 1,
      headers,
      sampleData: lines.slice(1, 4).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      }),
    };
  }

  @Post('incomes/import')
  @HttpCode(HttpStatus.OK)
  async importIncomes(
    @Body() dto: ImportIncomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportResult> {
    return this.csvService.importIncomes(
      dto.csvData,
      dto.fieldMapping,
      user,
      dto.skipDuplicates ?? true,
    );
  }

  @Get('incomes/export')
  async exportIncomes(
    @Query() query: IncomeExportQueryParams,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const authContext = user;
    const filters: IncomeFilters = {
      userId: query.userId,
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
    };

    const options: ExportOptions = {
      format: query.format === 'json' ? 'json' : 'csv',
      dateFormat: (query.dateFormat as string) || 'iso',
      includeHeaders: query.includeHeaders !== 'false',
    };

    const exportData = await this.csvService.exportIncomes(
      filters,
      options,
      authContext,
    );

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `incomes_${timestamp}.${options.format}`;

    res.setHeader(
      'Content-Type',
      options.format === 'json' ? 'application/json' : 'text/csv',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(exportData);
  }

  // Template and Mapping Helpers
  @Get('transactions/template')
  getTransactionTemplate(@Res() res: Response): void {
    const template = `amount,type,description,date,categoryId,actorId,tags,notes,shouldPay
-500,expense,"Grocery shopping",2024-01-15,cat-food-id,actor-user1-id,"groceries;food","Weekly shopping",true
2000,income,"Salary",2024-01-31,cat-salary-id,actor-user1-id,"salary","Monthly salary",false`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="transaction_template.csv"',
    );
    res.send(template);
  }

  @Get('incomes/template')
  getIncomeTemplate(@Res() res: Response): void {
    const template = `userId,grossIncomeYen,deductionYen,year,month,description,sourceDocument
user-id-1,300000,50000,2024,1,"January salary","Payslip Jan 2024"
user-id-1,320000,52000,2024,2,"February salary","Payslip Feb 2024"`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="income_template.csv"',
    );
    res.send(template);
  }

  @Get('field-mappings/transactions')
  getTransactionFieldMappings(): FieldMapping[] {
    return [
      {
        csvField: 'amount',
        systemField: 'amount',
        required: true,
        transform: 'number',
      },
      {
        csvField: 'type',
        systemField: 'type',
        required: true,
        transform: 'enum',
        enumValues: ['income', 'expense'],
      },
      {
        csvField: 'description',
        systemField: 'description',
        required: true,
        transform: 'string',
      },
      {
        csvField: 'date',
        systemField: 'date',
        required: true,
        transform: 'date',
      },
      {
        csvField: 'categoryId',
        systemField: 'categoryId',
        required: true,
        transform: 'string',
      },
      {
        csvField: 'actorId',
        systemField: 'actorId',
        required: true,
        transform: 'string',
      },
      {
        csvField: 'tags',
        systemField: 'tags',
        required: false,
        transform: 'string',
        defaultValue: [],
      },
      {
        csvField: 'notes',
        systemField: 'notes',
        required: false,
        transform: 'string',
      },
      {
        csvField: 'shouldPay',
        systemField: 'shouldPay',
        required: false,
        transform: 'boolean',
      },
    ];
  }

  @Get('field-mappings/incomes')
  getIncomeFieldMappings(): FieldMapping[] {
    return [
      {
        csvField: 'userId',
        systemField: 'userId',
        required: true,
        transform: 'string',
      },
      {
        csvField: 'grossIncomeYen',
        systemField: 'grossIncomeYen',
        required: true,
        transform: 'number',
      },
      {
        csvField: 'deductionYen',
        systemField: 'deductionYen',
        required: true,
        transform: 'number',
        defaultValue: 0,
      },
      {
        csvField: 'year',
        systemField: 'year',
        required: true,
        transform: 'number',
      },
      {
        csvField: 'month',
        systemField: 'month',
        required: true,
        transform: 'number',
      },
      {
        csvField: 'description',
        systemField: 'description',
        required: false,
        transform: 'string',
      },
      {
        csvField: 'sourceDocument',
        systemField: 'sourceDocument',
        required: false,
        transform: 'string',
      },
    ];
  }
}
