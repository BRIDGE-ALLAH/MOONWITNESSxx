-- Seed local Compose-managed engines once without overwriting operator-managed edits on replay.
INSERT IGNORE INTO engine_instances (
    id, name, engine_type, role, endpoint, enabled, labels, config, secret_env_key
) VALUES
(
    '01K9Z0J8A1B2C3D4E5F6G7H8J9',
    'freeradius-local',
    'freeradius',
    'radius_authentication_accounting',
    'radius://freeradius:18121',
    TRUE,
    JSON_OBJECT('managed_by', 'atlas-compose'),
    JSON_OBJECT('status_port', 18121),
    'ATLAS_ENGINE_SECRET_RADIUS_STATUS'
),
(
    '01K9Z0J8A1B2C3D4E5F6G7H8JA',
    'victoriametrics-local',
    'victoriametrics',
    'metrics_storage',
    'http://victoriametrics:8428',
    TRUE,
    JSON_OBJECT('managed_by', 'atlas-compose'),
    NULL,
    NULL
),
(
    '01K9Z0J8A1B2C3D4E5F6G7H8JB',
    'victorialogs-local',
    'victorialogs',
    'log_storage_and_search',
    'http://victorialogs:9428',
    TRUE,
    JSON_OBJECT('managed_by', 'atlas-compose'),
    NULL,
    NULL
)
