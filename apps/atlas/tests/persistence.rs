use atlas::{
    database,
    engine::{self, EngineWriteRequest},
    radius::{self, GroupPolicyItem, GroupPolicyWriteRequest, NasWriteRequest, SubscriberWriteRequest},
    radius_db,
};
use sqlx::{Row, mysql::MySqlPoolOptions};
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

    let seeded_endpoint: String =
        sqlx::query_scalar("SELECT endpoint FROM engine_instances WHERE id = ?")
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

    let preserved_endpoint: String =
        sqlx::query_scalar("SELECT endpoint FROM engine_instances WHERE id = ?")
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
    assert!(
        engine::get(&created.id)
            .await
            .expect("read deleted engine")
            .is_none()
    );

    let row = sqlx::query("SELECT COUNT(*) AS total FROM engine_instances WHERE id = ?")
        .bind(&created.id)
        .fetch_one(pool)
        .await
        .expect("verify deletion");
    let total: i64 = row.try_get("total").expect("read count");
    assert_eq!(total, 0);

    let admin_pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&env::var("DATABASE_URL").expect("DATABASE_URL is configured"))
        .await
        .expect("connect to MariaDB admin database");
    sqlx::query("CREATE DATABASE IF NOT EXISTS radius")
        .execute(&admin_pool)
        .await
        .expect("create isolated RADIUS database");
    sqlx::raw_sql(include_str!("../docker/freeradius/mysql/schema.sql"))
        .execute(&admin_pool)
        .await
        .expect("install FreeRADIUS SQL schema");

    let radius_pool = radius_db::pool().await.expect("connect to RADIUS database");
    let nas_input = NasWriteRequest {
        nasname: "192.0.2.44".to_string(),
        shortname: Some("ci-nas".to_string()),
        nas_type: "other".to_string(),
        ports: Some(16),
        secret: "ci-radius-nas-secret-which-is-over-32".to_string(),
        description: Some("Isolated integration-test NAS".to_string()),
    };
    assert!(radius::validate_nas(&nas_input).is_ok());
    let nas = radius::create_nas(&nas_input).await.expect("create NAS client");
    assert!(nas.secret_configured);
    let updated_nas = NasWriteRequest {
        description: Some("Updated integration-test NAS".to_string()),
        ..nas_input
    };
    let nas = radius::update_nas(nas.id, &updated_nas)
        .await
        .expect("update NAS client")
        .expect("NAS client remains present");
    assert_eq!(nas.description.as_deref(), Some("Updated integration-test NAS"));
    assert!(radius::delete_nas(nas.id).await.expect("delete NAS client"));

    let subscriber = SubscriberWriteRequest {
        username: format!("ci-user-{}", ulid::Ulid::new()),
        password: "correct horse battery staple".to_string(),
        groupname: Some("ci-integration-policy".to_string()),
        credential_mode: "bcrypt".to_string(),
    };
    assert!(radius::validate_subscriber(&subscriber).is_ok());
    radius::create_or_update_subscriber(&subscriber)
        .await
        .expect("persist bcrypt subscriber credential");
    let subscribers = radius::list_subscribers().await.expect("list subscribers");
    assert!(subscribers.iter().any(|item| item.username == subscriber.username));
    let (attribute, stored_value): (String, String) =
        sqlx::query_as("SELECT attribute, value FROM radcheck WHERE username = ?")
            .bind(&subscriber.username)
            .fetch_one(radius_pool)
            .await
            .expect("read stored subscriber credential");
    assert_eq!(attribute, "Crypt-Password");
    assert_ne!(stored_value, subscriber.password);
    assert!(radius::delete_subscriber(&subscriber.username)
        .await
        .expect("delete subscriber"));

    let group_policy = GroupPolicyWriteRequest {
        groupname: "ci-integration-policy".to_string(),
        policies: vec![GroupPolicyItem {
            attribute: "Mikrotik-Rate-Limit".to_string(),
            op: ":=".to_string(),
            value: "10M/10M".to_string(),
        }],
    };
    assert!(radius::validate_group_policy(&group_policy).is_ok());
    radius::replace_group_policy(&group_policy)
        .await
        .expect("persist RADIUS group policy");
    let policies = radius::list_group_policies()
        .await
        .expect("list RADIUS group policies");
    assert!(policies.iter().any(|item| {
        item.groupname == "ci-integration-policy" && item.value == "10M/10M"
    }));
    assert!(radius::delete_group_policy("ci-integration-policy")
        .await
        .expect("delete RADIUS group policy"));

    let summary = radius::accounting_summary()
        .await
        .expect("read empty RADIUS accounting summary");
    assert_eq!(summary.total_sessions, 0);
}
