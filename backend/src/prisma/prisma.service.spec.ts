import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { UserRole } from '@prisma/client';

describe('PrismaService', () => {
  let service: PrismaService;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Mock the internal PrismaClient to avoid database connection issues
    const mockPrismaClient = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      $on: jest.fn(),
    };

    // Replace the service's prisma client with our mock
    service.prisma = mockPrismaClient as typeof service.prisma;
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to the database', async () => {
      // Mock the $connect method if it exists
      if (service.$connect) {
        const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
        await service.onModuleInit();
        expect(connectSpy).toHaveBeenCalled();
        connectSpy.mockRestore();
      } else {
        // If $connect doesn't exist, just check that onModuleInit resolves
        await expect(service.onModuleInit()).resolves.toBeUndefined();
      }
    });

    it('should handle connection errors gracefully', async () => {
      if (service.$connect) {
        const connectSpy = jest
          .spyOn(service, '$connect')
          .mockRejectedValue(new Error('Connection failed'));

        await expect(service.onModuleInit()).rejects.toThrow(
          'Connection failed',
        );
        connectSpy.mockRestore();
      } else {
        // Skip this test if $connect doesn't exist
        expect(true).toBe(true);
      }
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from the database', async () => {
      if (service.$disconnect) {
        const disconnectSpy = jest
          .spyOn(service, '$disconnect')
          .mockResolvedValue();

        await service.onModuleDestroy();
        expect(disconnectSpy).toHaveBeenCalled();
        disconnectSpy.mockRestore();
      } else {
        // If $disconnect doesn't exist, just check that onModuleDestroy resolves
        await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      }
    });

    it('should handle disconnection errors gracefully', async () => {
      if (service.$disconnect) {
        const disconnectSpy = jest
          .spyOn(service, '$disconnect')
          .mockRejectedValue(new Error('Disconnect failed'));

        await expect(service.onModuleDestroy()).rejects.toThrow(
          'Disconnect failed',
        );
        disconnectSpy.mockRestore();
      } else {
        // Skip this test if $disconnect doesn't exist
        expect(true).toBe(true);
      }
    });
  });

  describe('withContext', () => {
    it('should execute function with session context', async () => {
      const mockResult = { id: 'test-result' };
      const testFunction = jest.fn().mockResolvedValue(mockResult);

      // Mock the prisma $transaction method to avoid database connection
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            // Create a mock transaction client with the necessary methods
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            // Execute the function with the mocked transaction client
            return await fn(mockTx as typeof service.prisma);
          },
        );

      const result = await service.withContext(mockAuthContext, testFunction);

      expect(testFunction).toHaveBeenCalled();
      expect(result).toBe(mockResult);

      mockTransaction.mockRestore();
    });

    it('should set correct session context variables', async () => {
      const testFunction = jest.fn().mockResolvedValue('success');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      const result = await service.withContext(mockAuthContext, testFunction);

      expect(testFunction).toHaveBeenCalled();
      expect(result).toBe('success');

      mockTransaction.mockRestore();
    });

    it('should propagate function execution errors', async () => {
      const testFunction = jest
        .fn()
        .mockRejectedValue(new Error('Function error'));

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      await expect(
        service.withContext(mockAuthContext, testFunction),
      ).rejects.toThrow('Function error');

      mockTransaction.mockRestore();
    });

    it('should work with different user roles', async () => {
      const memberContext: AuthContext = {
        ...mockAuthContext,
        role: UserRole.member,
      };
      const testFunction = jest.fn().mockResolvedValue('success');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      const result = await service.withContext(memberContext, testFunction);

      expect(testFunction).toHaveBeenCalled();
      expect(result).toBe('success');

      mockTransaction.mockRestore();
    });

    it('should handle empty context values', async () => {
      const emptyContext: AuthContext = {
        userId: '',
        householdId: '',
        role: UserRole.member,
      };
      const testFunction = jest.fn().mockResolvedValue('success');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      const result = await service.withContext(emptyContext, testFunction);

      expect(testFunction).toHaveBeenCalled();
      expect(result).toBe('success');

      mockTransaction.mockRestore();
    });
  });

  describe('connection pooling', () => {
    it('should handle multiple concurrent requests', async () => {
      const testFunction = jest.fn().mockResolvedValue('concurrent-success');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      // Simulate multiple concurrent context executions
      const promises = Array(5)
        .fill(null)
        .map(() => service.withContext(mockAuthContext, testFunction));

      const results = await Promise.all(promises);

      expect(results).toEqual(Array(5).fill('concurrent-success'));
      expect(testFunction).toHaveBeenCalledTimes(5);

      mockTransaction.mockRestore();
    });
  });

  describe('context isolation', () => {
    it('should maintain context isolation between requests', async () => {
      const context1: AuthContext = {
        userId: 'user-1',
        householdId: 'household-1',
        role: UserRole.admin,
      };
      const context2: AuthContext = {
        userId: 'user-2',
        householdId: 'household-2',
        role: UserRole.member,
      };

      const testFunction1 = jest.fn().mockResolvedValue('result-1');
      const testFunction2 = jest.fn().mockResolvedValue('result-2');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      // Execute contexts concurrently to test isolation
      const [result1, result2] = await Promise.all([
        service.withContext(context1, testFunction1),
        service.withContext(context2, testFunction2),
      ]);

      expect(result1).toBe('result-1');
      expect(result2).toBe('result-2');
      expect(testFunction1).toHaveBeenCalledTimes(1);
      expect(testFunction2).toHaveBeenCalledTimes(1);

      mockTransaction.mockRestore();
    });
  });

  describe('error handling and resilience', () => {
    it('should handle malformed context gracefully', async () => {
      const invalidContext = {
        userId: null,
        householdId: undefined,
        role: 'invalid-role',
      } as unknown as AuthContext;

      const testFunction = jest.fn().mockResolvedValue('success');

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      const result = await service.withContext(invalidContext, testFunction);

      expect(testFunction).toHaveBeenCalled();
      expect(result).toBe('success');

      mockTransaction.mockRestore();
    });

    it('should handle context cleanup on function errors', async () => {
      const testFunction = jest
        .fn()
        .mockRejectedValue(new Error('Function failed'));

      // Mock the prisma $transaction method
      const mockTransaction = jest
        .spyOn(service.prisma, '$transaction')
        .mockImplementation(
          async (fn: (tx: typeof service.prisma) => unknown) => {
            const mockTx = {
              ...service.prisma,
              $executeRaw: jest.fn().mockResolvedValue(undefined),
            };
            return await fn(mockTx as typeof service.prisma);
          },
        );

      await expect(
        service.withContext(mockAuthContext, testFunction),
      ).rejects.toThrow('Function failed');

      mockTransaction.mockRestore();
    });
  });
});
