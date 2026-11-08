use std::{
    env,
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use tokio::{io::AsyncWriteExt, process::Command};

use crate::engine::{EngineHealth, EngineInstance};

pub async fn probe(engine: &EngineInstance) -> EngineHealth {
    if engine.engine_type == "freeradius" {
        return probe_freeradius(engine).await;
    }
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
        "freeradius" => unreachable!("FreeRADIUS probe is handled before HTTP adapter dispatch"),
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

struct ProbeSecretFile(PathBuf);

impl ProbeSecretFile {
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for ProbeSecretFile {
    fn drop(&mut self) {
        // Drop also runs when the async probe future is cancelled.
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Create the RADIUS probe secret with restrictive permissions from the first
/// filesystem operation. Changing permissions after writing leaves a disclosure
/// window on shared temporary filesystems. The guard removes it on normal return
/// and on cancellation.
async fn write_probe_secret(secret: &str) -> std::io::Result<ProbeSecretFile> {
    let path = env::temp_dir().join(format!("atlas-radius-{}.secret", ulid::Ulid::new()));
    let mut options = tokio::fs::OpenOptions::new();
    options.write(true).create_new(true).mode(0o600);
    let mut file = options.open(&path).await?;

    if let Err(error) = file.write_all(format!("{secret}\n").as_bytes()).await {
        drop(file);
        let _ = tokio::fs::remove_file(&path).await;
        return Err(error);
    }
    drop(file);
    Ok(ProbeSecretFile(path))
}

async fn probe_freeradius(engine: &EngineInstance) -> EngineHealth {
    if !engine.enabled {
        return result(engine, "disabled", "engine instance is disabled");
    }
    let Some(secret_key) = engine.secret_env_key.as_ref() else {
        return result(
            engine,
            "not_configured",
            "RADIUS Status-Server secret reference is missing",
        );
    };
    let Ok(secret) = env::var(secret_key) else {
        return result(
            engine,
            "not_configured",
            "RADIUS Status-Server secret environment variable is missing",
        );
    };
    let Ok(url) = reqwest::Url::parse(&engine.endpoint) else {
        return result(engine, "invalid_endpoint", "RADIUS endpoint URL is invalid");
    };
    let Some(host) = url.host_str() else {
        return result(
            engine,
            "invalid_endpoint",
            "RADIUS endpoint host is missing",
        );
    };
    let port = url.port().unwrap_or(18121);
    let secret_path = match write_probe_secret(&secret).await {
        Ok(path) => path,
        Err(error) => {
            tracing::warn!(engine_id = %engine.id, %error, "could not prepare protected RADIUS probe secret");
            return result(
                engine,
                "error",
                "could not prepare protected RADIUS probe secret",
            );
        }
    };
    let child = Command::new("radclient")
        .arg("-q")
        .arg("-S")
        .arg(secret_path.path())
        .arg(format!("{host}:{port}"))
        .arg("status")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn();
    let outcome = match child {
        Ok(mut child) => {
            let write_result = if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(b"FreeRADIUS-Statistics-Type = 1\nMessage-Authenticator = 0x00\n")
                    .await
            } else {
                Err(std::io::Error::other("radclient stdin unavailable"))
            };
            if write_result.is_err() {
                let _ = child.kill().await;
                false
            } else {
                matches!(
                    tokio::time::timeout(Duration::from_secs(4), child.wait()).await,
                    Ok(Ok(status)) if status.success()
                )
            }
        }
        Err(error) => {
            tracing::warn!(engine_id = %engine.id, %error, "radclient could not be started");
            false
        }
    };
    if outcome {
        result(
            engine,
            "healthy",
            "FreeRADIUS answered a Status-Server request",
        )
    } else {
        result(
            engine,
            "unreachable",
            "FreeRADIUS Status-Server probe did not receive a valid response",
        )
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn radius_probe_secret_is_private_at_creation_and_removed_after_cleanup() {
        let secret = write_probe_secret("test-radius-shared-secret").await.unwrap();
        let path = secret.path().to_path_buf();
        let metadata = tokio::fs::metadata(&path).await.unwrap();
        assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
        assert_eq!(
            tokio::fs::read_to_string(&path).await.unwrap(),
            "test-radius-shared-secret\n"
        );
        drop(secret);
        assert!(!path.exists());
    }
}
