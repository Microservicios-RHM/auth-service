import { RESPONSE_MESSAGES } from '../../../shared/constants/response-messages.constants.ts';
import { ERROR_CODES } from '../../../shared/constants/error-codes.constants.ts';
import { MIN_PASSWORD_LENGTH } from '../../../domain/password-policy.ts';

const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    data: { type: 'object', nullable: true, example: null },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', enum: Object.values(ERROR_CODES) },
        status: { type: 'integer' },
        path: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      required: ['code', 'status', 'path', 'timestamp'],
    },
  },
  required: ['success', 'message', 'data', 'error'],
} as const;

const successEnvelope = (dataSchema: unknown) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: dataSchema,
  },
  required: ['success', 'message', 'data'],
});

const jsonBody = (schema: unknown) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const jsonResponse = (description: string, schema: unknown) => ({
  description,
  content: { 'application/json': { schema } },
});

const errorResponse = (description: string) => jsonResponse(description, errorResponseSchema);

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Auth API',
    version: '1.0.0',
    description:
      'Proveedor de identidad de la plataforma RHM. Emite el token de acceso que el API Gateway ' +
      'valida antes de enrutar hacia los microservicios de negocio, y gobierna el ciclo de vida ' +
      'de las cuentas a partir de los eventos del broker.',
  },
  servers: [{ url: 'http://localhost:8080', description: 'API Gateway' }],
  tags: [{ name: 'Autenticación' }, { name: 'Operación' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token obtenido en POST /auth/login. Pulse Authorize y pegue el valor de accessToken.',
      },
    },
    schemas: {
      ErrorResponse: errorResponseSchema,
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Autentica un usuario y emite un token de acceso',
        description:
          'El token incluye los claims `sub` (identificador del empleado) y `role`. Una cuenta ' +
          'suspendida por vacaciones o desactivada por retiro no puede iniciar sesión.',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            username: { type: 'string', example: 'juan.perez@empresa.com' },
            password: { type: 'string', format: 'password', example: 'Secreta123' },
          },
          required: ['username', 'password'],
        }),
        responses: {
          200: jsonResponse(
            RESPONSE_MESSAGES.auth.loggedIn,
            successEnvelope({
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                expiraEn: { type: 'string', format: 'date-time' },
              },
            }),
          ),
          400: errorResponse('Datos de entrada inválidos.'),
          401: errorResponse('Credenciales incorrectas, o cuenta suspendida o desactivada.'),
        },
      },
    },
    '/auth/recover-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Solicita el restablecimiento de la contraseña',
        description:
          'Publica `usuario.recuperacion` con un token de corta duración. La respuesta es la ' +
          'misma exista o no la cuenta, para no revelar qué correos están registrados.',
        requestBody: jsonBody({
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
          required: ['email'],
        }),
        responses: {
          200: jsonResponse(
            RESPONSE_MESSAGES.auth.recoveryRequested,
            successEnvelope({ nullable: true }),
          ),
          400: errorResponse('El email no tiene un formato válido.'),
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Establece la contraseña con un token de activación o recuperación',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            token: { type: 'string' },
            nuevaPassword: { type: 'string', format: 'password', minLength: MIN_PASSWORD_LENGTH },
          },
          required: ['token', 'nuevaPassword'],
        }),
        responses: {
          200: jsonResponse(
            RESPONSE_MESSAGES.auth.passwordReset,
            successEnvelope({ nullable: true }),
          ),
          400: errorResponse('La contraseña no cumple la política de seguridad.'),
          401: errorResponse('El token es inválido, expiró, o la cuenta está desactivada.'),
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Cambia la contraseña del usuario autenticado',
        security: [{ BearerAuth: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            passwordActual: { type: 'string', format: 'password' },
            nuevaPassword: { type: 'string', format: 'password', minLength: MIN_PASSWORD_LENGTH },
          },
          required: ['passwordActual', 'nuevaPassword'],
        }),
        responses: {
          200: jsonResponse(
            RESPONSE_MESSAGES.auth.passwordChanged,
            successEnvelope({ nullable: true }),
          ),
          400: errorResponse('La nueva contraseña no cumple la política o es igual a la actual.'),
          401: errorResponse('Falta el token, es inválido, o la contraseña actual no coincide.'),
        },
      },
    },
    '/health': {
      get: {
        tags: ['Operación'],
        summary: 'Verifica que el servicio responde',
        responses: {
          200: jsonResponse(
            RESPONSE_MESSAGES.service.available,
            successEnvelope({
              type: 'object',
              properties: { status: { type: 'string', example: 'UP' } },
            }),
          ),
        },
      },
    },
  },
} as const;
