use std::{env, time::Duration};

use crate::engine::{EngineHealth, EngineInstance};

pub async fn probe(engine: &EngineInstance) -> EngineHealth {
    if !engine.enabled {
        return EngineHealth {
            engine_id: engine.id.clone(),
            engine_type: engine.engine_type.clone(),
            state: "disabled",
            detail: "engine instance is disabled",
        };
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    {
        Ok(client) => client,
        Err(_) => return result(engine, "error", "could not initialize HTTP client"),
    };

    let secret = engine
        .secret_env_key
        .as_ref()
        .and_then(|key| env::var(key).ok());

    let request = match engine.engine_type.as_str() {
        "powerdns-authoritative" => {
            let Some(secret) = secret else {
                return result(
                    engine,
                    "not_configured",
                    "PowerDNS API secret environment variable is missing",
                );
            };
            client
                .get(format!("{}/api/v1/servers/localhost", engine.endpoint))
                .header("X-API-Key", secret)
        }
        "victoriametrics" => client.get(format!("{}/health", engine.endpoint)),
        "victorialogs" => client.get(format!("{}/metrics", engine.endpoint)),
        "freeradius" => {
            return result(
                engine,
                "probe_unsupported",
                "RADIUS is UDP; configure a Status-Server probe or validate with radclient before marking it healthy",
            );
        }
        "unbound" | "dnsdist" => {
            return result(
                engine,
                "probe_unsupported",
                "this engine requires its native control protocol adapter",
            );
        }
        _ => return result(engine, "unsupported", "engine type has no health adapter"),
    };

    match request.send().await {
        Ok(response) if response.status().is_success() => result(
            engine,
            "healthy",
            "backend returned a successful health response",
        ),
        Ok(response) => {
            tracing::warn!(engine_id = %engine.id, status = %response.status(), "engine health probe failed");
            result(
                engine,
                "unhealthy",
                "backend returned a non-success HTTP status",
            )
        }
        Err(error) => {
            tracing::warn!(engine_id = %engine.id, %error, "engine health probe failed");
            result(
                engine,
                "unreachable",
                "backend could not be reached within the probe timeout",
            )
        }
    }
}

fn result(engine: &EngineInstance, state: &'static str, detail: &'static str) -> EngineHealth {
    EngineHealth {
        engine_id: engine.id.clone(),
        engine_type: engine.engine_type.clone(),
        state,
        detail,
    }
}
