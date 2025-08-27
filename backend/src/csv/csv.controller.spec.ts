import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { CsvController } from './csv.controller';
import {
  CsvService,
  FieldMapping,
  ImportPreview,
  ImportResult,
} from './csv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole, TransactionType } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';

describe('CsvController', () => {
  let controller: CsvController;
  let mockResponse: Partial<Response>;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockFieldMappings: FieldMapping[] = [
    {
      csvField: 'amount',
      systemField: 'amount_yen',
      required: true,
      transform: 'number',
    },
    {
      csvField: 'type',
      systemField: 'type',
      required: true,
      transform: 'enum',
      enumValues: ['INCOME', 'EXPENSE'],
    },
    {
      csvField: 'description',
      systemField: 'note',
      required: true,
      transform: 'string',
    },
  ];

  const mockImportPreview: ImportPreview = {
    totalRows: 3,
    validRows: 2,
    invalidRows: 1,
    duplicateRows: 0,
    sampleData: [
      { amount: '1000', type: 'EXPENSE', description: 'Test transaction' },
    ],
    errors: [
      {
        row: 3,
        field: 'amount',
        value: 'invalid',
        message: 'Invalid number format',
      },
    ],
    warnings: [],
  };

  const mockImportResult: ImportResult = {
    totalProcessed: 3,
    successful: 2,
    failed: 1,
    duplicates: 0,
    errors: [
      {
        row: 3,
        field: 'amount',
        value: 'invalid',
        message: 'Invalid number format',
      },
    ],
  };

  const mockCsvService = {
    previewTransactionImport: jest.fn(),
    importTransactions: jest.fn(),
    exportTransactions: jest.fn(),
    importIncomes: jest.fn(),
    exportIncomes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsvController],
      providers: [
        {
          provide: CsvService,
          useValue: mockCsvService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<CsvController>(CsvController);

    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadTransactionFile', () => {
    const mockCsvContent =
      'amount,type,description\n-500,expense,Grocery shopping\n2000,income,Salary';
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: 100,
      buffer: Buffer.from(mockCsvContent),
      destination: '',
      filename: '',
      path: '',
      stream: new Readable(),
    };

    it('should successfully upload and parse CSV file', () => {
      const result = controller.uploadTransactionFile(mockFile);

      expect(result).toEqual({
        fileName: 'test.csv',
        fileSize: 100,
        rowCount: 2,
        headers: ['amount', 'type', 'description'],
        sampleData: [
          { amount: '-500', type: 'expense', description: 'Grocery shopping' },
          { amount: '2000', type: 'income', description: 'Salary' },
        ],
      });
    });

    it('should throw BadRequestException when no file is uploaded', () => {
      expect(() => controller.uploadTransactionFile(undefined!)).toThrow(
        new BadRequestException('No file uploaded'),
      );
    });

    it('should throw BadRequestException for non-CSV files', () => {
      const nonCsvFile = { ...mockFile, originalname: 'test.txt' };

      expect(() => controller.uploadTransactionFile(nonCsvFile)).toThrow(
        new BadRequestException('Only CSV files are allowed'),
      );
    });

    it('should handle CSV files with case-insensitive extension', () => {
      const csvFileUppercase = { ...mockFile, originalname: 'TEST.CSV' };

      const result = controller.uploadTransactionFile(csvFileUppercase);

      expect(result.fileName).toBe('TEST.CSV');
      expect(result.headers).toEqual(['amount', 'type', 'description']);
    });

    it('should handle empty CSV file', () => {
      const emptyFile = {
        ...mockFile,
        buffer: Buffer.from(''),
      };

      const result = controller.uploadTransactionFile(emptyFile);

      expect(result).toEqual({
        fileName: 'test.csv',
        fileSize: 100,
        rowCount: 0, // Empty file has no data rows
        headers: [],
        sampleData: [],
      });
    });

    it('should handle CSV with only headers', () => {
      const headerOnlyFile = {
        ...mockFile,
        buffer: Buffer.from('amount,type,description'),
      };

      const result = controller.uploadTransactionFile(headerOnlyFile);

      expect(result).toEqual({
        fileName: 'test.csv',
        fileSize: 100,
        rowCount: 0,
        headers: ['amount', 'type', 'description'],
        sampleData: [],
      });
    });

    it('should limit sample data to 3 rows', () => {
      const largeCsvContent = [
        'amount,type,description',
        '-500,expense,Row 1',
        '-600,expense,Row 2',
        '-700,expense,Row 3',
        '-800,expense,Row 4',
        '-900,expense,Row 5',
      ].join('\n');

      const largeFile = {
        ...mockFile,
        buffer: Buffer.from(largeCsvContent),
      };

      const result = controller.uploadTransactionFile(largeFile);

      expect(result.sampleData).toHaveLength(3);
      expect(result.sampleData[0]?.description).toBe('Row 1');
      expect(result.sampleData[2]?.description).toBe('Row 3');
    });
  });

  describe('previewTransactionImport', () => {
    const mockPreviewDto = {
      csvData: 'amount,type,description\n-500,EXPENSE,Grocery',
      fieldMapping: mockFieldMappings,
    };

    it('should preview transaction import successfully', async () => {
      mockCsvService.previewTransactionImport.mockResolvedValue(
        mockImportPreview,
      );

      const result = await controller.previewTransactionImport(
        mockPreviewDto,
        mockUser,
      );

      expect(result).toEqual(mockImportPreview);
      expect(mockCsvService.previewTransactionImport).toHaveBeenCalledWith(
        mockPreviewDto.csvData,
        mockPreviewDto.fieldMapping,
        mockUser,
      );
    });

    it('should handle preview errors from service', async () => {
      const error = new BadRequestException('CSV parsing failed');
      mockCsvService.previewTransactionImport.mockRejectedValue(error);

      await expect(
        controller.previewTransactionImport(mockPreviewDto, mockUser),
      ).rejects.toThrow(error);
    });
  });

  describe('importTransactions', () => {
    const mockImportDto = {
      csvData: 'amount,type,description\n-500,EXPENSE,Grocery',
      fieldMapping: mockFieldMappings,
      skipDuplicates: true,
    };

    it('should import transactions successfully', async () => {
      mockCsvService.importTransactions.mockResolvedValue(mockImportResult);

      const result = await controller.importTransactions(
        mockImportDto,
        mockUser,
      );

      expect(result).toEqual(mockImportResult);
      expect(mockCsvService.importTransactions).toHaveBeenCalledWith(
        mockImportDto.csvData,
        mockImportDto.fieldMapping,
        mockUser,
        true,
      );
    });

    it('should use default skipDuplicates when not provided', async () => {
      const dtoWithoutSkipDuplicates = {
        csvData: mockImportDto.csvData,
        fieldMapping: mockImportDto.fieldMapping,
      };

      mockCsvService.importTransactions.mockResolvedValue(mockImportResult);

      await controller.importTransactions(dtoWithoutSkipDuplicates, mockUser);

      expect(mockCsvService.importTransactions).toHaveBeenCalledWith(
        dtoWithoutSkipDuplicates.csvData,
        dtoWithoutSkipDuplicates.fieldMapping,
        mockUser,
        true, // Default value
      );
    });

    it('should respect skipDuplicates when explicitly set to false', async () => {
      const dtoWithSkipFalse = {
        ...mockImportDto,
        skipDuplicates: false,
      };

      mockCsvService.importTransactions.mockResolvedValue(mockImportResult);

      await controller.importTransactions(dtoWithSkipFalse, mockUser);

      expect(mockCsvService.importTransactions).toHaveBeenCalledWith(
        dtoWithSkipFalse.csvData,
        dtoWithSkipFalse.fieldMapping,
        mockUser,
        false,
      );
    });
  });

  describe('exportTransactions', () => {
    const mockExportData = 'id,amount,type\n1,-500,EXPENSE';

    it('should export transactions with default options', async () => {
      mockCsvService.exportTransactions.mockResolvedValue(mockExportData);

      await controller.exportTransactions(
        {},
        mockUser,
        mockResponse as Response,
      );

      expect(mockCsvService.exportTransactions).toHaveBeenCalledWith(
        {},
        {
          format: 'csv',
          dateFormat: 'iso',
          includeHeaders: true,
        },
        mockUser,
      );
    });

    it('should apply query filters correctly', async () => {
      const query = {
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        categoryIds: 'category-1',
        actorIds: ['actor-1', 'actor-2'],
        types: TransactionType.EXPENSE,
        tags: 'groceries',
        search: 'coffee',
        format: 'json',
        dateFormat: 'us',
        includeHeaders: 'false',
      };

      mockCsvService.exportTransactions.mockResolvedValue('{}');

      await controller.exportTransactions(
        query,
        mockUser,
        mockResponse as Response,
      );

      expect(mockCsvService.exportTransactions).toHaveBeenCalledWith(
        {
          dateFrom: new Date('2025-01-01'),
          dateTo: new Date('2025-01-31'),
          categoryIds: ['category-1'],
          actorIds: ['actor-1', 'actor-2'],
          types: [TransactionType.EXPENSE],
          tags: ['groceries'],
          search: 'coffee',
        },
        {
          format: 'json',
          dateFormat: 'us',
          includeHeaders: false,
        },
        mockUser,
      );
    });

    it('should handle array query parameters correctly', async () => {
      const query = {
        categoryIds: ['category-1', 'category-2'],
        types: [TransactionType.INCOME, TransactionType.EXPENSE],
      };

      mockCsvService.exportTransactions.mockResolvedValue(mockExportData);

      await controller.exportTransactions(
        query,
        mockUser,
        mockResponse as Response,
      );

      const expectedFilters = expect.objectContaining({
        categoryIds: ['category-1', 'category-2'],
        types: [TransactionType.INCOME, TransactionType.EXPENSE],
      }) as jest.Expect;

      expect(mockCsvService.exportTransactions).toHaveBeenCalledWith(
        expectedFilters,
        expect.any(Object),
        mockUser,
      );
    });

    it('should set correct headers for CSV export', async () => {
      mockCsvService.exportTransactions.mockResolvedValue(mockExportData);

      await controller.exportTransactions(
        {},
        mockUser,
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('transactions_'),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.csv'),
      );
    });

    it('should set correct headers for JSON export', async () => {
      mockCsvService.exportTransactions.mockResolvedValue('{}');

      await controller.exportTransactions(
        { format: 'json' },
        mockUser,
        mockResponse as Response,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.json'),
      );
    });
  });

  describe('uploadIncomeFile', () => {
    const mockIncomesCsvContent =
      'userId,grossIncomeYen,deductionYen\nuser-1,300000,50000';
    const mockIncomeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'incomes.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: 50,
      buffer: Buffer.from(mockIncomesCsvContent),
      destination: '',
      filename: '',
      path: '',
      stream: new Readable(),
    };

    it('should successfully upload and parse income CSV file', () => {
      const result = controller.uploadIncomeFile(mockIncomeFile);

      expect(result).toEqual({
        fileName: 'incomes.csv',
        fileSize: 50,
        rowCount: 1,
        headers: ['userId', 'grossIncomeYen', 'deductionYen'],
        sampleData: [
          { userId: 'user-1', grossIncomeYen: '300000', deductionYen: '50000' },
        ],
      });
    });

    it('should throw BadRequestException when no file is uploaded', () => {
      expect(() => controller.uploadIncomeFile(undefined!)).toThrow(
        new BadRequestException('No file uploaded'),
      );
    });

    it('should throw BadRequestException for non-CSV files', () => {
      const nonCsvFile = { ...mockIncomeFile, originalname: 'incomes.txt' };

      expect(() => controller.uploadIncomeFile(nonCsvFile)).toThrow(
        new BadRequestException('Only CSV files are allowed'),
      );
    });
  });

  describe('importIncomes', () => {
    const mockIncomeImportDto = {
      csvData: 'userId,grossIncomeYen,deductionYen\nuser-1,300000,50000',
      fieldMapping: [],
      skipDuplicates: true,
    };

    it('should import incomes successfully', async () => {
      mockCsvService.importIncomes.mockResolvedValue(mockImportResult);

      const result = await controller.importIncomes(
        mockIncomeImportDto,
        mockUser,
      );

      expect(result).toEqual(mockImportResult);
      expect(mockCsvService.importIncomes).toHaveBeenCalledWith(
        mockIncomeImportDto.csvData,
        mockIncomeImportDto.fieldMapping,
        mockUser,
        true,
      );
    });

    it('should use default skipDuplicates when not provided', async () => {
      const dtoWithoutSkipDuplicates = {
        csvData: mockIncomeImportDto.csvData,
        fieldMapping: mockIncomeImportDto.fieldMapping,
      };

      mockCsvService.importIncomes.mockResolvedValue(mockImportResult);

      await controller.importIncomes(dtoWithoutSkipDuplicates, mockUser);

      expect(mockCsvService.importIncomes).toHaveBeenCalledWith(
        dtoWithoutSkipDuplicates.csvData,
        dtoWithoutSkipDuplicates.fieldMapping,
        mockUser,
        true, // Default value
      );
    });
  });

  describe('exportIncomes', () => {
    const mockIncomeExportData = 'id,userId,grossIncomeYen\n1,user-1,300000';

    it('should export incomes with default options', async () => {
      mockCsvService.exportIncomes.mockResolvedValue(mockIncomeExportData);

      await controller.exportIncomes({}, mockUser, mockResponse as Response);

      expect(mockCsvService.exportIncomes).toHaveBeenCalledWith(
        {},
        {
          format: 'csv',
          dateFormat: 'iso',
          includeHeaders: true,
        },
        mockUser,
      );
    });

    it('should apply income query filters correctly', async () => {
      const query = {
        userId: 'user-1',
        year: '2024',
        month: '12',
        yearFrom: '2023',
        yearTo: '2024',
        format: 'json',
        dateFormat: 'us',
        includeHeaders: 'false',
      };

      mockCsvService.exportIncomes.mockResolvedValue('{}');

      await controller.exportIncomes(query, mockUser, mockResponse as Response);

      expect(mockCsvService.exportIncomes).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          year: 2024,
          month: 12,
          yearFrom: 2023,
          yearTo: 2024,
        },
        {
          format: 'json',
          dateFormat: 'us',
          includeHeaders: false,
        },
        mockUser,
      );
    });

    it('should set correct headers for income CSV export', async () => {
      mockCsvService.exportIncomes.mockResolvedValue(mockIncomeExportData);

      await controller.exportIncomes({}, mockUser, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('incomes_'),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.csv'),
      );
    });
  });

  describe('getTransactionTemplate', () => {
    it('should return transaction CSV template', () => {
      controller.getTransactionTemplate(mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="transaction_template.csv"',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          'amount,type,description,date,categoryId,actorId,tags,notes,shouldPay',
        ),
      );
    });
  });

  describe('getIncomeTemplate', () => {
    it('should return income CSV template', () => {
      controller.getIncomeTemplate(mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="income_template.csv"',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining(
          'userId,grossIncomeYen,deductionYen,year,month,description,sourceDocument',
        ),
      );
    });
  });

  describe('getTransactionFieldMappings', () => {
    it('should return transaction field mappings', () => {
      const result = controller.getTransactionFieldMappings();

      expect(result).toHaveLength(9);
      expect(result[0]).toEqual({
        csvField: 'amount',
        systemField: 'amount_yen',
        required: true,
        transform: 'number',
      });
      expect(result[1]).toEqual({
        csvField: 'type',
        systemField: 'type',
        required: true,
        transform: 'enum',
        enumValues: ['INCOME', 'EXPENSE'],
      });
    });

    it('should include all required transaction fields', () => {
      const result = controller.getTransactionFieldMappings();
      const systemFields = result.map((mapping) => mapping.systemField);

      expect(systemFields).toContain('amount_yen');
      expect(systemFields).toContain('type');
      expect(systemFields).toContain('note');
      expect(systemFields).toContain('occurred_on');
      expect(systemFields).toContain('category_id');
      expect(systemFields).toContain('payer_actor_id');
      expect(systemFields).toContain('should_pay');
    });
  });

  describe('getIncomeFieldMappings', () => {
    it('should return income field mappings', () => {
      const result = controller.getIncomeFieldMappings();

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual({
        csvField: 'userId',
        systemField: 'userId',
        required: true,
        transform: 'string',
      });
      expect(result[1]).toEqual({
        csvField: 'grossIncomeYen',
        systemField: 'grossIncomeYen',
        required: true,
        transform: 'number',
      });
    });

    it('should include all required income fields', () => {
      const result = controller.getIncomeFieldMappings();
      const systemFields = result.map((mapping) => mapping.systemField);

      expect(systemFields).toContain('userId');
      expect(systemFields).toContain('grossIncomeYen');
      expect(systemFields).toContain('deductionYen');
      expect(systemFields).toContain('year');
      expect(systemFields).toContain('month');
    });

    it('should set correct default values', () => {
      const result = controller.getIncomeFieldMappings();
      const deductionMapping = result.find(
        (m) => m.systemField === 'deductionYen',
      );

      expect(deductionMapping).toBeDefined();
      expect(deductionMapping?.defaultValue).toBe(0);
    });
  });
});
