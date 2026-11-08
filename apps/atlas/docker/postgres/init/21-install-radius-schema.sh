#!/bin/sh
set -eu

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname radius \
  --file /tmp/atlas-radius-schema.sql
