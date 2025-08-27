import { UsersModule } from './users.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

describe('UsersModule', () => {
  it('should be defined', () => {
    expect(UsersModule).toBeDefined();
  });

  it('should create module instance', () => {
    const moduleInstance = new UsersModule();
    expect(moduleInstance).toBeDefined();
  });

  describe('module configuration', () => {
    it('should have correct imports', () => {
      const imports = Reflect.getMetadata('imports', UsersModule) as unknown[];
      expect(imports).toBeDefined();
      expect(Array.isArray(imports)).toBe(true);
      expect(imports).toContain(PrismaModule);
    });

    it('should have correct controllers', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        UsersModule,
      ) as unknown[];
      expect(controllers).toBeDefined();
      expect(controllers).toContain(UsersController);
    });

    it('should have correct providers', () => {
      const providers = Reflect.getMetadata(
        'providers',
        UsersModule,
      ) as unknown[];
      expect(providers).toBeDefined();
      expect(providers).toContain(UsersService);
    });

    it('should have correct exports', () => {
      const exports = Reflect.getMetadata('exports', UsersModule) as unknown[];
      expect(exports).toBeDefined();
      expect(exports).toContain(UsersService);
    });

    it('should have all required metadata', () => {
      const imports = Reflect.getMetadata('imports', UsersModule) as unknown[];
      const controllers = Reflect.getMetadata(
        'controllers',
        UsersModule,
      ) as unknown[];
      const providers = Reflect.getMetadata(
        'providers',
        UsersModule,
      ) as unknown[];
      const exports = Reflect.getMetadata('exports', UsersModule) as unknown[];

      expect(imports).toBeDefined();
      expect(controllers).toBeDefined();
      expect(providers).toBeDefined();
      expect(exports).toBeDefined();
    });
  });

  describe('module structure', () => {
    it('should have exactly one import (PrismaModule)', () => {
      const imports = Reflect.getMetadata('imports', UsersModule) as unknown[];
      expect(imports.length).toBe(1);
      expect(imports[0]).toBe(PrismaModule);
    });

    it('should have exactly one controller', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        UsersModule,
      ) as unknown[];
      expect(controllers.length).toBe(1);
      expect(controllers[0]).toBe(UsersController);
    });

    it('should have exactly one provider', () => {
      const providers = Reflect.getMetadata(
        'providers',
        UsersModule,
      ) as unknown[];
      expect(providers.length).toBe(1);
      expect(providers[0]).toBe(UsersService);
    });

    it('should have exactly one export', () => {
      const exports = Reflect.getMetadata('exports', UsersModule) as unknown[];
      expect(exports.length).toBe(1);
      expect(exports[0]).toBe(UsersService);
    });
  });

  describe('module metadata validation', () => {
    it('should have all required metadata properties', () => {
      const imports = Reflect.getMetadata('imports', UsersModule) as unknown[];
      const controllers = Reflect.getMetadata(
        'controllers',
        UsersModule,
      ) as unknown[];
      const providers = Reflect.getMetadata(
        'providers',
        UsersModule,
      ) as unknown[];
      const exports = Reflect.getMetadata('exports', UsersModule) as unknown[];

      expect(imports).toBeTruthy();
      expect(controllers).toBeTruthy();
      expect(providers).toBeTruthy();
      expect(exports).toBeTruthy();
    });

    it('should have proper service-controller relationship', () => {
      const controllers = Reflect.getMetadata(
        'controllers',
        UsersModule,
      ) as unknown[];
      const providers = Reflect.getMetadata(
        'providers',
        UsersModule,
      ) as unknown[];

      expect(controllers).toContain(UsersController);
      expect(providers).toContain(UsersService);
    });
  });
});
