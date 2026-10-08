import type { NewUserAccount, UserAccount } from '../entities/user-account.entity.ts';
import type { AccountStatus } from '../../shared/constants/account-status.constants.ts';

export interface UserAccountRepository {
  findByUsername(username: string): Promise<UserAccount | null>;
  findByEmail(email: string): Promise<UserAccount | null>;
  findByEmployeeId(empleadoId: string): Promise<UserAccount | null>;
  create(account: NewUserAccount): Promise<UserAccount>;
  updatePassword(empleadoId: string, passwordHash: string, estado: AccountStatus): Promise<UserAccount>;
  updateStatus(empleadoId: string, estado: AccountStatus): Promise<UserAccount>;
}
