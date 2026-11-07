use axum::{
    Json,
    extract::Path,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use loco_rs::prelude::*;
use serde::Serialize;
use subtle::ConstantTimeEq;

use crate::{
    adapters,
    cache::{self, CacheStatus},
    database::{self, DatabaseStatus},
    engine::{self, EngineWriteRequest},
    radius::{self, NasWriteRequest, SubscriberWriteRequest},
    radius_db,
};

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    database: DatabaseStatus,
    redis: CacheStatus,
    radius_database: DatabaseStatus,
}

#[derive(Debug, Serialize)]
struct ReadinessResponse {
    ready: bool,
    database: DatabaseStatus,
    redis: CacheStatus,
    radius_database: DatabaseStatus,
}

#[derive(Debug, Serialize)]
struct VersionResponse {
    name: &'static str,
    version: &'static str,
    build: &'static str,
}

#[derive(Debug, Serialize)]
struct EngineDescriptor {
    engine: &'static str,
    role: &'static str,
    adapter_status: &'static str,
}

#[derive(Debug, Serialize)]
struct EngineCatalogResponse {
    items: Vec<EngineDescriptor>,
}

#[derive(Debug, Serialize)]
struct ApiError {
    error: &'static str,
}

fn authorized(headers: &HeaderMap) -> Result<(), (StatusCode, Json<ApiError>)> {
    let Ok(expected) = std::env::var("ATLAS_CONTROL_TOKEN") else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiError {
                error: "control API is disabled until ATLAS_CONTROL_TOKEN is configured",
            }),
        ));
    };
    let Some(provided) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiError {
                error: "bearer token required",
            }),
        ));
    };
    let expected = expected.as_bytes();
    let provided = provided.as_bytes();
    if expected.len() < 32
        || expected.len() != provided.len()
        || !bool::from(expected.ct_eq(provided))
    {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiError {
                error: "invalid bearer token",
            }),
        ));
    }
    Ok(())
}

fn database_error() -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(ApiError {
            error: "database operation failed",
        }),
    )
}

async fn health() -> Json<HealthResponse> {
    let (database, redis, radius_database) =
        tokio::join!(database::probe(), cache::probe(), radius_db::probe());
    Json(HealthResponse {
        status: "ok",
        database,
        redis,
        radius_database,
    })
}

async fn readiness() -> (StatusCode, Json<ReadinessResponse>) {
    let (database, redis, radius_database) =
        tokio::join!(database::probe(), cache::probe(), radius_db::probe());
    let ready = database == DatabaseStatus::Available
        && redis == CacheStatus::Available
        && radius_database == DatabaseStatus::Available;
    let status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (
        status,
        Json(ReadinessResponse {
            ready,
            database,
            redis,
            radius_database,
        }),
    )
}

async fn version() -> Json<VersionResponse> {
    Json(VersionResponse {
        name: "ATLAS",
        version: env!("CARGO_PKG_VERSION"),
        build: option_env!("BUILD_SHA")
            .or(option_env!("GITHUB_SHA"))
            .unwrap_or("dev"),
    })
}

async fn engine_catalog() -> Json<EngineCatalogResponse> {
    Json(EngineCatalogResponse {
        items: vec![
            EngineDescriptor {
                engine: "powerdns-authoritative",
                role: "authoritative_dns",
                adapter_status: "http_health_and_api_probe",
            },
            EngineDescriptor {
                engine: "unbound",
                role: "recursive_dns",
                adapter_status: "native_control_adapter_pending",
            },
            EngineDescriptor {
                engine: "dnsdist",
                role: "dns_traffic_management",
                adapter_status: "native_control_adapter_pending",
            },
            EngineDescriptor {
                engine: "freeradius",
                role: "radius_authentication_accounting",
                adapter_status: "native_radius_status_probe",
            },
            EngineDescriptor {
                engine: "victoriametrics",
                role: "metrics_storage",
                adapter_status: "http_health_probe",
            },
            EngineDescriptor {
                engine: "victorialogs",
                role: "log_storage_and_search",
                adapter_status: "http_metrics_probe",
            },
        ],
    })
}

async fn list_engines(headers: HeaderMap) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match engine::list().await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to list engine instances");
            database_error().into_response()
        }
    }
}

async fn create_engine(
    headers: HeaderMap,
    Json(input): Json<EngineWriteRequest>,
) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    if let Err(message) = engine::validate(&input) {
        return (StatusCode::BAD_REQUEST, Json(ApiError { error: message })).into_response();
    }
    match engine::create(&input).await {
        Ok(item) => (StatusCode::CREATED, Json(item)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to create engine instance");
            database_error().into_response()
        }
    }
}

