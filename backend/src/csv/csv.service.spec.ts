import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CsvService, FieldMapping, AuthContext } from './csv.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { IncomesService } from '../incomes/incomes.service';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { UserRole, TransactionType } from '@prisma/client';
import * as Papa from 'papaparse';

// Mock Papa Parse
jest.mock('papaparse');
const mockPapa = Papa as jest.Mocked<typeof Papa>;

interface MockPrismaContext {
  transaction?: {
    findMany: jest.Mock;
  };
  income?: {
    findMany: jest.Mock;
  };
}

describe('CsvService', () => {
  let service: CsvService;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockTransactionFieldMappings: FieldMapping[] = [
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
    {
      csvField: 'date',
      systemField: 'occurred_on',
      required: true,
      transform: 'date',
    },
    {
      csvField: 'categoryId',
      systemField: 'category_id',
      required: true,
      transform: 'string',
    },
    {
      csvField: 'actorId',
      systemField: 'payer_actor_id',
      required: true,
      transform: 'string',
    },
    {
      csvField: 'shouldPay',
      systemField: 'should_pay',
      required: true,
      transform: 'enum',
      enumValues: ['HOUSEHOLD', 'USER'],
    },
  ];

  const mockIncomeFieldMappings: FieldMapping[] = [
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
  ];

  const mockPrismaService = {
    withContext: jest.fn(),
    prisma: {
      transaction: {
        findMany: jest.fn(),
      },
      income: {
        findMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    },
  };

  const mockTransactionsService = {
    findAll: jest.fn(),
    createMany: jest.fn(),
  };

  const mockIncomesService = {
    findAll: jest.fn(),
    createMany: jest.fn(),
  };

  const mockActorsService = {
    findOne: jest.fn(),
  };

  const mockCategoriesService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
        {
          provide: IncomesService,
          useValue: mockIncomesService,
        },
        {
          provide: ActorsService,
          useValue: mockActorsService,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    service = module.get<CsvService>(CsvService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('previewTransactionImport', () => {
    const mockCsvData =
      'amount,type,description,date,categoryId,actorId,shouldPay\n-500,EXPENSE,Grocery,2025-01-15,cat-1,actor-1,HOUSEHOLD';

    beforeEach(() => {
      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: [
          {
            amount: '-500',
            type: 'EXPENSE',
            description: 'Grocery',
            date: '2025-01-15',
            categoryId: 'cat-1',
            actorId: 'actor-1',
            shouldPay: 'HOUSEHOLD',
          },
        ],
        errors: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            transaction: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          });
        },
      );

      mockCategoriesService.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Food',
      });
      mockActorsService.findOne.mockResolvedValue({
        id: 'actor-1',
        name: 'User',
      });
    });

    it('should preview transaction import successfully', async () => {
      const result = await service.previewTransactionImport(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
      );

      expect(result).toEqual({
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        sampleData: expect.arrayContaining([
          expect.objectContaining({
            amount_yen: -500,
            type: 'EXPENSE',
            note: 'Grocery',
            category_id: 'cat-1',
            payer_actor_id: 'actor-1',
            should_pay: 'HOUSEHOLD',
            occurred_on: expect.any(Date) as Date,
          }),
        ]) as unknown[],
        errors: [],
        warnings: [],
      });

      expect(mockPapa.parse).toHaveBeenCalledWith(mockCsvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
    });

    it('should throw BadRequestException on CSV parsing error', async () => {
      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: [],
        errors: [
          {
            message: 'Invalid CSV format',
            type: 'Delimiter',
            code: 'UndetectableDelimiter',
          },
        ],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      await expect(
        service.previewTransactionImport(
          mockCsvData,
          mockTransactionFieldMappings,
          mockAuthContext,
        ),
      ).rejects.toThrow(
        new BadRequestException('CSV parsing failed: Invalid CSV format'),
      );
    });

    it('should detect duplicate transactions', async () => {
      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            transaction: {
              findMany: jest
                .fn()
                .mockResolvedValue([{ sourceHash: 'existing-hash' }]),
            },
          });
        },
      );

      // Mock generateTransactionHash to return predictable hash
      const generateHashSpy = jest.spyOn(
        service as any,
        'generateTransactionHash',
      );
      generateHashSpy.mockReturnValue('existing-hash');

      const result = await service.previewTransactionImport(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
      );

      expect(result.duplicateRows).toBe(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toBe(
        'Duplicate transaction detected',
      );

      generateHashSpy.mockRestore();
    });

    it('should handle validation errors', async () => {
      mockCategoriesService.findOne.mockRejectedValue(
        new Error('Category not found'),
      );

      const result = await service.previewTransactionImport(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
      );

      expect(result.invalidRows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Category not found');
    });

    it('should limit preview to 1000 rows', async () => {
      const largeCsvData = Array.from(
        { length: 1500 },
        (_, i) => `${i},EXPENSE,Item ${i},2025-01-15,cat-1,actor-1,USER`,
      );
      const csvWithHeaders =
        'amount,type,description,date,categoryId,actorId,shouldPay\n' +
        largeCsvData.join('\n');

      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: largeCsvData.map((_, i) => ({
          amount: `${i}`,
          type: 'EXPENSE',
          description: `Item ${i}`,
          date: '2025-01-15',
          categoryId: 'cat-1',
          actorId: 'actor-1',
          shouldPay: 'USER',
        })),
        errors: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      const result = await service.previewTransactionImport(
        csvWithHeaders,
        mockTransactionFieldMappings,
        mockAuthContext,
      );

      expect(result.totalRows).toBe(1500);
      // Should only process first 1000 rows for validation
      expect(mockCategoriesService.findOne).toHaveBeenCalledTimes(1000);
    });
  });

  describe('importTransactions', () => {
    const mockCsvData =
      'amount,type,description,date,categoryId,actorId,shouldPay\n-500,EXPENSE,Grocery,2025-01-15,cat-1,actor-1,HOUSEHOLD';

    beforeEach(() => {
      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: [
          {
            amount: '-500',
            type: 'EXPENSE',
            description: 'Grocery',
            date: '2025-01-15',
            categoryId: 'cat-1',
            actorId: 'actor-1',
            shouldPay: 'HOUSEHOLD',
          },
        ],
        errors: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            transaction: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          });
        },
      );

      mockCategoriesService.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Food',
      });
      mockActorsService.findOne.mockResolvedValue({
        id: 'actor-1',
        name: 'User',
      });
    });

    it('should import transactions successfully', async () => {
      mockTransactionsService.createMany.mockResolvedValue({
        count: 1,
        errors: [],
      });

      const result = await service.importTransactions(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result).toEqual({
        totalProcessed: 1,
        successful: 1,
        failed: 0,
        duplicates: 0,
        errors: [],
      });

      expect(mockTransactionsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'EXPENSE',
            amount_yen: -500,
            note: 'Grocery',
            occurred_on: expect.any(Date) as Date,
            category_id: 'cat-1',
            payer_actor_id: 'actor-1',
            should_pay: 'HOUSEHOLD',
            source_hash: expect.any(String) as string,
          }),
        ]) as unknown[],
        mockAuthContext,
      );
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            transaction: {
              findMany: jest
                .fn()
                .mockResolvedValue([{ sourceHash: 'existing-hash' }]),
            },
          });
        },
      );

      // Mock generateTransactionHash to return predictable hash
      const generateHashSpy = jest.spyOn(
        service as any,
        'generateTransactionHash',
      );
      generateHashSpy.mockReturnValue('existing-hash');

      mockTransactionsService.createMany.mockResolvedValue({
        count: 0,
        errors: [],
      });

      const result = await service.importTransactions(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.duplicates).toBe(1);
      expect(result.successful).toBe(0);
      expect(mockTransactionsService.createMany).not.toHaveBeenCalled();

      generateHashSpy.mockRestore();
    });

    it('should report duplicates as errors when skipDuplicates is false', async () => {
      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            transaction: {
              findMany: jest
                .fn()
                .mockResolvedValue([{ sourceHash: 'existing-hash' }]),
            },
          });
        },
      );

      // Mock generateTransactionHash to return predictable hash
      const generateHashSpy = jest.spyOn(
        service as any,
        'generateTransactionHash',
      );
      generateHashSpy.mockReturnValue('existing-hash');

      const result = await service.importTransactions(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
        false,
      );

      expect(result.duplicates).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Duplicate transaction');

      generateHashSpy.mockRestore();
    });

    it('should handle validation errors during import', async () => {
      mockCategoriesService.findOne.mockRejectedValue(
        new Error('Category not found'),
      );

      const result = await service.importTransactions(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Category not found');
    });

    it('should handle bulk creation errors', async () => {
      mockTransactionsService.createMany.mockResolvedValue({
        count: 0,
        errors: [
          {
            dto: {},
            error: 'Database error',
          },
        ],
      });

      const result = await service.importTransactions(
        mockCsvData,
        mockTransactionFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Database error');
    });
  });

  describe('exportTransactions', () => {
    const mockTransactions = [
      {
        id: 'tx-1',
        amountYen: BigInt(-500),
        type: TransactionType.EXPENSE,
        note: 'Grocery shopping',
        occurredOn: new Date('2025-01-15'),
        category: { name: 'Food' },
        categoryId: 'cat-1',
        payerActor: { name: 'John Doe' },
        payerActorId: 'actor-1',
        tags: ['groceries', 'food'],
        shouldPay: 'HOUSEHOLD',
        createdAt: new Date('2025-01-15T10:00:00Z'),
      },
    ];

    beforeEach(() => {
      mockTransactionsService.findAll.mockResolvedValue(mockTransactions);
    });

    it('should export transactions as CSV', async () => {
      const mockCsvOutput = 'id,amount,type\ntx-1,-500,EXPENSE';
      mockPapa.unparse.mockReturnValue(mockCsvOutput);

      const result = await service.exportTransactions(
        {},
        { format: 'csv', includeHeaders: true },
        mockAuthContext,
      );

      expect(result).toBe(mockCsvOutput);
      expect(mockPapa.unparse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tx-1',
            amount: -500,
            type: TransactionType.EXPENSE,
            description: 'Grocery shopping',
            category: 'Food',
            actor: 'John Doe',
            tags: 'groceries;food',
          }),
        ]),
        { header: true },
      );
    });

    it('should export transactions as JSON', async () => {
      const result = await service.exportTransactions(
        {},
        { format: 'json' },
        mockAuthContext,
      );

      const parsedResult = JSON.parse(result) as unknown[];
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0]).toMatchObject({
        id: 'tx-1',
        amount: -500,
        type: TransactionType.EXPENSE,
        description: 'Grocery shopping',
        category: 'Food',
        actor: 'John Doe',
        tags: 'groceries;food',
      });
    });

    it('should format dates according to specified format', async () => {
      const result = await service.exportTransactions(
        {},
        { format: 'json', dateFormat: 'us' },
        mockAuthContext,
      );

      const parsedResult = JSON.parse(result) as Array<{ date?: string }>;
      expect(parsedResult[0]?.date).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/); // US format MM/DD/YYYY
    });

    it('should export CSV without headers when specified', async () => {
      const mockCsvOutput = 'tx-1,-500,EXPENSE';
      mockPapa.unparse.mockReturnValue(mockCsvOutput);

      await service.exportTransactions(
        {},
        { format: 'csv', includeHeaders: false },
        mockAuthContext,
      );

      expect(mockPapa.unparse).toHaveBeenCalledWith(expect.any(Array), {
        header: false,
      });
    });
  });

  describe('importIncomes', () => {
    const mockCsvData =
      'userId,grossIncomeYen,deductionYen,year,month\nuser-1,300000,50000,2025,1';

    beforeEach(() => {
      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: [
          {
            userId: 'user-1',
            grossIncomeYen: '300000',
            deductionYen: '50000',
            year: '2025',
            month: '1',
          },
        ],
        errors: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            income: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          });
        },
      );

      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
      });
    });

    it('should import incomes successfully', async () => {
      mockIncomesService.createMany.mockResolvedValue({
        count: 1,
        errors: [],
      });

      const result = await service.importIncomes(
        mockCsvData,
        mockIncomeFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result).toEqual({
        totalProcessed: 1,
        successful: 1,
        failed: 0,
        duplicates: 0,
        errors: [],
      });

      expect(mockIncomesService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'user-1',
            grossIncomeYen: 300000,
            deductionYen: 50000,
            year: 2025,
            month: 1,
          }),
        ]),
        mockAuthContext,
      );
    });

    it('should skip duplicate incomes when skipDuplicates is true', async () => {
      mockPrismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (ctx: MockPrismaContext) => unknown,
        ) => {
          return callback({
            income: {
              findMany: jest.fn().mockResolvedValue([
                {
                  userId: 'user-1',
                  month: new Date('2025-01-01'), // January 2025
                },
              ]),
            },
          });
        },
      );

      mockIncomesService.createMany.mockResolvedValue({
        count: 0,
        errors: [],
      });

      const result = await service.importIncomes(
        mockCsvData,
        mockIncomeFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.duplicates).toBe(1);
      expect(result.successful).toBe(0);
      expect(mockIncomesService.createMany).not.toHaveBeenCalled();
    });

    it('should handle user validation errors', async () => {
      mockPrismaService.prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.importIncomes(
        mockCsvData,
        mockIncomeFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe(
        'User not found or does not belong to household',
      );
    });

    it('should validate income amount constraints', async () => {
      (mockPapa.parse as jest.Mock).mockReturnValue({
        data: [
          {
            userId: 'user-1',
            grossIncomeYen: '100',
            deductionYen: '200', // Deduction > gross income
            year: '2025',
            month: '1',
          },
        ],
        errors: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });

      const result = await service.importIncomes(
        mockCsvData,
        mockIncomeFieldMappings,
        mockAuthContext,
        true,
      );

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe(
        'Deduction cannot exceed gross income',
      );
    });
  });

  describe('exportIncomes', () => {
    const mockIncomes = [
      {
        id: 'income-1',
        userId: 'user-1',
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        grossYen: BigInt(300000),
        deductionTaxYen: BigInt(30000),
        deductionSocialYen: BigInt(15000),
        deductionOtherYen: BigInt(5000),
        allocatableYen: BigInt(250000),
        month: new Date('2025-01-01'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
      },
    ];

    beforeEach(() => {
      mockIncomesService.findAll.mockResolvedValue(mockIncomes);
    });

    it('should export incomes as CSV', async () => {
      const mockCsvOutput = 'id,userId,grossIncomeYen\nincome-1,user-1,300000';
      mockPapa.unparse.mockReturnValue(mockCsvOutput);

      const result = await service.exportIncomes(
        {},
        { format: 'csv', includeHeaders: true },
        mockAuthContext,
      );

      expect(result).toBe(mockCsvOutput);
      expect(mockPapa.unparse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'income-1',
            userId: 'user-1',
            userName: 'John Doe',
            userEmail: 'john@example.com',
            grossIncomeYen: 300000,
            year: 2025,
            month: 1,
          }),
        ]),
        { header: true },
      );
    });

    it('should export incomes as JSON', async () => {
      const result = await service.exportIncomes(
        {},
        { format: 'json' },
        mockAuthContext,
      );

      const parsedResult = JSON.parse(result) as unknown[];
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0]).toMatchObject({
        id: 'income-1',
        userId: 'user-1',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        grossIncomeYen: 300000,
        year: 2025,
        month: 1,
      });
    });
  });

  // Note: Value transformations are tested through the public import/preview methods
  // since transformValue and mapRowData are private methods

  // Note: Validation methods are tested through the public preview and import methods
  // since validateTransactionRow and validateIncomeRow are private methods

  // Note: Utility methods and data conversion methods are tested through the public methods
  // since formatDate, generateTransactionHash, convertToCreateTransactionDto, and convertToCreateIncomeDto are private
});
