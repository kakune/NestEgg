import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsModule } from './transactions.module';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';

// Mock the PrismaService to avoid database dependency
const mockPrismaService: any = {
  transaction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  withContext: jest.fn(
    (authContext: unknown, callback: (prisma: unknown) => unknown) =>
      callback(mockPrismaService),
  ),
};

const mockActorsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockCategoriesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('TransactionsModule', () => {
  let module: TestingModule;
  let transactionsService: TransactionsService;
  let transactionsController: TransactionsController;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TransactionsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ActorsService)
      .useValue(mockActorsService)
      .overrideProvider(CategoriesService)
      .useValue(mockCategoriesService)
      .compile();

    transactionsService = module.get<TransactionsService>(TransactionsService);
    transactionsController = module.get<TransactionsController>(
      TransactionsController,
    );
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide TransactionsService', () => {
    expect(transactionsService).toBeDefined();
    expect(transactionsService).toBeInstanceOf(TransactionsService);
  });

  it('should provide TransactionsController', () => {
    expect(transactionsController).toBeDefined();
    expect(transactionsController).toBeInstanceOf(TransactionsController);
  });

  it('should export TransactionsService', () => {
    const exportedService =
      module.get<TransactionsService>(TransactionsService);
    expect(exportedService).toBeDefined();
    expect(exportedService).toBe(transactionsService);
  });

  describe('module configuration', () => {
    it('should have correct imports', () => {
      const imports = Reflect.getMetadata(
        'imports',
        TransactionsModule,
      ) as unknown[];
      expect(imports).toBeDefined();
      expect(Array.isArray(imports)).toBe(true);
      expect(imports.length).toBeGreaterThan(0);
    });

    it('should have correct controllers', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        TransactionsModule,
      ) as unknown[];
      expect(controllers).toContain(TransactionsController);
    });

    it('should have correct providers', () => {
      const providers = Reflect.getMetadata(
        'providers',
        TransactionsModule,
      ) as unknown[];
      expect(providers).toContain(TransactionsService);
    });

    it('should have correct exports', () => {
      const exports = Reflect.getMetadata(
        'exports',
        TransactionsModule,
      ) as unknown[];
      expect(exports).toContain(TransactionsService);
    });
  });

  describe('dependency injection', () => {
    it('should inject PrismaService into TransactionsService', () => {
      expect(transactionsService).toBeDefined();
      // Service should be properly instantiated with PrismaService
    });

    it('should inject TransactionsService into TransactionsController', () => {
      expect(transactionsController).toBeDefined();
      // Controller should be properly instantiated with TransactionsService
    });

    it('should make imported services available', () => {
      const actorsService = module.get<ActorsService>(ActorsService);
      const categoriesService =
        module.get<CategoriesService>(CategoriesService);

      expect(actorsService).toBeDefined();
      expect(categoriesService).toBeDefined();
    });
  });

  describe('service-controller interaction', () => {
    it('should allow controller to access service', () => {
      const service = (
        transactionsController as unknown as {
          transactionsService: TransactionsService;
        }
      ).transactionsService;
      expect(service).toBeDefined();
      expect(service).toBe(transactionsService);
    });
  });

  describe('cross-module dependencies', () => {
    it('should properly integrate with PrismaModule', () => {
      const prismaService = module.get<PrismaService>(PrismaService);
      expect(prismaService).toBeDefined();
    });

    it('should properly integrate with ActorsModule', () => {
      const actorsService = module.get<ActorsService>(ActorsService);
      expect(actorsService).toBeDefined();
    });

    it('should properly integrate with CategoriesModule', () => {
      const categoriesService =
        module.get<CategoriesService>(CategoriesService);
      expect(categoriesService).toBeDefined();
    });
  });
});
