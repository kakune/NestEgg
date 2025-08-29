import configuration from './configuration';
import { ConfigurationResult, ConfigurationFactory } from './config.types';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no env vars are set', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.BCRYPT_ROUNDS;
    delete process.env.CORS_ORIGIN;
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.LOG_LEVEL;

    const config = configuration();

    expect(config).toEqual({
      database: {
        url: 'postgresql://user:password@localhost:5432/nestegg?schema=public',
      },
      jwt: {
        secret: 'your-secret-key',
        expiresIn: '7d',
      },
      app: {
        port: 3000,
        environment: 'development',
      },
      security: {
        bcryptRounds: 12,
        corsOrigin: 'http://localhost:5173',
        rateLimitTtl: 60,
        rateLimitMax: 100,
      },
      logging: {
        level: 'info',
        prettyPrint: false, // NODE_ENV is 'test' during jest execution
      },
    });
  });

  it('should use environment variables when provided', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-with-minimum-length';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'production';
    process.env.BCRYPT_ROUNDS = '10';
    process.env.CORS_ORIGIN = 'https://example.com';
    process.env.RATE_LIMIT_TTL = '120';
    process.env.RATE_LIMIT_MAX = '200';
    process.env.LOG_LEVEL = 'debug';

    const config = configuration();

    expect(config).toEqual({
      database: {
        url: 'postgresql://test:test@localhost:5432/test',
      },
      jwt: {
        secret: 'test-secret-key-with-minimum-length',
        expiresIn: '1d',
      },
      app: {
        port: 4000,
        environment: 'production',
      },
      security: {
        bcryptRounds: 10,
        corsOrigin: 'https://example.com',
        rateLimitTtl: 120,
        rateLimitMax: 200,
      },
      logging: {
        level: 'debug',
        prettyPrint: false,
      },
    });
  });

  it('should parse integer environment variables correctly', () => {
    process.env.PORT = '8080';
    process.env.BCRYPT_ROUNDS = '14';
    process.env.RATE_LIMIT_TTL = '30';
    process.env.RATE_LIMIT_MAX = '50';

    const config = configuration();

    expect(config.app.port).toBe(8080);
    expect(config.security.bcryptRounds).toBe(14);
    expect(config.security.rateLimitTtl).toBe(30);
    expect(config.security.rateLimitMax).toBe(50);
  });

  it('should handle invalid integer values by using NaN', () => {
    process.env.PORT = 'invalid';
    process.env.BCRYPT_ROUNDS = 'not-a-number';

    const config = configuration();

    expect(config.app.port).toBeNaN();
    expect(config.security.bcryptRounds).toBeNaN();
  });

  it('should set prettyPrint to true for development environment', () => {
    process.env.NODE_ENV = 'development';

    const config = configuration();

    expect(config.logging.prettyPrint).toBe(true);
  });

  it('should set prettyPrint to false for production environment', () => {
    process.env.NODE_ENV = 'production';

    const config = configuration();

    expect(config.logging.prettyPrint).toBe(false);
  });

  it('should set prettyPrint to false for test environment', () => {
    process.env.NODE_ENV = 'test';

    const config = configuration();

    expect(config.logging.prettyPrint).toBe(false);
  });

  it('should handle partial environment variables correctly', () => {
    process.env.JWT_SECRET = 'custom-secret-key-for-testing';
    process.env.PORT = '5000';

    const config = configuration();

    expect(config.jwt.secret).toBe('custom-secret-key-for-testing');
    expect(config.app.port).toBe(5000);
    expect(config.database.url).toBe(
      'postgresql://user:password@localhost:5432/nestegg?schema=public',
    );
    expect(config.jwt.expiresIn).toBe('7d');
  });

  it('should handle zero values correctly', () => {
    process.env.PORT = '0';
    process.env.RATE_LIMIT_TTL = '0';
    process.env.RATE_LIMIT_MAX = '0';

    const config = configuration();

    expect(config.app.port).toBe(0);
    expect(config.security.rateLimitTtl).toBe(0);
    expect(config.security.rateLimitMax).toBe(0);
  });

  it('should handle empty string environment variables', () => {
    process.env.DATABASE_URL = '';
    process.env.JWT_SECRET = '';
    process.env.CORS_ORIGIN = '';

    const config = configuration();

    expect(config.database.url).toBe(
      'postgresql://user:password@localhost:5432/nestegg?schema=public',
    );
    expect(config.jwt.secret).toBe('your-secret-key');
    expect(config.security.corsOrigin).toBe('http://localhost:5173');
  });

  it('should register configuration with proper namespace', () => {
    const configFactory = configuration as ConfigurationFactory;
    expect(configFactory.KEY).toBe('CONFIGURATION(config)');
  });

  describe('configuration structure', () => {
    let config: ConfigurationResult;

    beforeEach(() => {
      config = configuration();
    });

    it('should have database configuration section', () => {
      expect(config).toHaveProperty('database');
      expect(config.database).toHaveProperty('url');
      expect(typeof config.database.url).toBe('string');
    });

    it('should have JWT configuration section', () => {
      expect(config).toHaveProperty('jwt');
      expect(config.jwt).toHaveProperty('secret');
      expect(config.jwt).toHaveProperty('expiresIn');
      expect(typeof config.jwt.secret).toBe('string');
      expect(typeof config.jwt.expiresIn).toBe('string');
    });

    it('should have app configuration section', () => {
      expect(config).toHaveProperty('app');
      expect(config.app).toHaveProperty('port');
      expect(config.app).toHaveProperty('environment');
      expect(typeof config.app.port).toBe('number');
      expect(typeof config.app.environment).toBe('string');
    });

    it('should have security configuration section', () => {
      expect(config).toHaveProperty('security');
      expect(config.security).toHaveProperty('bcryptRounds');
      expect(config.security).toHaveProperty('corsOrigin');
      expect(config.security).toHaveProperty('rateLimitTtl');
      expect(config.security).toHaveProperty('rateLimitMax');
      expect(typeof config.security.bcryptRounds).toBe('number');
      expect(typeof config.security.corsOrigin).toBe('string');
      expect(typeof config.security.rateLimitTtl).toBe('number');
      expect(typeof config.security.rateLimitMax).toBe('number');
    });

    it('should have logging configuration section', () => {
      expect(config).toHaveProperty('logging');
      expect(config.logging).toHaveProperty('level');
      expect(config.logging).toHaveProperty('prettyPrint');
      expect(typeof config.logging.level).toBe('string');
      expect(typeof config.logging.prettyPrint).toBe('boolean');
    });
  });
});
