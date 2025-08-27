import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule', () => {
  it('should be defined', () => {
    expect(PrismaModule).toBeDefined();
  });

  it('should create module instance', () => {
    const moduleInstance = new PrismaModule();
    expect(moduleInstance).toBeDefined();
  });

  describe('module configuration', () => {
    it('should have correct providers', () => {
      const providers = Reflect.getMetadata(
        'providers',
        PrismaModule,
      ) as unknown[];
      expect(providers).toBeDefined();
      expect(providers).toContain(PrismaService);
    });

    it('should have correct exports', () => {
      const exports = Reflect.getMetadata('exports', PrismaModule) as unknown[];
      expect(exports).toBeDefined();
      expect(exports).toContain(PrismaService);
    });

    it('should have module metadata', () => {
      const providers = Reflect.getMetadata(
        'providers',
        PrismaModule,
      ) as unknown[];
      const exports = Reflect.getMetadata('exports', PrismaModule) as unknown[];

      expect(providers).toBeDefined();
      expect(exports).toBeDefined();
    });
  });

  describe('module structure', () => {
    it('should have providers array with PrismaService', () => {
      const providers = Reflect.getMetadata(
        'providers',
        PrismaModule,
      ) as unknown[];
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBe(1);
      expect(providers[0]).toBe(PrismaService);
    });

    it('should have exports array with PrismaService', () => {
      const exports = Reflect.getMetadata('exports', PrismaModule) as unknown[];
      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBe(1);
      expect(exports[0]).toBe(PrismaService);
    });

    it('should not have imports', () => {
      const imports = Reflect.getMetadata('imports', PrismaModule) as unknown;
      expect(imports).toBeUndefined();
    });

    it('should not have controllers', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        PrismaModule,
      ) as unknown;
      expect(controllers).toBeUndefined();
    });
  });
});
