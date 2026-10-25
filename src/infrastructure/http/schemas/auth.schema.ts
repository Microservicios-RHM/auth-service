import { z } from 'zod';
import { RESPONSE_MESSAGES } from '../../../shared/constants/response-messages.constants.ts';

const requiredString = (field: string, max: number) =>
  z
    .string(RESPONSE_MESSAGES.validation.required(field))
    .trim()
    .min(1, RESPONSE_MESSAGES.validation.notEmpty(field))
    .max(max, RESPONSE_MESSAGES.validation.maxLength(field, max));

export const loginSchema = z.object({
  username: requiredString('username', 254),
  password: requiredString('password', 128),
});

export const recoverPasswordSchema = z.object({
  email: z.email(RESPONSE_MESSAGES.validation.invalidEmail).trim().max(254),
});

export const resetPasswordSchema = z.object({
  token: requiredString('token', 2048),
  nuevaPassword: requiredString('nuevaPassword', 128),
});

export const changePasswordSchema = z.object({
  passwordActual: requiredString('passwordActual', 128),
  nuevaPassword: requiredString('nuevaPassword', 128),
});
