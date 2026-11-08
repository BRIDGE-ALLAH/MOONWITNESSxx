use atlas::{
    database,
    engine::{self, EngineWriteRequest},
};
use sqlx::Row;
use std::env;

const SEEDED_RADIUS_ID: &str = "01K9Z0J8A1B2C3D4E5F6G7H8J9";

#[tokio::test]
async fn mariadb_migrations_seed_and_engine_crud_are_persistent() {
    if env::var("DATABASE_URL").is_err() {
        eprintln!("Skipping MariaDB persistence test: DATABASE_URL is not configured");
        return;
    }

    let pool = database::pool().await.expect("connect to test MariaDB");
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .expect("apply ATLAS migrations");

    let seeded_endpoint: String = sqlx::query_scalar(
        "SELECT endpoint FROM engine_instances WHERE id = ?",
    )
    .bind(SEEDED_RADIUS_ID)
    .fetch_one(pool)
    .await
    .expect("find seeded FreeRADIUS engine");
    assert_eq!(seeded_endpoint, "radius://freeradius:18121");

    sqlx::query("UPDATE engine_instances SET endpoint = ? WHERE id = ?")
        .bind("radius://radius-operator-change:18121")
        .bind(SEEDED_RADIUS_ID)
        .execute(pool)
        .await
        .expect("simulate an operator-managed endpoint change");

    sqlx::raw_sql(include_str!(
        "../migrations/20261108002000_seed_local_engines.sql"
    ))
    .execute(pool)
    .await
    .expect("replay idempotent engine seed");

    let preserved_endpoint: String = sqlx::query_scalar(
        "SELECT endpoint FROM engine_instances WHERE id = ?",
    )
    .bind(SEEDED_RADIUS_ID)
    .fetch_one(pool)
    .await
    .expect("read operator-managed endpoint");
    assert_eq!(preserved_endpoint, "radius://radius-operator-change:18121");

    let input = EngineWriteRequest {
        name: format!("ci-engine-{}", ulid::Ulid::new()),
        engine_type: "powerdns-authoritative".to_string(),
        role: "authoritative_dns".to_string(),
        endpoint: "http://powerdns.test:8081".to_string(),
        enabled: true,
        labels: Some(serde_json::json!({"scope": "integration-test"})),
        config: Some(serde_json::json!({"timeout_seconds": 5})),
        secret_env_key: Some("ATLAS_ENGINE_SECRET_CI".to_string()),
    };

    let created = engine::create(&input).await.expect("create engine");
    assert_eq!(created.name, input.name);

    let read = engine::get(&created.id)
        .await
        .expect("read engine")
        .expect("created engine must exist");
    assert_eq!(read.endpoint, input.endpoint);

    let listed = engine::list().await.expect("list engines");
    assert!(listed.iter().any(|item| item.id == created.id));

    let updated_input = EngineWriteRequest {
        endpoint: "https://powerdns.test:8081".to_string(),
        ..input
    };
    let updated = engine::update(&created.id, &updated_input)
        .await
        .expect("update engine")
        .expect("updated engine must exist");
    assert_eq!(updated.endpoint, "https://powerdns.test:8081");

    assert!(engine::delete(&created.id).await.expect("delete engine"));
    assert!(engine::get(&created.id).await.expect("read deleted engine").is_none());

    let row = sqlx::query("SELECT COUNT(*) AS total FROM engine_instances WHERE id = ?")
        .bind(&created.id)
        .fetch_one(pool)
        .await
        .expect("verify deletion");
    let total: i64 = row.try_get("total").expect("read count");
    assert_eq!(total, 0);
}
