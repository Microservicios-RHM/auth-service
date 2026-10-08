export const RESPONSE_MESSAGES = {
  auth: {
    loggedIn: 'Autenticación exitosa',
    recoveryRequested:
      'Si el correo corresponde a una cuenta registrada, se enviarán las instrucciones de recuperación',
    passwordReset: 'Contraseña establecida correctamente',
    passwordChanged: 'Contraseña actualizada correctamente',
    invalidCredentials: 'Usuario o contraseña incorrectos',
    accountSuspended: 'La cuenta está suspendida temporalmente por vacaciones',
    accountDeactivated: 'La cuenta está desactivada de forma permanente',
    accountNotActivated: 'La cuenta aún no tiene una contraseña establecida',
    invalidToken: 'El token es inválido o ya expiró',
    missingToken: 'La petición no incluye un token de acceso',
    samePassword: 'La nueva contraseña debe ser distinta de la actual',
  },
  account: {
    notFound: (username: string) => `La cuenta ${username} no existe`,
  },
  service: {
    available: 'Servicio disponible',
  },
  validation: {
    invalidInput: 'Datos de entrada inválidos',
    invalidJson: 'El cuerpo no es JSON válido',
    requestBodyTooLarge: 'El cuerpo de la solicitud supera el tamaño máximo permitido',
    required: (field: string) => `${field} es obligatorio`,
    notEmpty: (field: string) => `${field} no puede estar vacío`,
    maxLength: (field: string, max: number) => `${field} no puede superar ${max} caracteres`,
    invalidEmail: 'email debe tener un formato válido',
    weakPassword: (min: number) =>
      `La contraseña debe tener al menos ${min} caracteres e incluir una letra y un número`,
  },
  resource: {
    notFound: 'Recurso no encontrado',
  },
  server: {
    internalError: 'Error interno del servidor',
  },
} as const;
