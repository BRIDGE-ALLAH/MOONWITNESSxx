use std::{env, time::Duration};

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

pub async fn pool() -> Result<&'static MySqlPool, sqlx::Error> {
    POOL.get_or_try_init(|| async {
        let database_url = env::var("DATABASE_URL")
            .map_err(|error| sqlx::Error::Configuration(Box::new(error)))?;
        if database_url.trim().is_empty() {
            return Err(sqlx::Error::Configuration(
                "DATABASE_URL is empty".into(),
            ));
        }

        let max_connections =
            parse_db_max_connections(env::var("DB_MAX_CONNECTIONS").ok().as_deref())
                .map_err(|error| {
                    sqlx::Error::Configuration(std::io::Error::other(error).into())
                })?;

        MySqlPoolOptions::new()
            .max_connections(max_connections)
            .acquire_timeout(Duration::from_secs(3))
            .connect(&database_url)
            .await
    })
    .await
}

pub async fn probe() -> DatabaseStatus {
    if env::var("DATABASE_URL").map_or(true, |value| value.trim().is_empty()) {
        return DatabaseStatus::NotConfigured;
    }

    let Ok(pool) = pool().await else {
        return DatabaseStatus::Unavailable;
    };

    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(*pool)
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
