#!/bin/sh
set -eu

: "${RADIUS_DB_PASSWORD:?RADIUS_DB_PASSWORD is required}"
: "${RADIUS_STATUS_SECRET:?RADIUS_STATUS_SECRET is required}"
: "${RADIUS_STATUS_SECRET:?RADIUS_STATUS_SECRET is required}"
case "${RADIUS_DB_PASSWORD}" in
  *[!A-Za-z0-9_-]*)
    echo "RADIUS_DB_PASSWORD may contain only letters, digits, underscores, and hyphens" >&2
    exit 1
    ;;
esac
if [ "${#RADIUS_DB_PASSWORD}" -lt 32 ] || [ "${#RADIUS_STATUS_SECRET}" -lt 32 ]; then
  echo "RADIUS database and status secrets must contain at least 32 characters" >&2
  exit 1
fi
case "${RADIUS_STATUS_SECRET}" in
  *[!A-Za-z0-9_-]*)
    echo "RADIUS_STATUS_SECRET may contain only letters, digits, underscores, and hyphens" >&2
    exit 1
    ;;
esac

sed "s/__RADIUS_DB_PASSWORD__/${RADIUS_DB_PASSWORD}/g" \
  /etc/raddb/mods-available/sql.template > /etc/raddb/mods-available/sql
chmod 0640 /etc/raddb/mods-available/sql
sed "s/__RADIUS_STATUS_SECRET__/${RADIUS_STATUS_SECRET}/g" \
  /etc/raddb/sites-available/status > /etc/raddb/sites-available/status.runtime
chmod 0640 /etc/raddb/sites-available/status.runtime
rm -f /etc/raddb/sites-enabled/status
ln -s ../sites-available/status.runtime /etc/raddb/sites-enabled/status
printf '%s\n' "${RADIUS_STATUS_SECRET}" > /run/freeradius-status-secret
chmod 0600 /run/freeradius-status-secret

exec /docker-entrypoint.sh "$@"
