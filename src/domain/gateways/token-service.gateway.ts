import type { AccountRole } from '../../shared/constants/account-status.constants.ts';

export interface AccessTokenClaims {
  readonly sub: string;
  readonly role: AccountRole;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: string;
}

export interface TokenService {
  issueAccessToken(claims: AccessTokenClaims): IssuedToken;
  issueResetToken(empleadoId: string): IssuedToken;
  verifyAccessToken(token: string): AccessTokenClaims;
  verifyResetToken(token: string): string;
}
