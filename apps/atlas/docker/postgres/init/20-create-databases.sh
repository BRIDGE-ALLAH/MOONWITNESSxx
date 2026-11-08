#!/bin/sh
set -eu

: "${ATLAS_DB_PASSWORD:?ATLAS_DB_PASSWORD is required}"
: "${RADIUS_DB_PASSWORD:?RADIUS_DB_PASSWORD is required}"

case "${ATLAS_DB_PASSWORD}${RADIUS_DB_PASSWORD}" in
  *[!A-Za-z0-9_-]*)
    echo "Database passwords must use URL-safe alphanumeric, underscore, or hyphen characters" >&2
    exit 1
    ;;
esac

if [ "${#ATLAS_DB_PASSWORD}" -lt 32 ] || [ "${#RADIUS_DB_PASSWORD}" -lt 32 ]; then
  echo "Database passwords must contain at least 32 characters" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE atlas LOGIN PASSWORD '$ATLAS_DB_PASSWORD';
CREATE DATABASE atlas OWNER atlas;
CREATE ROLE radius LOGIN PASSWORD '$RADIUS_DB_PASSWORD';
CREATE DATABASE radius OWNER radius;
SQL
