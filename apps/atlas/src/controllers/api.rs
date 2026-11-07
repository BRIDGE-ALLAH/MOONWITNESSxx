use axum::{Json, http::StatusCode};
use loco_rs::prelude::*;
use serde::Serialize;

use crate::{
    cache::{self, CacheStatus},
    database::{self, DatabaseStatus},
};

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    database: DatabaseStatus,
    redis: CacheStatus,
}

#[derive(Debug, Serialize)]
struct ReadinessResponse {
    ready: bool,
    database: DatabaseStatus,
    redis: CacheStatus,
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

async fn health() -> Json<HealthResponse> {
    let (database, redis) = tokio::join!(database::probe(), cache::probe());
    Json(HealthResponse {
        status: "ok",
        database,
        redis,
    })
}

async fn readiness() -> (StatusCode, Json<ReadinessResponse>) {
    let (database, redis) = tokio::join!(database::probe(), cache::probe());
    let ready = database == DatabaseStatus::Available && redis == CacheStatus::Available;
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
                adapter_status: "not_implemented",
            },
            EngineDescriptor {
                engine: "unbound",
                role: "recursive_dns",
                adapter_status: "not_implemented",
            },
            EngineDescriptor {
                engine: "dnsdist",
                role: "dns_traffic_management",
                adapter_status: "not_implemented",
            },
            EngineDescriptor {
                engine: "freeradius",
                role: "radius_authentication_accounting",
                adapter_status: "external_engine_not_connected",
            },
            EngineDescriptor {
                engine: "victoriametrics",
                role: "metrics_storage",
                adapter_status: "not_implemented",
            },
            EngineDescriptor {
                engine: "victorialogs",
                role: "log_storage_and_search",
                adapter_status: "not_implemented",
            },
        ],
    })
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/v1")
        .add("/system/health", get(health))
        .add("/system/readiness", get(readiness))
        .add("/system/version", get(version))
        .add("/engines/catalog", get(engine_catalog))
}
