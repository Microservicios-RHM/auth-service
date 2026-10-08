# auth-service

Proveedor de identidad de la plataforma RHM. Emite el token de acceso que el `api-gateway` valida
antes de enrutar hacia los microservicios de negocio, y gobierna el ciclo de vida de las cuentas a
partir de los eventos del broker.

## Requisitos

- Node.js 24 y npm 11.
- PostgreSQL y RabbitMQ de `rhm-database-infrastructure`.
- Docker para ejecución contenerizada.

## Configuración local

```bash
npm ci
cp .env.example .env
```

El servicio valida toda la configuración al arrancar y falla de inmediato si falta una variable
requerida. `JWT_SECRET` es el mismo secreto que usa el Gateway para verificar la firma: si los dos
no coinciden, ningún token emitido aquí será aceptado allá.

```bash
npm run db:migrate
npm run dev
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Verifica credenciales y emite el token de acceso |
| `POST` | `/auth/recover-password` | Publica `usuario.recuperacion` con un token de restablecimiento |
| `POST` | `/auth/reset-password` | Establece la contraseña con un token de activación o recuperación |
| `POST` | `/auth/change-password` | Cambia la contraseña del usuario autenticado (requiere JWT) |
| `GET` | `/health` | Sonda de disponibilidad |

```text
Swagger UI:      http://localhost:8080/auth/docs
Documento JSON:  http://localhost:8080/auth/openapi.json
```

Swagger está configurado con el esquema de seguridad `BearerAuth`: el botón **Authorize** permite
pegar el `accessToken` devuelto por `/auth/login` y probar los endpoints protegidos sin salir del
navegador.

## Los dos tokens

El servicio emite tokens con dos propósitos distintos, firmados con el mismo secreto (HMAC SHA-256):

**Token de acceso**, devuelto por `/auth/login`:

```json
{ "sub": "E001", "role": "USER", "iss": "auth-service", "iat": 1712345678, "exp": 1712349278 }
```

`sub` es el **identificador del empleado**, no el nombre de usuario. Esa decisión es deliberada: el
Gateway compara `sub` contra el `empleadoId` del recurso para resolver la propiedad del dato
(un `USER` solo puede modificar su propio perfil), y usar el correo ahí obligaría a una consulta
extra en cada petición.

**Token de restablecimiento**, generado al crear la cuenta o al pedir recuperación:

```json
{ "sub": "E001", "type": "RESET_PASSWORD", "iss": "auth-service", "iat": 1712345678, "exp": 1712346578 }
```

Se eligió la **opción A** del enunciado (stateless con JWT): el servicio valida su autenticidad y
expiración matemáticamente, sin tablas adicionales ni Redis. El claim `type` es lo que impide usar
un token de restablecimiento como token de acceso: aunque ambos lleven la misma firma,
`verifyAccessToken` rechaza cualquiera que lo traiga.

La contraseña nunca viaja en un token ni en un evento, y en la base se guarda hasheada con bcrypt.

## Ciclo de vida de la cuenta

El estado de la cuenta es un enum, no un booleano, porque hay que distinguir una suspensión
temporal de una baja definitiva:

```text
PENDIENTE_ACTIVACION ──(reset-password)──► ACTIVA
                                            │  ▲
                 (vacaciones.iniciadas) ────┘  └──── (vacaciones.finalizadas)
                                            ▼
                                   SUSPENDIDA_TEMPORAL
                                            │
                     (empleado.retirado) ───┴───► DESACTIVADA_PERMANENTE
```

`DESACTIVADA_PERMANENTE` es un estado terminal. Si un empleado es retirado mientras está de
vacaciones, el `vacaciones.finalizadas` que llega después **no** reactiva la cuenta: el caso se
resuelve en `ReactivateAccount`, que solo actúa sobre cuentas en `SUSPENDIDA_TEMPORAL`.

### Eventos

| Consume | Efecto |
|---|---|
| `empleado.creado` | Crea la cuenta en `PENDIENTE_ACTIVACION` con rol `USER` y publica `usuario.creado` |
| `empleado.retirado` | `DESACTIVADA_PERMANENTE` y publica `cuenta.desactivada` (`RETIRO`, permanente) |
| `vacaciones.iniciadas` | `SUSPENDIDA_TEMPORAL` y publica `cuenta.desactivada` (`VACACIONES`, no permanente) |
| `vacaciones.finalizadas` | Reactiva solo si está suspendida, y publica `cuenta.activada` (`FIN_VACACIONES`) |

Los payloads están en el [catálogo de eventos](https://github.com/Microservicios-RHM/rhm-database-infrastructure/blob/main/docs/event-catalog.md).

Cada mensaje se deduplica contra la tabla `auth.eventos_procesados` antes de aplicar su efecto, con
el `id` del envelope como clave, igual que en el resto de consumidores del ecosistema.

## Administrador semilla

Todos los endpoints de escritura exigen rol `ADMIN`, pero el primer empleado solo puede crearlo un
`ADMIN`. Para romper esa circularidad el servicio crea una cuenta administradora al arrancar, a
partir de `ADMIN_USERNAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

Se crea una sola vez y nunca se sobrescribe: si se cambiara la contraseña después, un reinicio no
la revierte.

## Arquitectura

```text
src/
├── domain/          Entidad de cuenta, política de contraseñas, errores y contratos
├── application/     Casos de uso (login, recuperación, y los dirigidos por eventos)
└── infrastructure/
    ├── http/        Controlador, rutas, schemas, middlewares y OpenAPI
    ├── security/    Hash con bcrypt y firma/verificación de JWT
    ├── messaging/   Conexión, publicador y consumidor de RabbitMQ
    └── persistence/ Cliente, repositorios y migraciones PostgreSQL
```

Los casos de uso dependen de interfaces (`UserAccountRepository`, `PasswordHasher`, `TokenService`,
`EventPublisher`), nunca de `pg`, `bcryptjs` ni `jsonwebtoken`. La raíz de composición es
`server.ts`.

Se usa `bcryptjs` y no `bcrypt`: la implementación nativa necesita node-gyp y cabeceras de
compilación que la imagen `node:24-alpine` no trae. El algoritmo es el mismo y los hashes son
intercambiables.

## Docker Compose

El despliegue recomendado se ejecuta desde `rhm-database-infrastructure`:

```bash
cd ../rhm-database-infrastructure
docker compose up -d --build
```
