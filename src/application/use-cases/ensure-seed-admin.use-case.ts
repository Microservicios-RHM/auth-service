import type { Logger } from 'pino';
import type { UserAccountRepository } from '../../domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from '../../domain/gateways/password-hasher.gateway.ts';
import type { SeedAdminConfig } from '../../config/environment.config.ts';
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUS,
} from '../../shared/constants/account-status.constants.ts';

// Sin esta cuenta el sistema queda inarrancable: todos los endpoints de escritura exigen rol ADMIN,
// pero el primer empleado solo puede crearlo un ADMIN. Se crea una vez y nunca se sobrescribe, para
// no revertir un cambio de contraseña en cada reinicio.
export class EnsureSeedAdmin {
  private readonly repository: UserAccountRepository;
  private readonly hasher: PasswordHasher;
  private readonly logger: Logger;

  constructor(repository: UserAccountRepository, hasher: PasswordHasher, logger: Logger) {
    this.repository = repository;
    this.hasher = hasher;
    this.logger = logger;
  }

  async execute(config: SeedAdminConfig): Promise<void> {
    if (await this.repository.findByEmployeeId(config.empleadoId)) return;

    await this.repository.create({
      empleadoId: config.empleadoId,
      username: config.username.trim().toLowerCase(),
      email: config.email.trim().toLowerCase(),
      rol: ACCOUNT_ROLES.ADMIN,
    });

    const passwordHash = await this.hasher.hash(config.password);
    await this.repository.updatePassword(config.empleadoId, passwordHash, ACCOUNT_STATUS.ACTIVE);

    this.logger.info({ username: config.username }, 'Seed administrator account created');
  }
}
