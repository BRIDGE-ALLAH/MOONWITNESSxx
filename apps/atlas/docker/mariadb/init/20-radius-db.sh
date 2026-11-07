#!/bin/sh
set -eu

: "${RADIUS_DB_PASSWORD:?RADIUS_DB_PASSWORD is required}"

case "${RADIUS_DB_PASSWORD}" in
  *[!A-Za-z0-9_-]*)
    echo "RADIUS_DB_PASSWORD may contain only letters, digits, underscores, and hyphens" >&2
    exit 1
    ;;
esac

if [ "${#RADIUS_DB_PASSWORD}" -lt 32 ]; then
  echo "RADIUS_DB_PASSWORD must contain at least 32 characters" >&2
  exit 1
fi

mariadb --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS radius
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'radius'@'%' IDENTIFIED BY '${RADIUS_DB_PASSWORD}';
ALTER USER 'radius'@'%' IDENTIFIED BY '${RADIUS_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'%';
SQL
