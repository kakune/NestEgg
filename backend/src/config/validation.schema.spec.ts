import { validationSchema } from './validation.schema';

interface ValidationResult {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: number;
  NODE_ENV: string;
  BCRYPT_ROUNDS: number;
  CORS_ORIGIN: string;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;
  LOG_LEVEL: string;
  PRETTY_PRINT_LOGS: string;
}

interface ValidationError {
  error?: {
    details: unknown[];
  };
}

interface ValidationSuccess {
  value: ValidationResult;
}

describe('ValidationSchema', () => {
  describe('DATABASE_URL', () => {
    it('should require DATABASE_URL', () => {
      const result = validationSchema.validate({}) as ValidationError;
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['DATABASE_URL'],
            type: 'any.required',
          }),
        ]),
      );
    });

    it('should accept valid DATABASE_URL', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect(result.error).toBeUndefined();
    });

    it('should accept any string as DATABASE_URL', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'any-string-value',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe('JWT_SECRET', () => {
    it('should require JWT_SECRET', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['JWT_SECRET'],
            type: 'any.required',
          }),
        ]),
      );
    });

    it('should require JWT_SECRET to be at least 32 characters', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'short-key',
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['JWT_SECRET'],
            type: 'string.min',
          }),
        ]),
      );
    });

    it('should accept JWT_SECRET with 32 or more characters', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe('JWT_EXPIRES_IN', () => {
    it('should default JWT_EXPIRES_IN to "7d"', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      }) as ValidationSuccess;
      expect(result.value.JWT_EXPIRES_IN).toBe('7d');
    });

    it('should accept custom JWT_EXPIRES_IN', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        JWT_EXPIRES_IN: '1h',
      }) as ValidationSuccess;
      expect(result.value.JWT_EXPIRES_IN).toBe('1h');
    });
  });

  describe('PORT', () => {
    it('should default PORT to 3000', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).PORT).toBe(3000);
    });

    it('should accept valid port numbers', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        PORT: 8080,
      });
      expect((result.value as ValidationResult).PORT).toBe(8080);
    });

    it('should reject invalid port numbers', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        PORT: 70000,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['PORT'],
            type: 'number.port',
          }),
        ]),
      );
    });

    it('should reject negative port numbers', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        PORT: -1,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['PORT'],
            type: 'number.port',
          }),
        ]),
      );
    });
  });

  describe('NODE_ENV', () => {
    it('should default NODE_ENV to "development"', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).NODE_ENV).toBe('development');
    });

    it('should accept valid NODE_ENV values', () => {
      const validEnvironments = ['development', 'production', 'test'];

      for (const env of validEnvironments) {
        const result = validationSchema.validate({
          DATABASE_URL: 'test',
          JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
          NODE_ENV: env,
        });
        expect(result.error).toBeUndefined();
        expect((result.value as ValidationResult).NODE_ENV).toBe(env);
      }
    });

    it('should reject invalid NODE_ENV values', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        NODE_ENV: 'invalid-env',
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['NODE_ENV'],
            type: 'any.only',
          }),
        ]),
      );
    });
  });

  describe('BCRYPT_ROUNDS', () => {
    it('should default BCRYPT_ROUNDS to 12', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).BCRYPT_ROUNDS).toBe(12);
    });

    it('should accept valid BCRYPT_ROUNDS values', () => {
      const validRounds = [10, 11, 12, 13, 14, 15];

      for (const rounds of validRounds) {
        const result = validationSchema.validate({
          DATABASE_URL: 'test',
          JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
          BCRYPT_ROUNDS: rounds,
        });
        expect(result.error).toBeUndefined();
        expect((result.value as ValidationResult).BCRYPT_ROUNDS).toBe(rounds);
      }
    });

    it('should reject BCRYPT_ROUNDS below 10', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        BCRYPT_ROUNDS: 9,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['BCRYPT_ROUNDS'],
            type: 'number.min',
          }),
        ]),
      );
    });

    it('should reject BCRYPT_ROUNDS above 15', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        BCRYPT_ROUNDS: 16,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['BCRYPT_ROUNDS'],
            type: 'number.max',
          }),
        ]),
      );
    });

    it('should reject non-integer BCRYPT_ROUNDS', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        BCRYPT_ROUNDS: 12.5,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['BCRYPT_ROUNDS'],
            type: 'number.integer',
          }),
        ]),
      );
    });
  });

  describe('CORS_ORIGIN', () => {
    it('should default CORS_ORIGIN to "http://localhost:5173"', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).CORS_ORIGIN).toBe(
        'http://localhost:5173',
      );
    });

    it('should accept valid URI for CORS_ORIGIN', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        CORS_ORIGIN: 'https://example.com',
      });
      expect(result.error).toBeUndefined();
      expect((result.value as ValidationResult).CORS_ORIGIN).toBe(
        'https://example.com',
      );
    });

    it('should reject invalid URI for CORS_ORIGIN', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        CORS_ORIGIN: 'not-a-valid-uri',
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['CORS_ORIGIN'],
            type: 'string.uri',
          }),
        ]),
      );
    });
  });

  describe('RATE_LIMIT_TTL', () => {
    it('should default RATE_LIMIT_TTL to 60', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).RATE_LIMIT_TTL).toBe(60);
    });

    it('should accept positive integers for RATE_LIMIT_TTL', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_TTL: 120,
      });
      expect(result.error).toBeUndefined();
      expect((result.value as ValidationResult).RATE_LIMIT_TTL).toBe(120);
    });

    it('should reject zero or negative RATE_LIMIT_TTL', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_TTL: 0,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['RATE_LIMIT_TTL'],
            type: 'number.positive',
          }),
        ]),
      );
    });

    it('should reject non-integer RATE_LIMIT_TTL', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_TTL: 60.5,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['RATE_LIMIT_TTL'],
            type: 'number.integer',
          }),
        ]),
      );
    });
  });

  describe('RATE_LIMIT_MAX', () => {
    it('should default RATE_LIMIT_MAX to 100', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).RATE_LIMIT_MAX).toBe(100);
    });

    it('should accept positive integers for RATE_LIMIT_MAX', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_MAX: 200,
      });
      expect(result.error).toBeUndefined();
      expect((result.value as ValidationResult).RATE_LIMIT_MAX).toBe(200);
    });

    it('should reject zero or negative RATE_LIMIT_MAX', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_MAX: -1,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['RATE_LIMIT_MAX'],
            type: 'number.positive',
          }),
        ]),
      );
    });

    it('should reject non-integer RATE_LIMIT_MAX', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        RATE_LIMIT_MAX: 100.5,
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['RATE_LIMIT_MAX'],
            type: 'number.integer',
          }),
        ]),
      );
    });
  });

  describe('LOG_LEVEL', () => {
    it('should default LOG_LEVEL to "info"', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect((result.value as ValidationResult).LOG_LEVEL).toBe('info');
    });

    it('should accept valid LOG_LEVEL values', () => {
      const validLogLevels = [
        'fatal',
        'error',
        'warn',
        'info',
        'debug',
        'trace',
      ];

      for (const level of validLogLevels) {
        const result = validationSchema.validate({
          DATABASE_URL: 'test',
          JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
          LOG_LEVEL: level,
        });
        expect(result.error).toBeUndefined();
        expect((result.value as ValidationResult).LOG_LEVEL).toBe(level);
      }
    });

    it('should reject invalid LOG_LEVEL values', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'test',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        LOG_LEVEL: 'invalid-level',
      });
      expect(result.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['LOG_LEVEL'],
            type: 'any.only',
          }),
        ]),
      );
    });
  });

  describe('complete validation', () => {
    it('should pass with all valid values', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
        JWT_EXPIRES_IN: '1d',
        PORT: 3000,
        NODE_ENV: 'production',
        BCRYPT_ROUNDS: 12,
        CORS_ORIGIN: 'https://example.com',
        RATE_LIMIT_TTL: 60,
        RATE_LIMIT_MAX: 100,
        LOG_LEVEL: 'info',
      });
      expect(result.error).toBeUndefined();
    });

    it('should pass with only required values', () => {
      const result = validationSchema.validate({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
        JWT_SECRET: 'this-is-a-very-long-secret-key-with-32-chars',
      });
      expect(result.error).toBeUndefined();
    });

    it('should fail with missing required values', () => {
      const result = validationSchema.validate({
        PORT: 3000,
      });
      expect(result.error).toBeDefined();
      expect(result.error?.details.length).toBeGreaterThanOrEqual(1); // DATABASE_URL and JWT_SECRET are required
    });
  });
});
