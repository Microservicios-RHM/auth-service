import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from '../../domain/gateways/password-hasher.gateway.ts';
import type { TokenService } from '../../domain/gateways/token-service.gateway.ts';
import type { EventPublisher } from '../../domain/gateways/event-publisher.gateway.ts';
import { AppError } from '../../domain/errors/app.error.ts';
import { assertPasswordPolicy } from '../../domain/password-policy.ts';
import {
  ACCOUNT_STATUS,
  ACTIVATION_REASONS,
} from '../../shared/constants/account-status.constants.ts';
import { PUBLISHED_EVENT_TYPES } from '../../shared/constants/event-types.constants.ts';
import { HTTP_STATUS } from '../../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../../shared/constants/response-messages.constants.ts';

export interface ResetPasswordInput {
  readonly token: string;
  readonly nuevaPassword: string;
}

export class ResetPassword {
  private readonly repository: UserAccountRepository;
  private readonly hasher: PasswordHasher;
  private readonly tokens: TokenService;
  private readonly publisher: EventPublisher;

  constructor(
    repository: UserAccountRepository,
    hasher: PasswordHasher,
    tokens: TokenService,
    publisher: EventPublisher,
  ) {
    this.repository = repository;
    this.hasher = hasher;
    this.tokens = tokens;
    this.publisher = publisher;
  }

  async execute(input: ResetPasswordInput): Promise<void> {
    assertPasswordPolicy(input.nuevaPassword);

    const empleadoId = this.tokens.verifyResetToken(input.token);
    const account = await this.repository.findByEmployeeId(empleadoId);

    if (!account) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.invalidToken,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN,
      );
    }

    if (account.estado === ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED) {
      throw new AppError(
        RESPONSE_MESSAGES.auth.accountDeactivated,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.ACCOUNT_DEACTIVATED,
      );
    }

    // Una cuenta suspendida por vacaciones puede establecer su contraseña, pero no se reactiva
    // con ello: solo vacaciones.finalizadas la devuelve a ACTIVA.
    const activating = account.estado === ACCOUNT_STATUS.PENDING_ACTIVATION;
    const nextStatus = activating ? ACCOUNT_STATUS.ACTIVE : account.estado;

    const passwordHash = await this.hasher.hash(input.nuevaPassword);
    await this.repository.updatePassword(account.empleadoId, passwordHash, nextStatus);

    if (!activating) return;

    await this.publisher.publish({
      type: PUBLISHED_EVENT_TYPES.ACCOUNT_ACTIVATED,
      data: {
        empleadoId: account.empleadoId,
        email: account.email,
        motivo: ACTIVATION_REASONS.INITIAL,
        estado: ACCOUNT_STATUS.ACTIVE,
      },
    });
  }
}
