import jwt from 'jsonwebtoken';
import type { TokenConfig } from '../../config/environment.config.ts';
import type {
  AccessTokenClaims,
  IssuedToken,
  TokenService,
} from '../../domain/gateways/token-service.gateway.ts';
import { AppError } from '../../domain/errors/app.error.ts';
import { ACCOUNT_ROLES } from '../../shared/constants/account-status.constants.ts';
import { HTTP_STATUS } from '../../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../../shared/constants/response-messages.constants.ts';

const RESET_TOKEN_TYPE = 'RESET_PASSWORD';
const SIGNING_ALGORITHM = 'HS256';

export class JwtTokenService implements TokenService {
  private readonly config: TokenConfig;

  constructor(config: TokenConfig) {
    this.config = config;
  }

  issueAccessToken(claims: AccessTokenClaims): IssuedToken {
    return this.sign({ sub: claims.sub, role: claims.role }, this.config.accessTtlSeconds);
  }

  // El claim `type` es lo que impide usar un token de restablecimiento como token de acceso: aunque
  // ambos estén firmados con el mismo secreto, verifyAccessToken rechaza cualquiera que lo traiga.
  issueResetToken(empleadoId: string): IssuedToken {
    return this.sign({ sub: empleadoId, type: RESET_TOKEN_TYPE }, this.config.resetTtlSeconds);
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const payload = this.verify(token);
    const role = payload.role;
    if (payload.type || (role !== ACCOUNT_ROLES.ADMIN && role !== ACCOUNT_ROLES.USER)) {
      throw this.invalidToken();
    }
    return { sub: String(payload.sub), role };
  }

  verifyResetToken(token: string): string {
    const payload = this.verify(token);
    if (payload.type !== RESET_TOKEN_TYPE) throw this.invalidToken();
    return String(payload.sub);
  }

  private sign(payload: Record<string, unknown>, ttlSeconds: number): IssuedToken {
    const token = jwt.sign(payload, this.config.secret, {
      algorithm: SIGNING_ALGORITHM,
      issuer: this.config.issuer,
      expiresIn: ttlSeconds,
    });
    return {
      token,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  private verify(token: string): jwt.JwtPayload & { type?: string; role?: string } {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [SIGNING_ALGORITHM],
        issuer: this.config.issuer,
      });
      if (typeof payload === 'string') throw this.invalidToken();
      return payload;
    } catch {
      throw this.invalidToken();
    }
  }

  private invalidToken(): AppError {
    return new AppError(
      RESPONSE_MESSAGES.auth.invalidToken,
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_TOKEN,
    );
  }
}
