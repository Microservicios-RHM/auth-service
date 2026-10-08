import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller.ts';

export function createAuthRouter(
  controller: AuthController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.post('/login', controller.postLogin);
  router.post('/recover-password', controller.postRecoverPassword);
  router.post('/reset-password', controller.postResetPassword);
  router.post('/change-password', authenticate, controller.postChangePassword);

  return router;
}
