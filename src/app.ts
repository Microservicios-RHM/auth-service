import express from 'express';
import helmet from 'helmet';
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
import healthRouter from './infrastructure/http/routes/health.routes.ts';
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
) {
  const app = express();
  const controller = new AuthController(
    new Login(repository, hasher, tokens),
    new RecoverPassword(repository, tokens, eventPublisher),
    new ResetPassword(repository, hasher, tokens, eventPublisher),
    new ChangePassword(repository, hasher),
  );

  app.disable('x-powered-by');
  app.use(createRequestLogger(logger));
  app.use('/', documentationRouter);
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.use('/', healthRouter);
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
