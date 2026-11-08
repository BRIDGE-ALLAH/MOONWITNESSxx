#!/bin/sh
set -eu

PGPASSWORD="$RADIUS_DB_PASSWORD" psql --set ON_ERROR_STOP=1 \
  --host 127.0.0.1 \
  --username radius \
  --dbname radius \
  --file /tmp/atlas-radius-schema.sql
