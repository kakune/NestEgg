export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AppConfig {
  port: number;
  environment: string;
}

export interface SecurityConfig {
  bcryptRounds: number;
  corsOrigin: string;
  rateLimitTtl: number;
  rateLimitMax: number;
}

export interface LoggingConfig {
  level: string;
  prettyPrint: boolean;
}

export interface ConfigurationResult {
  database: DatabaseConfig;
  jwt: JwtConfig;
  app: AppConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

export interface ConfigurationFactory {
  (): ConfigurationResult;
  KEY: string;
}
