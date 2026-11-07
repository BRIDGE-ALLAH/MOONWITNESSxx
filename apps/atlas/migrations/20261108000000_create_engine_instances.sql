CREATE TABLE IF NOT EXISTS engine_instances (
    id CHAR(26) NOT NULL,
    name VARCHAR(120) NOT NULL,
    engine_type VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    labels JSON NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_engine_instances_name (name),
    KEY idx_engine_instances_type_role (engine_type, role),
    KEY idx_engine_instances_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
