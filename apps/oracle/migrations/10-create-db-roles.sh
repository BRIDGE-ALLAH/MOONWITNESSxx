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
  'CREATE ROLE oracle_migrator LOGIN PASSWORD %L NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'oracle_migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_migrator') \gexec
SELECT format(
  'CREATE ROLE oracle_app LOGIN PASSWORD %L NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'oracle_app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app') \gexec

ALTER ROLE oracle_migrator WITH LOGIN PASSWORD :'oracle_migrator_password'
  NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE oracle_app WITH LOGIN PASSWORD :'oracle_app_password'
  NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- Remove any historical group memberships: NOINHERIT alone does not prevent SET ROLE.
SELECT format('REVOKE %I FROM oracle_migrator', granted.rolname)
FROM pg_auth_members AS membership
JOIN pg_roles AS granted ON granted.oid = membership.roleid
WHERE membership.member = 'oracle_migrator'::regrole \gexec
SELECT format('REVOKE %I FROM oracle_app', granted.rolname)
FROM pg_auth_members AS membership
JOIN pg_roles AS granted ON granted.oid = membership.roleid
WHERE membership.member = 'oracle_app'::regrole \gexec

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

SELECT format(
  'ALTER ROLE oracle_migrator IN DATABASE %I SET search_path = oracle',
  current_database()
) \gexec
SELECT format(
  'ALTER ROLE oracle_app IN DATABASE %I SET search_path = oracle',
  current_database()
) \gexec
SQL
