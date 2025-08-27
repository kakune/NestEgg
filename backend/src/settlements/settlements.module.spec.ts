import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsModule } from './settlements.module';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrismaService {
  settlement: {
    findMany: jest.MockedFunction<() => unknown>;
    findUnique: jest.MockedFunction<() => unknown>;
    create: jest.MockedFunction<() => unknown>;
    update: jest.MockedFunction<() => unknown>;
    delete: jest.MockedFunction<() => unknown>;
  };
  withContext: jest.MockedFunction<
    (
      authContext: unknown,
      callback: (prisma: MockPrismaService) => unknown,
    ) => unknown
  >;
}

// Mock the PrismaService to avoid database dependency
const mockPrismaService: MockPrismaService = {
  settlement: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  withContext: jest.fn(
    (authContext: unknown, callback: (prisma: MockPrismaService) => unknown) =>
      callback(mockPrismaService),
  ),
};

describe('SettlementsModule', () => {
  let module: TestingModule;
  let settlementsService: SettlementsService;
  let settlementsController: SettlementsController;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SettlementsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    settlementsService = module.get<SettlementsService>(SettlementsService);
    settlementsController = module.get<SettlementsController>(
      SettlementsController,
    );
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide SettlementsService', () => {
    expect(settlementsService).toBeDefined();
    expect(settlementsService).toBeInstanceOf(SettlementsService);
  });

  it('should provide SettlementsController', () => {
    expect(settlementsController).toBeDefined();
    expect(settlementsController).toBeInstanceOf(SettlementsController);
  });

  it('should export SettlementsService', () => {
    const exportedService = module.get<SettlementsService>(SettlementsService);
    expect(exportedService).toBeDefined();
    expect(exportedService).toBe(settlementsService);
  });

  describe('module configuration', () => {
    it('should have correct imports', () => {
      const imports = Reflect.getMetadata(
        'imports',
        SettlementsModule,
      ) as unknown[];
      expect(imports).toBeDefined();
      expect(Array.isArray(imports)).toBe(true);
    });

    it('should have correct controllers', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        SettlementsModule,
      ) as unknown[];
      expect(controllers).toContain(SettlementsController);
    });

    it('should have correct providers', () => {
      const providers = Reflect.getMetadata(
        'providers',
        SettlementsModule,
      ) as unknown[];
      expect(providers).toContain(SettlementsService);
    });

    it('should have correct exports', () => {
      const exports = Reflect.getMetadata(
        'exports',
        SettlementsModule,
      ) as unknown[];
      expect(exports).toContain(SettlementsService);
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies into SettlementsService', () => {
      expect(settlementsService).toBeDefined();
      // Service should be properly instantiated with its dependencies
    });

    it('should inject dependencies into SettlementsController', () => {
      expect(settlementsController).toBeDefined();
      // Controller should be properly instantiated with its dependencies
    });
  });

  describe('service-controller interaction', () => {
    it('should allow controller to access service', () => {
      const service = (
        settlementsController as unknown as {
          settlementsService: SettlementsService;
        }
      ).settlementsService;
      expect(service).toBeDefined();
      expect(service).toBe(settlementsService);
    });
  });
});
