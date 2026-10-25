import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from '../../domain/gateways/password-hasher.gateway.ts';
import { AppError } from '../../domain/errors/app.error.ts';
import { assertPasswordPolicy } from '../../domain/password-policy.ts';
import { ACCOUNT_STATUS } from '../../shared/constants/account-status.constants.ts';
import { HTTP_STATUS } from '../../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../../shared/constants/response-messages.constants.ts';

export interface ChangePasswordInput {
  readonly empleadoId: string;
  readonly passwordActual: string;
  readonly nuevaPassword: string;
}

export class ChangePassword {
  private readonly repository: UserAccountRepository;
  private readonly hasher: PasswordHasher;

  constructor(repository: UserAccountRepository, hasher: PasswordHasher) {
    this.repository = repository;
    this.hasher = hasher;
  }

  async execute(input: ChangePasswordInput): Promise<void> {
    assertPasswordPolicy(input.nuevaPassword);

    const account = await this.repository.findByEmployeeId(input.empleadoId);

    if (!account?.passwordHash) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.invalidCredentials,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    if (!(await this.hasher.verify(input.passwordActual, account.passwordHash))) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.invalidCredentials,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    if (await this.hasher.verify(input.nuevaPassword, account.passwordHash)) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.samePassword,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.WEAK_PASSWORD,
      );
    }

    const passwordHash = await this.hasher.hash(input.nuevaPassword);
    await this.repository.updatePassword(
      account.empleadoId,
      passwordHash,
      account.estado === ACCOUNT_STATUS.PENDING_ACTIVATION ? ACCOUNT_STATUS.ACTIVE : account.estado,
    );
  }
}
