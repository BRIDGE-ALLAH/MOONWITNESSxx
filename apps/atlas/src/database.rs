use std::env;

use serde::Serialize;
use sqlx::{MySqlPool, mysql::MySqlPoolOptions};
use tokio::sync::OnceCell;

use crate::config::parse_db_max_connections;

static POOL: OnceCell<MySqlPool> = OnceCell::const_new();

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseStatus {
    NotConfigured,
    Available,
    Unavailable,
}

impl DatabaseStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotConfigured => "not_configured",
            Self::Available => "available",
            Self::Unavailable => "unavailable",
        }
    }
}

pub async fn probe() -> DatabaseStatus {
    let Ok(database_url) = env::var("DATABASE_URL") else {
        return DatabaseStatus::NotConfigured;
    };

    if database_url.trim().is_empty() {
        return DatabaseStatus::NotConfigured;
    }

    let max_connections =
        match parse_db_max_connections(env::var("DB_MAX_CONNECTIONS").ok().as_deref()) {
            Ok(value) => value,
            Err(error) => {
                tracing::error!(%error, "invalid ATLAS database pool configuration");
                return DatabaseStatus::Unavailable;
            }
        };

    let pool = POOL
        .get_or_try_init(|| async {
            MySqlPoolOptions::new()
                .max_connections(max_connections)
                .connect(&database_url)
                .await
        })
        .await;

    let Ok(pool) = pool else {
        return DatabaseStatus::Unavailable;
    };

    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
    {
        Ok(1) => DatabaseStatus::Available,
        _ => DatabaseStatus::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn database_status_serializes_truthfully() {
        assert_eq!(
            serde_json::to_string(&DatabaseStatus::NotConfigured).unwrap(),
            "\"not_configured\""
        );
        assert_eq!(DatabaseStatus::Available.as_str(), "available");
    }
}
