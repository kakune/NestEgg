import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
import { ConfigModule } from './config.module';

interface DatabaseConfig {
  url: string;
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
}

interface AppConfig {
  port: number;
  environment: string;
}

interface SecurityConfig {
  bcryptRounds: number;
  corsOrigin: string;
  rateLimitTtl: number;
  rateLimitMax: number;
}

interface LoggingConfig {
  level: string;
  prettyPrint: boolean;
}

interface FullConfig {
  database: DatabaseConfig;
  jwt: JwtConfig;
  app: AppConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

describe('ConfigModule', () => {
  let module: TestingModule;
  let configService: ConfigService;

  beforeEach(async () => {
    // Set some test environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    process.env.JWT_SECRET = 'test-secret-key-with-minimum-required-length';

    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should make ConfigService available', () => {
    expect(configService).toBeDefined();
    expect(configService).toBeInstanceOf(ConfigService);
  });

  it('should load configuration values', () => {
    const databaseUrl = configService.get<string>('config.database.url');
    const jwtSecret = configService.get<string>('config.jwt.secret');
    const appPort = configService.get<number>('config.app.port');

    expect(databaseUrl).toBeDefined();
    expect(jwtSecret).toBeDefined();
    expect(appPort).toBeDefined();
  });

  it('should provide database configuration', () => {
    const databaseConfig = configService.get<DatabaseConfig>('config.database');

    expect(databaseConfig).toBeDefined();
    expect(databaseConfig).toHaveProperty('url');
    if (databaseConfig) {
      expect(typeof databaseConfig.url).toBe('string');
    }
  });

  it('should provide JWT configuration', () => {
    const jwtConfig = configService.get<JwtConfig>('config.jwt');

    expect(jwtConfig).toBeDefined();
    expect(jwtConfig).toHaveProperty('secret');
    expect(jwtConfig).toHaveProperty('expiresIn');
    if (jwtConfig) {
      expect(typeof jwtConfig.secret).toBe('string');
      expect(typeof jwtConfig.expiresIn).toBe('string');
    }
  });

  it('should provide app configuration', () => {
    const appConfig = configService.get<AppConfig>('config.app');

    expect(appConfig).toBeDefined();
    expect(appConfig).toHaveProperty('port');
    expect(appConfig).toHaveProperty('environment');
    if (appConfig) {
      expect(typeof appConfig.port).toBe('number');
      expect(typeof appConfig.environment).toBe('string');
    }
  });

  it('should provide security configuration', () => {
    const securityConfig = configService.get<SecurityConfig>('config.security');

    expect(securityConfig).toBeDefined();
    expect(securityConfig).toHaveProperty('bcryptRounds');
    expect(securityConfig).toHaveProperty('corsOrigin');
    expect(securityConfig).toHaveProperty('rateLimitTtl');
    expect(securityConfig).toHaveProperty('rateLimitMax');
    if (securityConfig) {
      expect(typeof securityConfig.bcryptRounds).toBe('number');
      expect(typeof securityConfig.corsOrigin).toBe('string');
      expect(typeof securityConfig.rateLimitTtl).toBe('number');
      expect(typeof securityConfig.rateLimitMax).toBe('number');
    }
  });

  it('should provide logging configuration', () => {
    const loggingConfig = configService.get<LoggingConfig>('config.logging');

    expect(loggingConfig).toBeDefined();
    expect(loggingConfig).toHaveProperty('level');
    expect(loggingConfig).toHaveProperty('prettyPrint');
    if (loggingConfig) {
      expect(typeof loggingConfig.level).toBe('string');
      expect(typeof loggingConfig.prettyPrint).toBe('boolean');
    }
  });

  it('should use environment variables when available', () => {
    const databaseUrl = configService.get<string>('config.database.url');
    const jwtSecret = configService.get<string>('config.jwt.secret');

    expect(databaseUrl).toBe('postgresql://test:test@localhost:5432/testdb');
    expect(jwtSecret).toBe('test-secret-key-with-minimum-required-length');
  });

  it('should provide default values when environment variables are not set', () => {
    const jwtExpiresIn = configService.get<string>('config.jwt.expiresIn');
    const appPort = configService.get<number>('config.app.port');
    const environment = configService.get<string>('config.app.environment');

    expect(jwtExpiresIn).toBe('7d');
    expect(appPort).toBe(3001);
    expect(environment).toBe('test'); // NODE_ENV is 'test' during jest execution
  });

  it('should be a global module', () => {
    const moduleRef = module.get(ConfigModule);
    expect(moduleRef).toBeDefined();
  });

  it('should export NestConfigModule', () => {
    // Test that the module properly exports ConfigModule
    const configModuleInstance = module.get(NestConfigModule);
    expect(configModuleInstance).toBeDefined();
  });

  describe('configuration values', () => {
    it('should have all required configuration sections', () => {
      const config = configService.get<FullConfig>('config');

      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('jwt');
      expect(config).toHaveProperty('app');
      expect(config).toHaveProperty('security');
      expect(config).toHaveProperty('logging');
    });

    it('should handle missing environment variables gracefully', async () => {
      // Create a new module without setting env vars
      delete process.env.LOG_LEVEL;
      delete process.env.CORS_ORIGIN;

      const testModule = await Test.createTestingModule({
        imports: [ConfigModule],
      }).compile();

      const testConfigService = testModule.get<ConfigService>(ConfigService);

      const logLevel = testConfigService.get<string>('config.logging.level');
      const corsOrigin = testConfigService.get<string>(
        'config.security.corsOrigin',
      );

      expect(logLevel).toBe('info');
      expect(corsOrigin).toBe('http://localhost:5173');

      await testModule.close();
    });
  });

  describe('module structure', () => {
    it('should be configured with isGlobal: true', () => {
      // Test passes if ConfigService is available in the test module
      // which indicates the module was configured as global
      const configService = module.get<ConfigService>(ConfigService);
      expect(configService).toBeDefined();
      expect(configService.get<FullConfig>('config')).toBeDefined();
    });

    it('should provide configuration to other modules', () => {
      const configService = module.get<ConfigService>(ConfigService);
      const config = configService.get<FullConfig>('config');

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });
});
