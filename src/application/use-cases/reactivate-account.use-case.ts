import type { Logger } from 'pino';
import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { EventPublisher } from '../../domain/gateways/event-publisher.gateway.ts';
import {
  ACCOUNT_STATUS,
  ACTIVATION_REASONS,
} from '../../shared/constants/account-status.constants.ts';
import { PUBLISHED_EVENT_TYPES } from '../../shared/constants/event-types.constants.ts';

export class ReactivateAccount {
  private readonly repository: UserAccountRepository;
  private readonly publisher: EventPublisher;
  private readonly logger: Logger;

  constructor(repository: UserAccountRepository, publisher: EventPublisher, logger: Logger) {
    this.repository = repository;
    this.publisher = publisher;
    this.logger = logger;
  }

  async execute(empleadoId: string): Promise<void> {
    const account = await this.repository.findByEmployeeId(empleadoId);
    if (!account) {
      this.logger.warn({ empleadoId }, 'Account not found; nothing to reactivate');
      return;
    }

    // Caso borde del reto: si el empleado fue retirado mientras estaba de vacaciones, su cuenta
    // quedó en DESACTIVADA_PERMANENTE y el fin del período no debe devolverle el acceso. Solo se
    // reactiva lo que esté suspendido temporalmente.
    if (account.estado !== ACCOUNT_STATUS.TEMPORARILY_SUSPENDED) {
      this.logger.info(
        { empleadoId, estado: account.estado },
        'Vacation ended but account is not temporarily suspended; reactivation skipped',
      );
      return;
    }

    await this.repository.updateStatus(account.empleadoId, ACCOUNT_STATUS.ACTIVE);

    await this.publisher.publish({
      type: PUBLISHED_EVENT_TYPES.ACCOUNT_ACTIVATED,
      data: {
        empleadoId: account.empleadoId,
        email: account.email,
        motivo: ACTIVATION_REASONS.VACATION_END,
        estado: ACCOUNT_STATUS.ACTIVE,
      },
    });
  }
}
