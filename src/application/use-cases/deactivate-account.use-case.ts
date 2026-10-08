import type { Logger } from 'pino';
import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { EventPublisher } from '../../domain/gateways/event-publisher.gateway.ts';
import { ACCOUNT_STATUS } from '../../shared/constants/account-status.constants.ts';
import { PUBLISHED_EVENT_TYPES } from '../../shared/constants/event-types.constants.ts';

export interface DeactivateAccountInput {
  readonly empleadoId: string;
  readonly motivo: string;
  readonly permanente: boolean;
}

export class DeactivateAccount {
  private readonly repository: UserAccountRepository;
  private readonly publisher: EventPublisher;
  private readonly logger: Logger;

  constructor(repository: UserAccountRepository, publisher: EventPublisher, logger: Logger) {
    this.repository = repository;
    this.publisher = publisher;
    this.logger = logger;
  }

  async execute(input: DeactivateAccountInput): Promise<void> {
    const account = await this.repository.findByEmployeeId(input.empleadoId);
    if (!account) {
      this.logger.warn({ empleadoId: input.empleadoId }, 'Account not found; nothing to deactivate');
      return;
    }

    // Una baja permanente nunca se degrada a suspensión temporal: si el empleado ya fue retirado,
    // unas vacaciones que inicien después no pueden aflojar su estado.
    if (account.estado === ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED) {
      this.logger.info(
        { empleadoId: input.empleadoId, motivo: input.motivo },
        'Account already permanently deactivated; status preserved',
      );
      return;
    }

    const estado = input.permanente
      ? ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED
      : ACCOUNT_STATUS.TEMPORARILY_SUSPENDED;

    await this.repository.updateStatus(account.empleadoId, estado);

    await this.publisher.publish({
      type: PUBLISHED_EVENT_TYPES.ACCOUNT_DEACTIVATED,
      data: {
        empleadoId: account.empleadoId,
        email: account.email,
        motivo: input.motivo,
        permanente: input.permanente,
        estado,
      },
    });
  }
}
