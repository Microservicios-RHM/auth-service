import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { TokenService } from '../../domain/gateways/token-service.gateway.ts';
import type { EventPublisher } from '../../domain/gateways/event-publisher.gateway.ts';
import { ACCOUNT_STATUS } from '../../shared/constants/account-status.constants.ts';
import { PUBLISHED_EVENT_TYPES } from '../../shared/constants/event-types.constants.ts';

export class RecoverPassword {
  private readonly repository: UserAccountRepository;
  private readonly tokens: TokenService;
  private readonly publisher: EventPublisher;

  constructor(
    repository: UserAccountRepository,
    tokens: TokenService,
    publisher: EventPublisher,
  ) {
    this.repository = repository;
    this.tokens = tokens;
    this.publisher = publisher;
  }

  // Responde siempre igual, exista o no la cuenta: la respuesta HTTP no debe revelar qué correos
  // están registrados. El efecto (el evento) solo ocurre cuando la cuenta existe y es recuperable.
  async execute(email: string): Promise<void> {
    const account = await this.repository.findByEmail(email.trim().toLowerCase());
    if (!account || account.estado === ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED) return;

    const resetToken = this.tokens.issueResetToken(account.empleadoId);

    await this.publisher.publish({
      type: PUBLISHED_EVENT_TYPES.USER_RECOVERY,
      data: {
        empleadoId: account.empleadoId,
        email: account.email,
        token: resetToken.token,
        expiraEn: resetToken.expiresAt,
      },
    });
  }
}
