import type pg from 'pg';
import type { UserAccountRepository } from '../../../domain/repositories/user-account.repository.ts';
import type { NewUserAccount, UserAccount } from '../../../domain/entities/user-account.entity.ts';
import type {
  AccountRole,
  AccountStatus,
} from '../../../shared/constants/account-status.constants.ts';

interface UserAccountRow {
  readonly empleado_id: string;
  readonly username: string;
  readonly email: string;
  readonly password_hash: string | null;
  readonly rol: AccountRole;
  readonly estado: AccountStatus;
}

const COLUMNS = 'empleado_id, username, email, password_hash, rol, estado';

export class PostgresUserAccountRepository implements UserAccountRepository {
  private readonly pool: pg.Pool;
  private readonly schema: string;

  constructor(pool: pg.Pool, schema: string) {
    this.pool = pool;
    this.schema = schema;
  }

  async findByUsername(username: string): Promise<UserAccount | null> {
    return this.findOneBy('lower(username) = lower($1)', username);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    return this.findOneBy('lower(email) = lower($1)', email);
  }

  async findByEmployeeId(empleadoId: string): Promise<UserAccount | null> {
    return this.findOneBy('empleado_id = $1', empleadoId);
  }

  async create(account: NewUserAccount): Promise<UserAccount> {
    const result = await this.pool.query<UserAccountRow>(
      `INSERT INTO "${this.schema}".user_accounts (empleado_id, username, email, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [account.empleadoId, account.username, account.email, account.rol],
    );
    return this.toDomain(result.rows[0]!);
  }

  async updatePassword(
    empleadoId: string,
    passwordHash: string,
    estado: AccountStatus,
  ): Promise<UserAccount> {
    const result = await this.pool.query<UserAccountRow>(
      `UPDATE "${this.schema}".user_accounts
       SET password_hash = $2, estado = $3, updated_at = NOW()
       WHERE empleado_id = $1
       RETURNING ${COLUMNS}`,
      [empleadoId, passwordHash, estado],
    );
    return this.toDomain(result.rows[0]!);
  }

  async updateStatus(empleadoId: string, estado: AccountStatus): Promise<UserAccount> {
    const result = await this.pool.query<UserAccountRow>(
      `UPDATE "${this.schema}".user_accounts
       SET estado = $2, updated_at = NOW()
       WHERE empleado_id = $1
       RETURNING ${COLUMNS}`,
      [empleadoId, estado],
    );
    return this.toDomain(result.rows[0]!);
  }

  private async findOneBy(condition: string, value: string): Promise<UserAccount | null> {
    const result = await this.pool.query<UserAccountRow>(
      `SELECT ${COLUMNS} FROM "${this.schema}".user_accounts WHERE ${condition}`,
      [value],
    );
    const row = result.rows[0];
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: UserAccountRow): UserAccount {
    return {
      empleadoId: row.empleado_id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      rol: row.rol,
      estado: row.estado,
    };
  }
}
