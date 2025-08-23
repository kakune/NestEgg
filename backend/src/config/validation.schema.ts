import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection URL'),

  // JWT
  JWT_SECRET: Joi.string().min(32).required().description('JWT secret key (min 32 chars)'),
  JWT_EXPIRES_IN: Joi.string().default('7d').description('JWT expiration time'),

  // Application
  PORT: Joi.number().port().default(3000).description('Application port'),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .description('Application environment'),

  // Security
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12).description('BCrypt rounds'),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:5173').description('CORS allowed origin'),
  RATE_LIMIT_TTL: Joi.number().integer().positive().default(60).description('Rate limit TTL in seconds'),
  RATE_LIMIT_MAX: Joi.number().integer().positive().default(100).description('Max requests per TTL'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info')
    .description('Pino log level'),
});