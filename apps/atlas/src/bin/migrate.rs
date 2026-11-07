use std::{env, error::Error, time::Duration};

use sqlx::mysql::MySqlPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let database_url = env::var("DATABASE_URL")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("ATLAS database migrations applied");
    pool.close().await;
    Ok(())
}
