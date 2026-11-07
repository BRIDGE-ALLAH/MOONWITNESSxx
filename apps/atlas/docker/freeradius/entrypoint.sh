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

sed "s/__RADIUS_DB_PASSWORD__/${RADIUS_DB_PASSWORD}/g" \
  /etc/raddb/mods-available/sql.template > /etc/raddb/mods-available/sql
chmod 0640 /etc/raddb/mods-available/sql

exec /docker-entrypoint.sh "$@"
