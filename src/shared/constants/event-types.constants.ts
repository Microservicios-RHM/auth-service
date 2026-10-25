export const CONSUMED_EVENT_TYPES = {
  EMPLOYEE_CREATED: 'empleado.creado',
  EMPLOYEE_RETIRED: 'empleado.retirado',
  VACATION_STARTED: 'vacaciones.iniciadas',
  VACATION_FINISHED: 'vacaciones.finalizadas',
} as const;

export const PUBLISHED_EVENT_TYPES = {
  USER_CREATED: 'usuario.creado',
  USER_RECOVERY: 'usuario.recuperacion',
  ACCOUNT_ACTIVATED: 'cuenta.activada',
  ACCOUNT_DEACTIVATED: 'cuenta.desactivada',
} as const;

export const EVENT_PRODUCER = 'auth-service';
