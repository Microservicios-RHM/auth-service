import assert from 'node:assert/strict';
import test from 'node:test';
import { Login } from '../src/application/use-cases/login.use-case.ts';
import { assertPasswordPolicy } from '../src/domain/password-policy.ts';
import { AppError } from '../src/domain/errors/app.error.ts';
import { ACCOUNT_ROLES, ACCOUNT_STATUS } from '../src/shared/constants/account-status.constants.ts';
import type { UserAccount } from '../src/domain/entities/user-account.entity.ts';
import type { UserAccountRepository } from '../src/domain/repositories/user-account.repository.ts';
import type { PasswordHasher } from '../src/domain/gateways/password-hasher.gateway.ts';
import type { TokenService } from '../src/domain/gateways/token-service.gateway.ts';

const account = (estado = ACCOUNT_STATUS.ACTIVE): UserAccount => ({
  empleadoId: 'EMP-1', username: 'juan@rhm.test', email: 'juan@rhm.test', passwordHash: 'hash',
  rol: ACCOUNT_ROLES.USER, estado,
});

function repository(found: UserAccount | null): UserAccountRepository {
  return {
    findByUsername: async () => found, findByEmail: async () => found, findByEmployeeId: async () => found,
    create: async () => account(), updatePassword: async () => account(), updateStatus: async () => account(),
  };
}

const hasher = (valid: boolean): PasswordHasher => ({ hash: async value => `hashed-${value}`, verify: async () => valid });
const tokens: TokenService = {
  issueAccessToken: claims => ({ token: `token-${claims.sub}`, expiresAt: '2026-12-31T00:00:00.000Z' }),
  issueResetToken: () => ({ token: 'reset', expiresAt: '2026-12-31T00:00:00.000Z' }),
  verifyAccessToken: () => ({ sub: 'EMP-1', role: ACCOUNT_ROLES.USER }), verifyResetToken: () => 'EMP-1',
};

async function expectAppError(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof AppError && error.code === code);
}

test('inicia sesión con usuario normalizado y credenciales válidas', async () => {
  const result = await new Login(repository(account()), hasher(true), tokens).execute({ username: ' JUAN@RHM.TEST ', password: 'Clave123' });
  assert.equal(result.token, 'token-EMP-1');
});

test('rechaza credenciales inexistentes o inválidas', async () => {
  await expectAppError(() => new Login(repository(null), hasher(true), tokens).execute({ username: 'x', password: 'x' }), 'INVALID_CREDENTIALS');
  await expectAppError(() => new Login(repository(account()), hasher(false), tokens).execute({ username: 'x', password: 'x' }), 'INVALID_CREDENTIALS');
});

test('rechaza cuentas suspendidas y retiradas', async () => {
  await expectAppError(() => new Login(repository(account(ACCOUNT_STATUS.TEMPORARILY_SUSPENDED)), hasher(true), tokens).execute({ username: 'x', password: 'x' }), 'ACCOUNT_SUSPENDED');
  await expectAppError(() => new Login(repository(account(ACCOUNT_STATUS.PERMANENTLY_DEACTIVATED)), hasher(true), tokens).execute({ username: 'x', password: 'x' }), 'ACCOUNT_DEACTIVATED');
});

test('exige letras, dígitos y longitud mínima en contraseñas', () => {
  assert.doesNotThrow(() => assertPasswordPolicy('Clave123'));
  for (const password of ['corta1', 'sololetras', '12345678']) {
    assert.throws(() => assertPasswordPolicy(password), (error: unknown) => error instanceof AppError && error.code === 'WEAK_PASSWORD');
  }
});
