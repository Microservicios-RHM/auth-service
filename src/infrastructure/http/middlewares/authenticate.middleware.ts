import type { RequestHandler } from 'express';
import type {
  AccessTokenClaims,
  TokenService,
} from '../../../domain/gateways/token-service.gateway.ts';
import { AppError } from '../../../domain/errors/app.error.ts';
import { HTTP_STATUS } from '../../../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../../../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../../../shared/constants/response-messages.constants.ts';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

// El Gateway ya valida el token antes de enrutar, pero /auth/change-password necesita saber *quién*
// es el solicitante para cambiar su propia contraseña, y auth-service es el dueño del secreto.
export function createAuthenticator(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith(BEARER_PREFIX)) {
      next(
        new AppError(
          RESPONSE_MESSAGES.auth.missingToken,
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
        ),
      );
      return;
    }

    try {
      req.auth = tokens.verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());
      next();
    } catch (error) {
      next(error);
    }
  };
}
