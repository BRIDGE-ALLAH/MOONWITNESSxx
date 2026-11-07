use std::{env, time::Duration};

use sqlx::{MySqlPool, mysql::MySqlPoolOptions};
use tokio::sync::OnceCell;

use crate::database::DatabaseStatus;

static POOL: OnceCell<MySqlPool> = OnceCell::const_new();

pub async fn pool() -> Result<&'static MySqlPool, sqlx::Error> {
    POOL.get_or_try_init(|| async {
        let database_url = env::var("RADIUS_DATABASE_URL")
            .map_err(|error| sqlx::Error::Configuration(Box::new(error)))?;
        if database_url.trim().is_empty() {
            return Err(sqlx::Error::Configuration(
                std::io::Error::other("RADIUS_DATABASE_URL is empty").into(),
            ));
        }
        MySqlPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(3))
            .connect(&database_url)
            .await
    })
    .await
}

pub async fn probe() -> DatabaseStatus {
    if env::var("RADIUS_DATABASE_URL").map_or(true, |value| value.trim().is_empty()) {
        return DatabaseStatus::NotConfigured;
    }
    let Ok(pool) = pool().await else {
        return DatabaseStatus::Unavailable;
    };
    match sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool).await {
        Ok(1) => DatabaseStatus::Available,
        _ => DatabaseStatus::Unavailable,
    }
}
