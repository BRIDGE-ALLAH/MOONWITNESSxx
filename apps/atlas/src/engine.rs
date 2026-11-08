use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::database;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EngineInstance {
    pub id: String,
    pub name: String,
    pub engine_type: String,
    pub role: String,
    pub endpoint: String,
    pub enabled: bool,
    pub labels: Option<serde_json::Value>,
    pub config: Option<serde_json::Value>,
    pub secret_env_key: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct EngineWriteRequest {
    pub name: String,
    pub engine_type: String,
    pub role: String,
    pub endpoint: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub labels: Option<serde_json::Value>,
    pub config: Option<serde_json::Value>,
    pub secret_env_key: Option<String>,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct EngineHealth {
    pub engine_id: String,
    pub engine_type: String,
    pub state: &'static str,
    pub detail: &'static str,
}

fn contains_secret_key(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Object(fields) => fields.iter().any(|(key, child)| {
            let key = key.to_ascii_lowercase();
            matches!(
                key.as_str(),
                "password"
                    | "secret"
                    | "token"
                    | "api_key"
                    | "apikey"
                    | "credential"
                    | "private_key"
                    | "client_secret"
                    | "authorization"
            ) || contains_secret_key(child)
        }),
        serde_json::Value::Array(items) => items.iter().any(contains_secret_key),
        _ => false,
    }
}

pub fn validate(input: &EngineWriteRequest) -> Result<(), &'static str> {
    if input.name.trim().is_empty() || input.name.len() > 120 {
        return Err("name must contain 1 to 120 characters");
    }
    if input.role.trim().is_empty() || input.role.len() > 64 {
        return Err("role must contain 1 to 64 characters");
    }
    let allowed = [
        "powerdns-authoritative",
        "unbound",
        "dnsdist",
        "freeradius",
        "victoriametrics",
        "victorialogs",
    ];
    if !allowed.contains(&input.engine_type.as_str()) {
        return Err("engine_type is not in the supported engine catalog");
    }
    if input.endpoint.len() > 2048 {
        return Err("endpoint must not exceed 2048 characters");
    }
    let url = reqwest::Url::parse(&input.endpoint)
        .map_err(|_| "endpoint must be an absolute engine URL")?;
    let valid_scheme = if input.engine_type == "freeradius" {
        url.scheme() == "radius"
    } else {
        matches!(url.scheme(), "http" | "https")
    };
    if !valid_scheme
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(
            "endpoint scheme must match engine type and must not contain embedded credentials",
        );
    }
    if let Some(config) = &input.config
        && contains_secret_key(config)
    {
        return Err("config must not contain secret values; reference them through secret_env_key");
    }
    if let Some(key) = &input.secret_env_key
        && (!key.starts_with("ATLAS_ENGINE_SECRET_")
            || key.len() > 128
            || !key
                .chars()
                .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_'))
    {
        return Err("secret_env_key must be an environment variable named ATLAS_ENGINE_SECRET_*");
    }
    Ok(())
}

pub async fn list() -> Result<Vec<EngineInstance>, sqlx::Error> {
    sqlx::query_as::<_, EngineInstance>(
        "SELECT id, name, engine_type, role, endpoint, enabled, labels, config, secret_env_key, CAST(created_at AS CHAR) AS created_at, CAST(updated_at AS CHAR) AS updated_at FROM engine_instances ORDER BY name",
    )
    .fetch_all(database::pool().await?)
    .await
}

pub async fn get(id: &str) -> Result<Option<EngineInstance>, sqlx::Error> {
    sqlx::query_as::<_, EngineInstance>(
        "SELECT id, name, engine_type, role, endpoint, enabled, labels, config, secret_env_key, CAST(created_at AS CHAR) AS created_at, CAST(updated_at AS CHAR) AS updated_at FROM engine_instances WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(database::pool().await?)
    .await
}

pub async fn create(input: &EngineWriteRequest) -> Result<EngineInstance, sqlx::Error> {
    let id = ulid::Ulid::new().to_string();
    sqlx::query(
        "INSERT INTO engine_instances (id, name, engine_type, role, endpoint, enabled, labels, config, secret_env_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(input.name.trim())
    .bind(&input.engine_type)
    .bind(input.role.trim())
    .bind(input.endpoint.trim_end_matches('/'))
    .bind(input.enabled)
    .bind(&input.labels)
    .bind(&input.config)
    .bind(&input.secret_env_key)
    .execute(database::pool().await?)
    .await?;
    get(&id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn update(
    id: &str,
    input: &EngineWriteRequest,
) -> Result<Option<EngineInstance>, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE engine_instances SET name = ?, engine_type = ?, role = ?, endpoint = ?, enabled = ?, labels = ?, config = ?, secret_env_key = ? WHERE id = ?",
    )
    .bind(input.name.trim())
    .bind(&input.engine_type)
    .bind(input.role.trim())
    .bind(input.endpoint.trim_end_matches('/'))
    .bind(input.enabled)
    .bind(&input.labels)
    .bind(&input.config)
    .bind(&input.secret_env_key)
    .bind(id)
    .execute(database::pool().await?)
    .await?;
    if result.rows_affected() == 0 {
        return Ok(None);
    }
    get(id).await
}

pub async fn delete(id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM engine_instances WHERE id = ?")
        .bind(id)
        .execute(database::pool().await?)
        .await?;
    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> EngineWriteRequest {
        EngineWriteRequest {
            name: "primary-pdns".to_string(),
            engine_type: "powerdns-authoritative".to_string(),
            role: "authoritative_dns".to_string(),
            endpoint: "http://pdns:8081".to_string(),
            enabled: true,
            labels: None,
            config: None,
            secret_env_key: Some("ATLAS_ENGINE_SECRET_PDNS_PRIMARY".to_string()),
        }
    }

    #[test]
    fn accepts_supported_engine_with_safe_endpoint() {
        assert!(validate(&sample()).is_ok());
    }

    #[test]
    fn rejects_secret_values_in_engine_config() {
        let mut input = sample();
        input.config = Some(serde_json::json!({
            "http": { "api_key": "must-not-be-persisted" }
        }));
        assert!(validate(&input).is_err());

        input.config = Some(serde_json::json!({
            "http": { "timeout_seconds": 5 },
            "labels": ["dns", "primary"]
        }));
        assert!(validate(&input).is_ok());
    }

    #[test]
    fn rejects_embedded_credentials_and_unknown_engine_types() {
        let mut input = sample();
        input.endpoint = "http://user:pass@pdns:8081".to_string();
        assert!(validate(&input).is_err());
        input.endpoint = "http://pdns:8081".to_string();
        input.engine_type = "unknown".to_string();
        assert!(validate(&input).is_err());
    }
}

#[cfg(test)]
mod secret_config_tests {
    use super::*;

    #[test]
    fn rejects_secret_fields_in_persisted_engine_config() {
        let value = serde_json::json!({
            "http": {
                "timeout_seconds": 5,
                "api_key": "must-not-be-persisted"
            }
        });
        assert!(contains_secret_key(&value));
        assert!(!contains_secret_key(&serde_json::json!({
            "http": { "timeout_seconds": 5 },
            "labels": ["dns", "primary"]
        })));
    }
}
