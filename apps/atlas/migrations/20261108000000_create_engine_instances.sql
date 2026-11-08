CREATE TABLE IF NOT EXISTS engine_instances (
    id CHAR(26) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    engine_type VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    labels JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_engine_instances_type_role
    ON engine_instances (engine_type, role);
CREATE INDEX IF NOT EXISTS idx_engine_instances_enabled
    ON engine_instances (enabled);
