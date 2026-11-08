-- Idempotent development/CI bootstrap for the ORACLE runtime login.
-- Execute as a database administrator; never use this identity in the ORACLE process.
SELECT format(
  'CREATE ROLE oracle_app LOGIN PASSWORD %L NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'oracle_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app')
\gexec

SELECT format(
  'ALTER ROLE oracle_app WITH LOGIN PASSWORD %L NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'oracle_password'
)
\gexec

GRANT CONNECT ON DATABASE :"postgres_db" TO oracle_app;
REVOKE CREATE ON DATABASE :"postgres_db" FROM oracle_app;
REVOKE ALL ON SCHEMA public FROM oracle_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM oracle_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM oracle_app;
ALTER ROLE oracle_app IN DATABASE :"postgres_db" SET search_path = oracle;

SELECT 'CREATE ROLE oracle_migrator NOLOGIN NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_migrator')
\gexec

ALTER ROLE oracle_migrator WITH NOLOGIN NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CREATE ON DATABASE :"postgres_db" TO oracle_migrator;