async fn get_engine(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match engine::get(&id).await {
        Ok(Some(item)) => (StatusCode::OK, Json(item)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: "engine instance not found",
            }),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to retrieve engine instance");
            database_error().into_response()
        }
    }
}

async fn update_engine(
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<EngineWriteRequest>,
) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    if let Err(message) = engine::validate(&input) {
        return (StatusCode::BAD_REQUEST, Json(ApiError { error: message })).into_response();
    }
    match engine::update(&id, &input).await {
        Ok(Some(item)) => (StatusCode::OK, Json(item)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: "engine instance not found",
            }),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to update engine instance");
            database_error().into_response()
        }
    }
}

async fn delete_engine(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) { return error.into_response(); }
    match engine::delete(&id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(ApiError { error: "engine instance not found" })).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to delete engine instance");
            database_error().into_response()
        }
    }
}

async fn engine_health(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) { return error.into_response(); }
    match engine::get(&id).await {
        Ok(Some(item)) => {
            (StatusCode::OK, Json(adapters::probe(&item).await)).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(ApiError { error: "engine instance not found" })).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to load engine for health probe");
            database_error().into_response()
        }
    }
}


async fn list_nas(headers: HeaderMap) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::list_nas().await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to list RADIUS NAS clients");
            database_error().into_response()
        }
    }
}

async fn create_nas(headers: HeaderMap, Json(input): Json<NasWriteRequest>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    if let Err(message) = radius::validate_nas(&input) {
        return (StatusCode::BAD_REQUEST, Json(ApiError { error: message })).into_response();
    }
    match radius::create_nas(&input).await {
        Ok(item) => (StatusCode::CREATED, Json(item)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to create RADIUS NAS client");
            database_error().into_response()
        }
    }
}

async fn delete_nas(headers: HeaderMap, Path(id): Path<i64>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::delete_nas(id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: "NAS client not found",
            }),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to delete RADIUS NAS client");
            database_error().into_response()
        }
    }
}

async fn list_subscribers(headers: HeaderMap) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::list_subscribers().await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to list RADIUS subscribers");
            database_error().into_response()
        }
    }
}

async fn upsert_subscriber(
    headers: HeaderMap,
    Json(input): Json<SubscriberWriteRequest>,
) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    if let Err(message) = radius::validate_subscriber(&input) {
        return (StatusCode::BAD_REQUEST, Json(ApiError { error: message })).into_response();
    }
    match radius::create_or_update_subscriber(&input).await {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "username": input.username,
                "credential_storage": "hashed",
                "authentication_effective": true
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to store RADIUS subscriber");
            database_error().into_response()
        }
    }
}

async fn delete_subscriber(headers: HeaderMap, Path(username): Path<String>) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::delete_subscriber(&username).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(ApiError {
                error: "subscriber not found",
            }),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to delete RADIUS subscriber");
            database_error().into_response()
        }
    }
}

async fn active_sessions(headers: HeaderMap) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::active_sessions().await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to list RADIUS active sessions");
            database_error().into_response()
        }
    }
}

async fn accounting_summary(headers: HeaderMap) -> impl IntoResponse {
    if let Err(error) = authorized(&headers) {
        return error.into_response();
    }
    match radius::accounting_summary().await {
        Ok(summary) => (StatusCode::OK, Json(summary)).into_response(),
        Err(error) => {
            tracing::error!(%error, "failed to summarize RADIUS accounting");
            database_error().into_response()
        }
    }
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/v1")
        .add("/system/health", get(health))
        .add("/system/readiness", get(readiness))
        .add("/system/version", get(version))
        .add("/engines/catalog", get(engine_catalog))
        .add("/engines", get(list_engines).post(create_engine))
        .add(
            "/engines/{id}",
            get(get_engine).put(update_engine).delete(delete_engine),
        )
        .add("/engines/{id}/health", get(engine_health))
        .add("/radius/nas", get(list_nas).post(create_nas))
        .add("/radius/nas/{id}", delete(delete_nas))
        .add(
            "/radius/subscribers",
            get(list_subscribers).post(upsert_subscriber),
        )
        .add("/radius/subscribers/{username}", delete(delete_subscriber))
        .add("/radius/sessions/active", get(active_sessions))
        .add("/radius/accounting/summary", get(accounting_summary))
}
