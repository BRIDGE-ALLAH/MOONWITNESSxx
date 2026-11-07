use std::env;

use redis::{aio::MultiplexedConnection, Client, RedisError};
use tokio::sync::OnceCell;

static CLIENT: OnceCell<Client> = OnceCell::const_new();

#[derive(Debug, Clone, Copy, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CacheStatus {
    NotConfigured,
    Available,
    Unavailable,
}

impl CacheStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotConfigured => "not_configured",
            Self::Available => "available",
            Self::Unavailable => "unavailable",
        }
    }
}

async fn connection() -> Result<MultiplexedConnection, RedisError> {
    let client = CLIENT
        .get_or_try_init(|| async {
            let url = env::var("REDIS_URL").map_err(|_| {
                RedisError::from((
                    redis::ErrorKind::InvalidClientConfig,
                    "REDIS_URL is not configured",
                ))
            })?;
            Client::open(url)
        })
        .await?;

    client.get_multiplexed_async_connection().await
}

pub async fn probe() -> CacheStatus {
    if env::var("REDIS_URL").map_or(true, |value| value.trim().is_empty()) {
        return CacheStatus::NotConfigured;
    }

    let Ok(mut connection) = connection().await else {
        return CacheStatus::Unavailable;
    };

    match redis::cmd("PING")
        .query_async::<String>(&mut connection)
        .await
    {
        Ok(response) if response == "PONG" => CacheStatus::Available,
        _ => CacheStatus::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_status_serializes_truthfully() {
        assert_eq!(
            serde_json::to_string(&CacheStatus::NotConfigured).unwrap(),
            "\"not_configured\""
        );
        assert_eq!(CacheStatus::Available.as_str(), "available");
    }
}
