ALTER TABLE engine_instances
    ADD COLUMN config JSON NULL AFTER labels,
    ADD COLUMN secret_env_key VARCHAR(128) NULL AFTER config;
