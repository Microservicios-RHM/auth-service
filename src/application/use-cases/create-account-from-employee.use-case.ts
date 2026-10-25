import type { Logger } from 'pino';
import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { TokenService } from '../../domain/gateways/token-service.gateway.ts';
import type { EventPublisher } from '../../domain/gateways/event-publisher.gateway.ts';
import { ACCOUNT_ROLES } from '../../shared/constants/account-status.constants.ts';
import { PUBLISHED_EVENT_TYPES } from '../../shared/constants/event-types.constants.ts';

export interface EmployeeCreatedData {
  readonly id: string;
  readonly email: string;
}

export class CreateAccountFromEmployee {
  private readonly repository: UserAccountRepository;
  private readonly tokens: TokenService;
  private readonly publisher: EventPublisher;
  private readonly logger: Logger;

  constructor(
    repository: UserAccountRepository,
    tokens: TokenService,
    publisher: EventPublisher,
    logger: Logger,
  ) {
    this.repository = repository;
    this.tokens = tokens;
    this.publisher = publisher;
    this.logger = logger;
  }

  async execute(employee: EmployeeCreatedData): Promise<void> {
    const email = employee.email.trim().toLowerCase();

    if (await this.repository.findByEmployeeId(employee.id)) {
      this.logger.warn({ empleadoId: employee.id }, 'Account already exists; skipping creation');
      return;
    }

    // El username es el correo porque es la credencial con la que el empleado inicia sesión; el
    // empleadoId viaja en el claim `sub` y es lo que el Gateway compara para la propiedad del recurso.
    const account = await this.repository.create({
      empleadoId: employee.id,
      username: email,
      email,
      rol: ACCOUNT_ROLES.USER,
    });

    const activationToken = this.tokens.issueResetToken(account.empleadoId);

    await this.publisher.publish({
      type: PUBLISHED_EVENT_TYPES.USER_CREATED,
      data: {
        empleadoId: account.empleadoId,
        email: account.email,
        rol: account.rol,
        token: activationToken.token,
        expiraEn: activationToken.expiresAt,
      },
    });
  }
}
