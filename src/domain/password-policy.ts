import { AppError } from './errors/app.error.ts';
import { HTTP_STATUS } from '../shared/constants/http-status.constants.ts';
import { ERROR_CODES } from '../shared/constants/error-codes.constants.ts';
import { RESPONSE_MESSAGES } from '../shared/constants/response-messages.constants.ts';

export const MIN_PASSWORD_LENGTH = 8;

const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;

export function assertPasswordPolicy(password: string): void {
  const compliant =
    password.length >= MIN_PASSWORD_LENGTH && HAS_LETTER.test(password) && HAS_DIGIT.test(password);

  if (!compliant) {
    throw new AppError(
      RESPONSE_MESSAGES.validation.weakPassword(MIN_PASSWORD_LENGTH),
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.WEAK_PASSWORD,
    );
  }
}
