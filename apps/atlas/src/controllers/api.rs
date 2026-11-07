use axum::{http::StatusCode, Json};
use loco_rs::prelude::*;
use serde::Serialize;

use crate::database::{self, DatabaseStatus};

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    database: DatabaseStatus,
}

#[derive(Debug, Serialize)]
struct ReadinessResponse {
    ready: bool,
    database: DatabaseStatus,
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
    let database = database::probe().await;
    Json(HealthResponse {
        status: "ok",
        database,
    })
}

async fn readiness() -> (StatusCode, Json<ReadinessResponse>) {
    let database = database::probe().await;
    let ready = database == DatabaseStatus::Available;
    let status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status, Json(ReadinessResponse { ready, database }))
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
                engine: "victoriametrics",
                role: "metrics_storage",
                adapter_status: "not_implemented",
            },
            EngineDescriptor {
                engine: "clickhouse",
                role: "log_analytics_storage",
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
