import express from 'express';
import helmet from 'helmet';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import type { Logger } from 'pino';
import { Login } from './application/use-cases/login.use-case.ts';
import { RecoverPassword } from './application/use-cases/recover-password.use-case.ts';
import { ResetPassword } from './application/use-cases/reset-password.use-case.ts';
import { ChangePassword } from './application/use-cases/change-password.use-case.ts';
import type { UserAccountRepository } from './domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from './domain/gateways/password-hasher.gateway.ts';
import type { TokenService } from './domain/gateways/token-service.gateway.ts';
import type { EventPublisher } from './domain/gateways/event-publisher.gateway.ts';
import { AuthController } from './infrastructure/http/controllers/auth.controller.ts';
import { createAuthRouter } from './infrastructure/http/routes/auth.routes.ts';
import { createHealthRouter, type HealthCheck } from './infrastructure/http/routes/health.routes.ts';
import documentationRouter from './infrastructure/http/routes/documentation.routes.ts';
import { createAuthenticator } from './infrastructure/http/middlewares/authenticate.middleware.ts';
import { errorHandler } from './infrastructure/http/middlewares/error-handler.middleware.ts';
import { createRequestLogger } from './infrastructure/http/middlewares/request-logger.middleware.ts';
import { sendError } from './infrastructure/http/responses/api.response.ts';
import { HTTP_STATUS } from './shared/constants/http-status.constants.ts';
import { ERROR_CODES } from './shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from './shared/constants/response-messages.constants.ts';

export function createApp(
  repository: UserAccountRepository,
  hasher: PasswordHasher,
  tokens: TokenService,
  eventPublisher: EventPublisher,
  logger: Logger,
  healthCheck: HealthCheck = async () => ({ application: 'UP' }),
) {
  const app = express();
  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'rhm_auth_' });
  const httpRequests = new Counter({
    name: 'rhm_http_requests_total',
    help: 'Total HTTP requests handled by auth-service',
    labelNames: ['service', 'method', 'status'] as const,
    registers: [metricsRegistry],
  });
  const httpDuration = new Histogram({ name: 'rhm_http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames: ['service', 'method', 'status'] as const, registers: [metricsRegistry] });
  const controller = new AuthController(
    new Login(repository, hasher, tokens),
    new RecoverPassword(repository, tokens, eventPublisher),
    new ResetPassword(repository, hasher, tokens, eventPublisher),
    new ChangePassword(repository, hasher),
  );

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const extractedContext = propagation.extract(context.active(), request.headers);
    trace.getTracer('auth-service').startActiveSpan(
      `${request.method} ${request.path}`,
      { kind: SpanKind.SERVER, attributes: { 'http.request.method': request.method, 'url.path': request.path } },
      extractedContext,
      (span) => {
        response.on('finish', () => {
          span.setAttribute('http.response.status_code', response.statusCode);
          span.end();
        });
        next();
      },
    );
  });
  app.use((request, response, next) => {
    const end = httpDuration.startTimer({ service: 'auth-service', method: request.method });
    response.on('finish', () => { const status = String(response.statusCode); httpRequests.inc({ service: 'auth-service', method: request.method, status }); end({ status }); });
    next();
  });
  app.get('/metrics', async (_request, response) => {
    response.setHeader('Content-Type', metricsRegistry.contentType);
    response.send(await metricsRegistry.metrics());
  });
  app.use(createRequestLogger(logger));
  app.use('/', documentationRouter);
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.use('/', createHealthRouter(healthCheck));
  app.use('/auth', createAuthRouter(controller, createAuthenticator(tokens)));

  app.use((_req, res) => {
    sendError(
      res,
      HTTP_STATUS.NOT_FOUND,
      RESPONSE_MESSAGES.resource.notFound,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      _req.originalUrl,
    );
  });
  app.use(errorHandler);

  return app;
}
