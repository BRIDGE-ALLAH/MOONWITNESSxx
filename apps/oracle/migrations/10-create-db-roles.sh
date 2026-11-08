#!/bin/sh
set -eu

: "${ORACLE_APP_DB_PASSWORD:?ORACLE_APP_DB_PASSWORD must be set}"
: "${ORACLE_MIGRATOR_DB_PASSWORD:?ORACLE_MIGRATOR_DB_PASSWORD must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
# During postgres image initialization PGHOST is unset and psql must use the
# temporary Unix socket. The Compose bootstrap service sets PGHOST=postgres.
PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=oracle_app_password="$ORACLE_APP_DB_PASSWORD" \
  --set=oracle_migrator_password="$ORACLE_MIGRATOR_DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE oracle_migrator LOGIN PASSWORD %L NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'oracle_migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_migrator') \gexec
SELECT format(
  'CREATE ROLE oracle_app LOGIN PASSWORD %L NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'oracle_app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app') \gexec

ALTER ROLE oracle_migrator WITH LOGIN PASSWORD :'oracle_migrator_password'
  NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE oracle_app WITH LOGIN PASSWORD :'oracle_app_password'
  NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO oracle_migrator, oracle_app',
  current_database()
) \gexec
SELECT format(
  'REVOKE CREATE ON DATABASE %I FROM oracle_migrator, oracle_app',
  current_database()
) \gexec

CREATE SCHEMA IF NOT EXISTS oracle AUTHORIZATION oracle_migrator;
ALTER SCHEMA oracle OWNER TO oracle_migrator;
REVOKE ALL ON SCHEMA oracle FROM PUBLIC;
REVOKE ALL ON SCHEMA oracle FROM oracle_app;
GRANT USAGE ON SCHEMA oracle TO oracle_app;
GRANT USAGE, CREATE ON SCHEMA oracle TO oracle_migrator;

REVOKE ALL ON SCHEMA public FROM oracle_migrator, oracle_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM oracle_migrator, oracle_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM oracle_migrator, oracle_app;

-- Do not grant future tables by default: the migration explicitly grants only
-- the oracle.jobs table. Historical broad grants are removed on every bootstrap.
REVOKE ALL ON ALL TABLES IN SCHEMA oracle FROM oracle_app;
ALTER DEFAULT PRIVILEGES FOR ROLE oracle_migrator IN SCHEMA oracle
  REVOKE ALL ON TABLES FROM oracle_app;

ALTER ROLE oracle_migrator IN DATABASE :"POSTGRES_DB" SET search_path = oracle;
ALTER ROLE oracle_app IN DATABASE :"POSTGRES_DB" SET search_path = oracle;
SQL
