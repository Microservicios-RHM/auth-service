import http from 'node:http';
import { createApp } from './app.ts';
import { loadConfig } from './config/environment.config.ts';
import { createPostgresPool } from './infrastructure/persistence/postgres/postgres.client.ts';
import { waitForPostgres } from './infrastructure/persistence/postgres/postgres-readiness.ts';
import { runMigrations } from './infrastructure/persistence/postgres/migrations/migration.runner.ts';
import { PostgresUserAccountRepository } from './infrastructure/persistence/postgres/postgres-user-account.repository.ts';
import { PostgresProcessedEventRepository } from './infrastructure/persistence/postgres/postgres-processed-event.repository.ts';
import { createLogger } from './infrastructure/logging/pino.logger.ts';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password.hasher.ts';
import { JwtTokenService } from './infrastructure/security/jwt-token.service.ts';
import { RabbitMqConnection } from './infrastructure/messaging/rabbitmq/rabbitmq.connection.ts';
import { RabbitmqEventPublisher } from './infrastructure/messaging/rabbitmq/rabbitmq-event.publisher.ts';
import { RabbitmqEventConsumer } from './infrastructure/messaging/rabbitmq/rabbitmq-event.consumer.ts';
import { EnsureSeedAdmin } from './application/use-cases/ensure-seed-admin.use-case.ts';
import {
  CreateAccountFromEmployee,
  type EmployeeCreatedData,
} from './application/use-cases/create-account-from-employee.use-case.ts';
import { DeactivateAccount } from './application/use-cases/deactivate-account.use-case.ts';
import { ReactivateAccount } from './application/use-cases/reactivate-account.use-case.ts';
import {
  CONSUMED_EVENT_TYPES,
  EVENT_PRODUCER,
} from './shared/constants/event-types.constants.ts';
import { DEACTIVATION_REASONS } from './shared/constants/account-status.constants.ts';

const config = loadConfig();
const logger = createLogger(config.logging);
const pool = createPostgresPool(config.database, logger);
const brokerConnection = new RabbitMqConnection(config.broker, logger);

async function bootstrap(): Promise<void> {
  logger.info(
    {
      database: {
        host: config.database.host,
        port: config.database.port,
        name: config.database.database,
        schema: config.database.schema,
        user: config.database.user,
      },
    },
    'Connecting to PostgreSQL',
  );

  await waitForPostgres(pool, config.database, logger);
  const appliedMigrations = await runMigrations(pool, config.database.schema);
  for (const migration of appliedMigrations) {
    logger.info({ migration }, 'Database migration applied');
  }
  logger.info('PostgreSQL connection ready');

  const repository = new PostgresUserAccountRepository(pool, config.database.schema);
  const processedEvents = new PostgresProcessedEventRepository(pool, config.database.schema);
  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenService(config.tokens);

  await new EnsureSeedAdmin(repository, hasher, logger).execute(config.seedAdmin);

  logger.info(
    { exchange: config.broker.exchange, queue: config.broker.queue },
    'Connecting to RabbitMQ',
  );
  await brokerConnection.connect();

  const eventPublisher = new RabbitmqEventPublisher(
    brokerConnection,
    config.broker.exchange,
    EVENT_PRODUCER,
    logger,
  );

  const createAccount = new CreateAccountFromEmployee(repository, tokens, eventPublisher, logger);
  const deactivateAccount = new DeactivateAccount(repository, eventPublisher, logger);
  const reactivateAccount = new ReactivateAccount(repository, eventPublisher, logger);

  const consumer = new RabbitmqEventConsumer(
    brokerConnection,
    config.broker.exchange,
    config.broker.queue,
    processedEvents,
    logger,
  );

  consumer.on(CONSUMED_EVENT_TYPES.EMPLOYEE_CREATED, async (envelope) => {
    await createAccount.execute(envelope.data as EmployeeCreatedData);
  });
  consumer.on(CONSUMED_EVENT_TYPES.EMPLOYEE_RETIRED, async (envelope) => {
    const { id } = envelope.data as { id: string };
    await deactivateAccount.execute({
      empleadoId: id,
      motivo: DEACTIVATION_REASONS.RETIREMENT,
      permanente: true,
    });
  });
  consumer.on(CONSUMED_EVENT_TYPES.VACATION_STARTED, async (envelope) => {
    const { empleadoId } = envelope.data as { empleadoId: string };
    await deactivateAccount.execute({
      empleadoId,
      motivo: DEACTIVATION_REASONS.VACATION,
      permanente: false,
    });
  });
  consumer.on(CONSUMED_EVENT_TYPES.VACATION_FINISHED, async (envelope) => {
    const { empleadoId } = envelope.data as { empleadoId: string };
    await reactivateAccount.execute(empleadoId);
  });

  await consumer.start();

  const app = createApp(repository, hasher, tokens, eventPublisher, logger);
  const server = http.createServer(app);

  server.listen(config.port, '0.0.0.0', () => {
    logger.info({ port: config.port }, 'Auth service started');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Graceful shutdown started');
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'HTTP server shutdown failed');
        process.exitCode = 1;
      }
      consumer.stop();
      await brokerConnection.close();
      await pool.end();
      logger.info('Auth service stopped');
      process.exit();
    });
  };

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => shutdown(signal));
  }
}

bootstrap().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Auth service failed to start');
  await brokerConnection.close().catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
