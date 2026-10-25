import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from '../../domain/gateways/password-hasher.gateway.ts';
import type { IssuedToken, TokenService } from '../../domain/gateways/token-service.gateway.ts';
import { AppError } from '../../domain/errors/app.error.ts';
import { ACCOUNT_STATUS } from '../../shared/constants/account-status.constants.ts';
import { HTTP_STATUS } from '../../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../../shared/constants/response-messages.constants.ts';

export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

export class Login {
  private readonly repository: UserAccountRepository;
  private readonly hasher: PasswordHasher;
  private readonly tokens: TokenService;

  constructor(repository: UserAccountRepository, hasher: PasswordHasher, tokens: TokenService) {
    this.repository = repository;
    this.hasher = hasher;
    this.tokens = tokens;
  }

  async execute(input: LoginInput): Promise<IssuedToken> {
    const account = await this.repository.findByUsername(input.username.trim().toLowerCase());

    // Una cuenta inexistente y una contraseña equivocada devuelven el mismo error: distinguirlas
    // permitiría enumerar qué correos están registrados.
    if (!account?.passwordHash) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.invalidCredentials,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    if (account.estado === ACCOUNT_STATUS.TEMPORARILY_SUSPENDED) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.accountSuspended,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.ACCOUNT_SUSPENDED,
      );
    }

    if (account.estado === ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.accountDeactivated,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.ACCOUNT_DEACTIVATED,
      );
    }

    if (!(await this.hasher.verify(input.password, account.passwordHash))) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.invalidCredentials,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    return this.tokens.issueAccessToken({ sub: account.empleadoId, role: account.rol });
  }
}
