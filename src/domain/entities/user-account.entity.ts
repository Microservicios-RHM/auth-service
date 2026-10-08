import type {
  AccountRole,
  AccountStatus,
} from '../../shared/constants/account-status.constants.ts';

export interface UserAccount {
  readonly empleadoId: string;
  readonly username: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly rol: AccountRole;
  readonly estado: AccountStatus;
}

export type NewUserAccount = Omit<UserAccount, 'passwordHash' | 'estado'>;
