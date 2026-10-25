import type { RequestHandler } from 'express';
import type { Login } from '../../../application/use-cases/login.use-case.ts';
import type { RecoverPassword } from '../../../application/use-cases/recover-password.use-case.ts';
import type { ResetPassword } from '../../../application/use-cases/reset-password.use-case.ts';
import type { ChangePassword } from '../../../application/use-cases/change-password.use-case.ts';
import {
  changePasswordSchema,
  loginSchema,
  recoverPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.ts';
import { sendSuccess } from '../responses/api.response.ts';
import { HTTP_STATUS } from '../../../shared/constants/http-status.constants.ts';
import { RESPONSE_MESSAGES } from '../../../shared/constants/response-messages.constants.ts';

export class AuthController {
  private readonly login: Login;
  private readonly recoverPassword: RecoverPassword;
  private readonly resetPassword: ResetPassword;
  private readonly changePassword: ChangePassword;

  constructor(
    login: Login,
    recoverPassword: RecoverPassword,
    resetPassword: ResetPassword,
    changePassword: ChangePassword,
  ) {
    this.login = login;
    this.recoverPassword = recoverPassword;
    this.resetPassword = resetPassword;
    this.changePassword = changePassword;
  }

  readonly postLogin: RequestHandler = async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const issued = await this.login.execute(input);
      sendSuccess(res, HTTP_STATUS.OK, RESPONSE_MESSAGES.auth.loggedIn, {
        accessToken: issued.token,
        expiraEn: issued.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  };

  readonly postRecoverPassword: RequestHandler = async (req, res, next) => {
    try {
      const { email } = recoverPasswordSchema.parse(req.body);
      await this.recoverPassword.execute(email);
      sendSuccess(res, HTTP_STATUS.OK, RESPONSE_MESSAGES.auth.recoveryRequested, null);
    } catch (error) {
      next(error);
    }
  };

  readonly postResetPassword: RequestHandler = async (req, res, next) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      await this.resetPassword.execute(input);
      sendSuccess(res, HTTP_STATUS.OK, RESPONSE_MESSAGES.auth.passwordReset, null);
    } catch (error) {
      next(error);
    }
  };

  readonly postChangePassword: RequestHandler = async (req, res, next) => {
    try {
      const input = changePasswordSchema.parse(req.body);
      await this.changePassword.execute({ ...input, empleadoId: req.auth!.sub });
      sendSuccess(res, HTTP_STATUS.OK, RESPONSE_MESSAGES.auth.passwordChanged, null);
    } catch (error) {
      next(error);
    }
  };
}
