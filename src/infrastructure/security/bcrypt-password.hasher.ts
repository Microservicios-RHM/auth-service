import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../domain/gateways/password-hasher.gateway.ts';

// bcryptjs y no bcrypt: la implementación nativa necesita node-gyp y cabeceras de compilación que
// la imagen node:24-alpine no trae. El algoritmo es el mismo y el hash es intercambiable.
const SALT_ROUNDS = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
