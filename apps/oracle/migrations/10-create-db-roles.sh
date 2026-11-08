#!/bin/sh
set -eu

: "${ORACLE_APP_DB_PASSWORD:?ORACLE_APP_DB_PASSWORD must be set}"
: "${ORACLE_MIGRATOR_DB_PASSWORD:?ORACLE_MIGRATOR_DB_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=oracle_app_password="$ORACLE_APP_DB_PASSWORD" \
  --set=oracle_migrator_password="$ORACLE_MIGRATOR_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE oracle_migrator LOGIN PASSWORD %L', :'oracle_migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_migrator') \gexec
SELECT format('CREATE ROLE oracle_app LOGIN PASSWORD %L', :'oracle_app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app') \gexec
ALTER ROLE oracle_migrator PASSWORD :'oracle_migrator_password';
ALTER ROLE oracle_app PASSWORD :'oracle_app_password';
CREATE SCHEMA IF NOT EXISTS oracle AUTHORIZATION oracle_migrator;
SELECT format('GRANT CONNECT ON DATABASE %I TO oracle_app', current_database()) \\gexec
GRANT USAGE ON SCHEMA oracle TO oracle_app;
ALTER DEFAULT PRIVILEGES FOR ROLE oracle_migrator IN SCHEMA oracle
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oracle_app;
SQL
