import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).default('false'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().trim().min(1),
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/i).default('auth'),
  DB_USER: z.string().trim().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_CONNECT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  DB_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(30_000).default(1000),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().trim().min(1).default('auth-service'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
  JWT_RESET_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  ADMIN_EMPLOYEE_ID: z.string().trim().min(1).default('ADMIN'),
  ADMIN_USERNAME: z.string().trim().min(1),
  ADMIN_EMAIL: z.string().trim().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  BROKER_URL: z.string().trim().min(1),
  BROKER_EXCHANGE: z.string().trim().min(1).default('rhm.events'),
  BROKER_QUEUE: z.string().trim().min(1).default('auth.queue'),
  BROKER_CONNECT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  BROKER_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(30_000).default(1000),
});

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly schema: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly poolMax: number;
  readonly connectMaxAttempts: number;
  readonly connectRetryDelayMs: number;
}

export interface LoggingConfig {
  readonly environment: 'development' | 'test' | 'production';
  readonly level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly pretty: boolean;
}

export interface TokenConfig {
  readonly secret: string;
  readonly issuer: string;
  readonly accessTtlSeconds: number;
  readonly resetTtlSeconds: number;
}

export interface SeedAdminConfig {
  readonly empleadoId: string;
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

export interface BrokerConfig {
  readonly url: string;
  readonly exchange: string;
  readonly queue: string;
  readonly connectMaxAttempts: number;
  readonly connectRetryDelayMs: number;
}

export interface AppConfig {
  readonly port: number;
  readonly database: DatabaseConfig;
  readonly logging: LoggingConfig;
  readonly tokens: TokenConfig;
  readonly seedAdmin: SeedAdminConfig;
  readonly broker: BrokerConfig;
}

export function loadConfig(): AppConfig {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuración inválida o incompleta: ${missing}`);
  }

  const env = result.data;
  return {
    port: env.PORT,
    logging: {
      environment: env.NODE_ENV,
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY === 'true',
    },
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      schema: env.DB_SCHEMA,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL === 'true',
      poolMax: env.DB_POOL_MAX,
      connectMaxAttempts: env.DB_CONNECT_MAX_ATTEMPTS,
      connectRetryDelayMs: env.DB_CONNECT_RETRY_DELAY_MS,
    },
    tokens: {
      secret: env.JWT_SECRET,
      issuer: env.JWT_ISSUER,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      resetTtlSeconds: env.JWT_RESET_TTL_SECONDS,
    },
    seedAdmin: {
      empleadoId: env.ADMIN_EMPLOYEE_ID,
      username: env.ADMIN_USERNAME,
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    },
    broker: {
      url: env.BROKER_URL,
      exchange: env.BROKER_EXCHANGE,
      queue: env.BROKER_QUEUE,
      connectMaxAttempts: env.BROKER_CONNECT_MAX_ATTEMPTS,
      connectRetryDelayMs: env.BROKER_CONNECT_RETRY_DELAY_MS,
    },
  };
}
