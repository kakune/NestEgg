import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

// Type for health check function
type HealthCheckFunction = () => Promise<
  HealthCheckResult | { [key: string]: { status: string } }
>;

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn() as jest.MockedFunction<
      (checks: HealthCheckFunction[]) => Promise<HealthCheckResult>
    >,
  };

  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn() as jest.MockedFunction<
      (key: string, threshold: number) => { [key: string]: { status: string } }
    >,
    checkRSS: jest.fn() as jest.MockedFunction<
      (key: string, threshold: number) => { [key: string]: { status: string } }
    >,
  };

  const mockDiskHealthIndicator = {
    checkStorage: jest.fn() as jest.MockedFunction<
      (
        key: string,
        options: { path: string; threshold: number },
      ) => { [key: string]: { status: string } }
    >,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: DiskHealthIndicator,
          useValue: mockDiskHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    // Reset all mocks and their implementations
    jest.clearAllMocks();

    // Reset specific mock implementations to default return values
    mockMemoryHealthIndicator.checkHeap.mockReturnValue({
      memory_heap: { status: 'up' },
    });
    mockMemoryHealthIndicator.checkRSS.mockReturnValue({
      memory_rss: { status: 'up' },
    });
    mockDiskHealthIndicator.checkStorage.mockReturnValue({
      storage: { status: 'up' },
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return simple health status', () => {
      const result = controller.check();

      expect(result).toEqual({ status: 'ok' });
    });

    it('should always return ok status for basic health check', () => {
      // Call multiple times to ensure consistency
      const result1 = controller.check();
      const result2 = controller.check();
      const result3 = controller.check();

      expect(result1).toEqual({ status: 'ok' });
      expect(result2).toEqual({ status: 'ok' });
      expect(result3).toEqual({ status: 'ok' });
    });
  });

  describe('detailedCheck', () => {
    it('should perform detailed health checks', async () => {
      const mockHealthCheckResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {},
        details: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthCheckResult);

      const result = await controller.detailedCheck();

      expect(result).toEqual(mockHealthCheckResult);
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should check memory heap with correct parameters', async () => {
      const mockMemoryResult = { memory_heap: { status: 'up' } };
      mockMemoryHealthIndicator.checkHeap.mockReturnValue(mockMemoryResult);
      mockHealthCheckService.check.mockImplementation(
        async (checks: HealthCheckFunction[]) => {
          // Execute the first check function (memory heap)
          const heapCheck = checks[0];
          return await heapCheck();
        },
      );

      await controller.detailedCheck();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        150 * 1024 * 1024,
      );
    });

    it('should check memory RSS with correct parameters', async () => {
      const mockMemoryResult = { memory_rss: { status: 'up' } };
      mockMemoryHealthIndicator.checkRSS.mockReturnValue(mockMemoryResult);
      mockHealthCheckService.check.mockImplementation(
        async (checks: HealthCheckFunction[]) => {
          // Execute the second check function (memory RSS)
          const rssCheck = checks[1];
          return await rssCheck();
        },
      );

      await controller.detailedCheck();

      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        150 * 1024 * 1024,
      );
    });

    it('should check disk storage with correct parameters', async () => {
      const mockDiskResult = { storage: { status: 'up' } };
      mockDiskHealthIndicator.checkStorage.mockReturnValue(mockDiskResult);
      mockHealthCheckService.check.mockImplementation(
        async (checks: HealthCheckFunction[]) => {
          // Execute the third check function (disk storage)
          const storageCheck = checks[2];
          return await storageCheck();
        },
      );

      await controller.detailedCheck();

      expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'storage',
        { thresholdPercent: 0.9, path: '/' },
      );
    });

    it('should handle health check failures', async () => {
      const mockFailedHealthCheckResult: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          memory_heap: { status: 'down', message: 'Memory usage too high' },
        },
        details: {
          memory_heap: { status: 'down', message: 'Memory usage too high' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(
        mockFailedHealthCheckResult,
      );

      const result = await controller.detailedCheck();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('memory_heap');
    });

    it('should handle partial health check failures', async () => {
      const mockPartialFailureResult: HealthCheckResult = {
        status: 'error',
        info: {
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {
          memory_heap: { status: 'down', message: 'Heap memory critical' },
        },
        details: {
          memory_heap: { status: 'down', message: 'Heap memory critical' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockPartialFailureResult);

      const result = await controller.detailedCheck();

      expect(result.status).toBe('error');
      expect(result.info).toHaveProperty('memory_rss');
      expect(result.info).toHaveProperty('storage');
      expect(result.error).toHaveProperty('memory_heap');
    });

    it('should handle health check service errors', async () => {
      const healthCheckError = new Error('Health check service failed');
      mockHealthCheckService.check.mockRejectedValue(healthCheckError);

      await expect(controller.detailedCheck()).rejects.toThrow(
        'Health check service failed',
      );
    });
  });

  describe('health indicator integration', () => {
    it('should execute all health indicators when called', async () => {
      const mockResults = {
        memory_heap: { status: 'up' },
        memory_rss: { status: 'up' },
        storage: { status: 'up' },
      };

      mockMemoryHealthIndicator.checkHeap.mockReturnValue({
        memory_heap: mockResults.memory_heap,
      });
      mockMemoryHealthIndicator.checkRSS.mockReturnValue({
        memory_rss: mockResults.memory_rss,
      });
      mockDiskHealthIndicator.checkStorage.mockReturnValue({
        storage: mockResults.storage,
      });

      mockHealthCheckService.check.mockImplementation(
        async (checks: HealthCheckFunction[]) => {
          // Execute all check functions
          const results = await Promise.all(checks.map((check) => check()));

          return {
            status: 'ok',
            info: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
            error: {},
            details: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          } as HealthCheckResult;
        },
      );

      const result = await controller.detailedCheck();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalled();
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalled();
      expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalled();
      expect(result.status).toBe('ok');
    });

    it('should handle individual indicator failures gracefully', async () => {
      mockMemoryHealthIndicator.checkHeap.mockImplementation(() => {
        throw new Error('Heap check failed');
      });
      mockMemoryHealthIndicator.checkRSS.mockReturnValue({
        memory_rss: { status: 'up' },
      });
      mockDiskHealthIndicator.checkStorage.mockReturnValue({
        storage: { status: 'up' },
      });

      mockHealthCheckService.check.mockImplementation(async (checks) => {
        const results = [];
        for (const check of checks) {
          try {
            results.push(await check());
          } catch (error) {
            // Health check service should handle individual failures
            results.push({
              failed_check: {
                status: 'down',
                message: (error as Error).message,
              },
            });
          }
        }

        return {
          status: 'error',
          info: {},
          error: {
            failed_check: { status: 'down', message: 'Heap check failed' },
          },
          details: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        };
      });

      const result = await controller.detailedCheck();

      expect(result.status).toBe('error');
    });
  });

  describe('memory thresholds', () => {
    it('should use correct memory thresholds', async () => {
      const expectedHeapThreshold = 150 * 1024 * 1024; // 150MB
      const expectedRSSThreshold = 150 * 1024 * 1024; // 150MB

      mockHealthCheckService.check.mockImplementation(async (checks) => {
        await checks[0](); // heap check
        await checks[1](); // rss check
        return { status: 'ok', info: {}, error: {}, details: {} };
      });

      await controller.detailedCheck();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        expectedHeapThreshold,
      );
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        expectedRSSThreshold,
      );
    });
  });

  describe('disk storage configuration', () => {
    it('should use correct disk storage configuration', async () => {
      const expectedConfig = {
        thresholdPercent: 0.9,
        path: '/',
      };

      mockHealthCheckService.check.mockImplementation(async (checks) => {
        await checks[2](); // storage check
        return { status: 'ok', info: {}, error: {}, details: {} };
      });

      await controller.detailedCheck();

      expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'storage',
        expectedConfig,
      );
    });
  });

  describe('concurrent health checks', () => {
    it('should handle concurrent detailed health checks', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: { test: { status: 'up' } },
        error: {},
        details: { test: { status: 'up' } },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);

      // Execute multiple concurrent health checks
      const promises = Array(5)
        .fill(null)
        .map(() => controller.detailedCheck());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.status).toBe('ok');
      });
      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent simple health checks', () => {
      // Execute multiple concurrent simple checks
      const results = Array(10)
        .fill(null)
        .map(() => controller.check());

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toEqual({ status: 'ok' });
      });
    });
  });
});
