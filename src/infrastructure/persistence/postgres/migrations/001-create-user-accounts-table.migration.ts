export function createUserAccountsMigration(schema: string) {
  return {
    version: 1,
    name: 'create_user_accounts',
    sql: `
      CREATE TABLE "${schema}".user_accounts (
        empleado_id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(254) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash TEXT,
        rol VARCHAR(20) NOT NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_ACTIVACION',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT user_accounts_rol_check CHECK (rol IN ('ADMIN', 'USER')),
        CONSTRAINT user_accounts_estado_check CHECK (
          estado IN ('PENDIENTE_ACTIVACION', 'ACTIVA', 'SUSPENDIDA_TEMPORAL', 'DESACTIVADA_PERMANENTE')
        )
      );

      CREATE UNIQUE INDEX user_accounts_username_unique_idx ON "${schema}".user_accounts (lower(username));
      CREATE UNIQUE INDEX user_accounts_email_unique_idx ON "${schema}".user_accounts (lower(email));
      CREATE INDEX user_accounts_estado_idx ON "${schema}".user_accounts (estado);
    `,
  } as const;
}
