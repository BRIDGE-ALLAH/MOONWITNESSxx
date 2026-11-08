// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tauri::Manager;

mod riot_release;
mod riot_release_build;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemMetrics {
    pub timestamp_ms: u128,
    pub host: String,
    pub active_containers: u32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub status: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgiNode {
    pub id: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub latency_ms: Option<f64>,
    pub uptime: Option<String>,
    pub load: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgiProbe {
    pub status: Option<String>,
    pub latency_ms: Option<f64>,
    pub target: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgiSnapshot {
    pub environment: Option<String>,
    pub target_host: Option<String>,
    pub probe: Option<AgiProbe>,
    pub nodes: Option<Vec<AgiNode>>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgiSuggestedAction {
    pub action_id: String,
    pub label: String,
    pub reason: String,
    pub requires_confirmation: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgiAnalysis {
    pub answer: String,
    pub confidence: String,
    pub citations: Vec<String>,
    pub suggested_actions: Vec<AgiSuggestedAction>,
    pub provider: String,
    pub disclaimer: String,
    pub model: Option<String>,
}

// Telemetry contracts
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProbeTelemetry {
    pub status: String,
    pub latency_ms: f64,
    pub target: String,
    pub ok: bool,
    pub error: Option<String>,
    pub kind: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NodeTelemetry {
    pub id: String,
    pub name: String,
    pub category: String,
    pub status: String,
    pub latency_ms: f64,
    pub uptime: Option<String>,
    pub load: Option<String>,
    pub probe: ProbeTelemetry,
    pub source: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CockpitSnapshot {
    pub timestamp: String,
    pub environment: String,
    pub target_host: String,
    pub probe: ProbeTelemetry,
    pub nodes: Vec<NodeTelemetry>,
    pub recent_logs: Vec<serde_json::Value>,
    pub source: String,
}

// Audit event
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: String,
    pub ts: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub action_id: Option<String>,
    pub source: Option<String>,
    pub actor: Option<String>,
    pub result: Option<String>,
    pub environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

struct NodeCfg {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    kind: &'static str,
    target: &'static str,
    timeout_ms: u64,
}

// Mirrors frontend SSoT `src/lib/envConfig.ts` (ENVIRONMENT_IDS, node ids,
// names, categories, kinds, targets, timeoutMs). Contract tests assert alignment.
fn env_nodes(env: &str) -> Option<Vec<NodeCfg>> {
    match env {
        "local" => Some(vec![
            NodeCfg { id: "arsy", name: "ARSY CORE ORCHESTRATOR", category: "core", kind: "http", target: "http://localhost:4000/health/live", timeout_ms: 1500 },
            NodeCfg { id: "oracle", name: "ORACLE PYTHON ENGINE", category: "analytics", kind: "http", target: "http://localhost:8000/health/live", timeout_ms: 1500 },
            NodeCfg { id: "postgres", name: "POSTGRESQL PRIMARY CLUSTER", category: "database", kind: "tcp", target: "localhost:5432", timeout_ms: 1500 },
            NodeCfg { id: "radius", name: "ATLAS FREERADIUS RUNTIME", category: "network", kind: "tcp", target: "localhost:1812", timeout_ms: 1500 },
        ]),
        "development" => Some(vec![
            NodeCfg { id: "arsy", name: "ARSY CORE ORCHESTRATOR", category: "core", kind: "http", target: "http://localhost:4000/health/live", timeout_ms: 2000 },
            NodeCfg { id: "oracle", name: "ORACLE PYTHON ENGINE", category: "analytics", kind: "http", target: "http://localhost:8000/health/live", timeout_ms: 2000 },
            NodeCfg { id: "postgres", name: "POSTGRESQL PRIMARY CLUSTER", category: "database", kind: "tcp", target: "localhost:5432", timeout_ms: 2000 },
            NodeCfg { id: "radius", name: "ATLAS FREERADIUS RUNTIME", category: "network", kind: "tcp", target: "localhost:1812", timeout_ms: 2000 },
        ]),
        "production" => Some(vec![
            NodeCfg { id: "arsy", name: "ARSY CORE ORCHESTRATOR", category: "core", kind: "http", target: "http://localhost:4000/health/live", timeout_ms: 3000 },
            NodeCfg { id: "oracle", name: "ORACLE PYTHON ENGINE", category: "analytics", kind: "http", target: "http://localhost:8000/health/live", timeout_ms: 3000 },
            NodeCfg { id: "postgres", name: "POSTGRESQL PRIMARY CLUSTER", category: "database", kind: "tcp", target: "localhost:5432", timeout_ms: 3000 },
            NodeCfg { id: "radius", name: "ATLAS FREERADIUS RUNTIME", category: "network", kind: "tcp", target: "localhost:1812", timeout_ms: 3000 },
        ]),
        _ => None,
    }
}

fn unknown_environment_error(env: &str) -> String {
    format!("unknown environment '{}'; expected local, development, or production", env)
}


async fn probe_node(cfg: NodeCfg) -> NodeTelemetry {
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    let iso = chrono_like_now();
    let start = std::time::Instant::now();
    let (status, latency, ok, error, kind) = if cfg.kind == "http" {
        let client = reqwest::Client::builder().timeout(std::time::Duration::from_millis(cfg.timeout_ms)).build().unwrap_or_default();
        let res = tokio::time::timeout(std::time::Duration::from_millis(cfg.timeout_ms), client.get(cfg.target).send()).await;
        match res {
            Ok(Ok(r)) => {
                let ok = r.status().is_success();
                let st = if ok { "HEALTHY" } else { "WARNING" };
                let err = if ok { None } else { Some(format!("HTTP {}", r.status())) };
                (st.to_string(), start.elapsed().as_millis() as f64, ok, err, "http")
            }
            Ok(Err(e)) => ("OFFLINE".to_string(), start.elapsed().as_millis() as f64, false, Some(e.to_string()), "http"),
            Err(_) => ("OFFLINE".to_string(), cfg.timeout_ms as f64, false, Some("timeout".to_string()), "http"),
        }
    } else {
        let r = tokio::time::timeout(std::time::Duration::from_millis(cfg.timeout_ms), tokio::net::TcpStream::connect(cfg.target)).await;
        match r {
            Ok(Ok(_)) => ("HEALTHY".to_string(), start.elapsed().as_millis() as f64, true, None, "tcp"),
            Ok(Err(e)) => ("OFFLINE".to_string(), start.elapsed().as_millis() as f64, false, Some(e.to_string()), "tcp"),
            Err(_) => ("OFFLINE".to_string(), cfg.timeout_ms as f64, false, Some("timeout".to_string()), "tcp"),
        }
    };
    let _ = ts;
    NodeTelemetry {
        id: cfg.id.to_string(),
        name: cfg.name.to_string(),
        category: cfg.category.to_string(),
        status: status.clone(),
        latency_ms: latency,
        uptime: Some(if ok { "99.99%".to_string() } else { "0.00%".to_string() }),
        load: Some("n/a".to_string()),
        probe: ProbeTelemetry {
            status,
            latency_ms: latency,
            target: cfg.target.to_string(),
            ok,
            error,
            kind: Some(kind.to_string()),
        },
        source: "backend".to_string(),
        timestamp: iso,
    }
}

fn chrono_like_now() -> String {
    // ISO-8601-ish using system time seconds
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    format!("{}", secs)
}

#[tauri::command]
async fn get_cockpit_telemetry(environment: String) -> Result<CockpitSnapshot, String> {
    let nodes_cfg = env_nodes(&environment).ok_or_else(|| unknown_environment_error(&environment))?;
    let mut handles = Vec::new();
    for cfg in nodes_cfg {
        handles.push(tokio::spawn(probe_node(cfg)));
    }
    let mut nodes = Vec::new();
    for h in handles {
        if let Ok(n) = h.await {
            nodes.push(n);
        }
    }
    let arsy_probe = nodes.iter().find(|n| n.id == "arsy").map(|n| n.probe.clone()).unwrap_or(ProbeTelemetry {
        status: "OFFLINE".to_string(),
        latency_ms: 0.0,
        target: "http://localhost:4000/health/live".to_string(),
        ok: false,
        error: Some("missing".to_string()),
        kind: Some("http".to_string()),
    });
    let iso = chrono_like_now();
    Ok(CockpitSnapshot {
        timestamp: iso.clone(),
        environment: environment.clone(),
        target_host: environment.clone(),
        probe: arsy_probe,
        nodes,
        recent_logs: vec![],
        source: "backend".to_string(),
    })
}

// Keychain
#[tauri::command]
fn keychain_get(account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("moonwitness-cockpit", &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keychain_set(account: String, secret: String) -> Result<(), String> {
    let entry = keyring::Entry::new("moonwitness-cockpit", &account).map_err(|e| e.to_string())?;
    entry.set_password(&secret).map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_delete(account: String) -> Result<(), String> {
    let entry = keyring::Entry::new("moonwitness-cockpit", &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// LLM
const LLM_SERVICE: &str = "moonwitness-cockpit";
const LLM_ACCOUNT: &str = "llm-api-key";
const LLM_BASE_URL: &str = "http://localhost:11434/v1/chat/completions";
const LLM_DEFAULT_MODEL: &str = "llama3";

// Bounds so oversized snapshots cannot inflate the completion payload.
const MAX_NODES_IN_PROMPT: usize = 20;
const MAX_LOGS_IN_PROMPT: usize = 5;
const MAX_LOG_TEXT_CHARS: usize = 200;
const MAX_TELEMETRY_CHARS: usize = 3000;

const SYSTEM_PROMPT: &str = "You are an ops copilot for MOONWITNESS COCKPIT. Answer using ONLY the provided cockpit snapshot telemetry. Do not invent nodes, facts, commands, or secrets. Cite concrete node/probe facts (id, name, status, latency_ms, uptime, load, error, source, port). Suggest actions only as drafts requiring explicit human confirmation — never claim to execute actions, never run commands, and never request API keys or secrets. If the snapshot is empty or stale, say so and use low confidence. Keep answers concise and operations-focused.";

fn get_str(v: &serde_json::Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn get_opt_str(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn get_opt_bool(v: &serde_json::Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_bool())
        .map(|b| b.to_string())
        .unwrap_or_else(|| get_str(v, key))
}

fn top<'a>(snapshot: &'a serde_json::Value, camel: &str, snake: &str) -> &'a serde_json::Value {
    snapshot
        .get(camel)
        .or_else(|| snapshot.get(snake))
        .unwrap_or(&serde_json::Value::Null)
}

fn bound_text(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect::<String>() + " … [truncated]"
    }
}

fn build_telemetry(snapshot: &serde_json::Value) -> String {
    let environment = get_opt_str(snapshot, "environment").unwrap_or_default();
    let target_host = get_opt_str(snapshot, "targetHost")
        .or_else(|| get_opt_str(snapshot, "target_host"))
        .unwrap_or_default();
    let timestamp = get_opt_str(snapshot, "timestamp");

    let probe = top(snapshot, "probe", "probe");
    let nodes = top(snapshot, "nodes", "nodes");
    let logs = top(snapshot, "recentLogs", "recent_logs");

    let mut parts: Vec<String> = Vec::new();
    parts.push(format!("environment={}", environment));
    parts.push(format!("target_host={}", target_host));
    if let Some(ts) = &timestamp {
        parts.push(format!("snapshot_timestamp={}", ts));
    }
    parts.push(format!(
        "probe={{status={} latency_ms={} target={} ok={} error={}}}",
        get_str(probe, "status"),
        probe.get("latency_ms").and_then(|x| x.as_f64()).unwrap_or(0.0),
        get_str(probe, "target"),
        get_opt_bool(probe, "ok"),
        get_opt_str(probe, "error").unwrap_or_else(|| "none".to_string())
    ));

    if let Some(arr) = nodes.as_array() {
        for (i, n) in arr.iter().take(MAX_NODES_IN_PROMPT).enumerate() {
            parts.push(format!(
                "node[{}]={{id={} name={} category={} status={} latency_ms={} uptime={} load={} error={} source={} port={}}}",
                i,
                get_str(n, "id"),
                get_str(n, "name"),
                get_str(n, "category"),
                get_str(n, "status"),
                n.get("latency_ms").and_then(|x| x.as_f64()).unwrap_or(0.0),
                get_opt_str(n, "uptime").unwrap_or_else(|| "n/a".to_string()),
                get_opt_str(n, "load").unwrap_or_else(|| "n/a".to_string()),
                get_opt_str(n, "error").unwrap_or_else(|| "none".to_string()),
                get_opt_str(n, "source").unwrap_or_else(|| "unknown".to_string()),
                get_opt_str(n, "port").unwrap_or_else(|| "n/a".to_string()),
            ));
        }
        if arr.len() > MAX_NODES_IN_PROMPT {
            parts.push(format!("… {} more nodes omitted", arr.len() - MAX_NODES_IN_PROMPT));
        }
    }

    if let Some(arr) = logs.as_array() {
        for (i, entry) in arr.iter().take(MAX_LOGS_IN_PROMPT).enumerate() {
            let text = if entry.is_string() {
                entry.as_str().unwrap_or("").to_string()
            } else {
                get_opt_str(entry, "text").unwrap_or_else(|| entry.to_string())
            };
            parts.push(format!("log[{}]: {}", i, bound_text(&text, MAX_LOG_TEXT_CHARS)));
        }
    }

    bound_text(&parts.join(" | "), MAX_TELEMETRY_CHARS)
}

fn build_user_prompt(snapshot: &serde_json::Value, question: &str) -> String {
    format!(
        "TELEMETRY: {}\n\nQUESTION: {}\n\nReply with: a short answer grounded in the telemetry above, a confidence level (High/Medium/Low), concrete citations, and any suggested actions framed as drafts that require operator confirmation before execution.",
        build_telemetry(snapshot),
        question
    )
}

fn build_citations(snapshot: &serde_json::Value) -> Vec<String> {
    let mut citations: Vec<String> = Vec::new();
    let probe = top(snapshot, "probe", "probe");
    if !probe.is_null() {
        citations.push(format!(
            "probe target={} status={} latency={}ms ok={}",
            get_str(probe, "target"),
            get_str(probe, "status"),
            probe.get("latency_ms").and_then(|x| x.as_f64()).unwrap_or(0.0),
            get_opt_bool(probe, "ok")
        ));
        if let Some(err) = get_opt_str(probe, "error") {
            if !err.is_empty() {
                citations.push(format!("probe error={}", err));
            }
        }
    }
    if let Some(arr) = top(snapshot, "nodes", "nodes").as_array() {
        for n in arr.iter().take(8) {
            citations.push(format!(
                "node {} [{}] category={} status={} latency={}ms uptime={} load={} source={} port={}",
                get_str(n, "id"),
                get_str(n, "name"),
                get_str(n, "category"),
                get_str(n, "status"),
                n.get("latency_ms").and_then(|x| x.as_f64()).unwrap_or(0.0),
                get_opt_str(n, "uptime").unwrap_or_else(|| "n/a".to_string()),
                get_opt_str(n, "load").unwrap_or_else(|| "n/a".to_string()),
                get_opt_str(n, "source").unwrap_or_else(|| "unknown".to_string()),
                get_opt_str(n, "port").unwrap_or_else(|| "n/a".to_string()),
            ));
        }
    }
    citations
}

fn parse_confidence(answer: &str) -> String {
    let q = answer.to_lowercase();
    for (needle, label) in [
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ] {
        if q.contains(&format!("confidence: {}", needle)) || q.contains(&format!("confidence {}", needle))
        {
            return label.to_string();
        }
    }
    "Medium".to_string()
}

fn parse_suggested_actions(answer: &str) -> Vec<AgiSuggestedAction> {
    let q = answer.to_lowercase();
    let mut actions: Vec<AgiSuggestedAction> = Vec::new();
    let push = |actions: &mut Vec<AgiSuggestedAction>, action_id: &str, label: &str, reason: &str| {
        actions.push(AgiSuggestedAction {
            action_id: action_id.to_string(),
            label: label.to_string(),
            reason: reason.to_string(),
            requires_confirmation: true,
        });
    };
    if q.contains("diagnostic") || q.contains("health check") || q.contains("sweep") {
        push(
            &mut actions,
            "DIAGNOSTIC_HEALTH_CHECK",
            "Draft: Run diagnostics sweep",
            "LLM-suggested diagnostic draft; requires operator confirmation before dispatch.",
        );
    }
    if q.contains("cache") || q.contains("flush") || q.contains("redis") {
        push(
            &mut actions,
            "FLUSH_CONTAINER_CACHE",
            "Draft: Flush container cache",
            "LLM-suggested cache flush draft; requires operator confirmation before dispatch.",
        );
    }
    if q.contains("socket") || q.contains("connector") || q.contains("recycle") || q.contains("cycle") {
        push(
            &mut actions,
            "CYCLE_SOCKET_CONNECTOR",
            "Draft: Recycle socket connector",
            "LLM-suggested connector recycle draft; requires operator confirmation before dispatch.",
        );
    }
    if q.contains("lockdown") || q.contains("emergency") || q.contains("degrade") || q.contains("fail-closed")
    {
        push(
            &mut actions,
            "EMERGENCY_DEGRADE_SYSTEM",
            "Draft: Fail-closed lockdown mode",
            "LLM-suggested emergency degrade draft; explicit operator authorization required.",
        );
    }
    actions
}

#[tauri::command]
async fn llm_analyze(snapshot: serde_json::Value, question: String) -> Result<AgiAnalysis, String> {
    let entry = keyring::Entry::new(LLM_SERVICE, LLM_ACCOUNT).map_err(|e| e.to_string())?;
    let secret = entry.get_password().map_err(|_| "llm-secret-not-configured".to_string())?;
    let client = reqwest::Client::new();
    let user_prompt = build_user_prompt(&snapshot, &question);
    let body = serde_json::json!({
        "model": LLM_DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": false,
        "temperature": 0.2
    });
    let resp = client
        .post(LLM_BASE_URL)
        .bearer_auth(&secret)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let answer = v["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
    let model = v
        .get("model")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .or_else(|| Some(LLM_DEFAULT_MODEL.to_string()));
    let confidence = parse_confidence(&answer);
    let citations = build_citations(&snapshot);
    let suggested_actions = parse_suggested_actions(&answer);

    Ok(AgiAnalysis {
        answer,
        confidence,
        citations,
        suggested_actions,
        provider: "remote-llm".to_string(),
        disclaimer: "AI assistive output only. Verify telemetry and obtain human approval before taking operator actions."
            .to_string(),
        model,
    })
}

#[tauri::command]
async fn llm_analyze_stream(snapshot: serde_json::Value, question: String) -> Result<AgiAnalysis, String> {
    // MVP: requests OpenAI-compatible SSE (`stream: true`) but accumulates chunks server-side
    // and returns the final AgiAnalysis. The UI is not per-chunk streamed.
    let entry = keyring::Entry::new(LLM_SERVICE, LLM_ACCOUNT).map_err(|e| e.to_string())?;
    let secret = entry.get_password().map_err(|_| "llm-secret-not-configured".to_string())?;
    let client = reqwest::Client::new();
    let user_prompt = build_user_prompt(&snapshot, &question);
    let body = serde_json::json!({
        "model": LLM_DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": true,
        "temperature": 0.2
    });
    let resp = client
        .post(LLM_BASE_URL)
        .bearer_auth(&secret)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("llm-http-error {}: {}", status, bound_text(&body, 300)));
    }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let mut answer = String::new();
    let mut model: Option<String> = None;
    for line in text.lines() {
        let line = line.trim();
        if !line.starts_with("data:") { continue; }
        let payload = line.trim_start_matches("data:").trim();
        if payload.is_empty() || payload == "[DONE]" { continue; }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) {
            if let Some(c) = v["choices"][0]["delta"]["content"].as_str() {
                answer.push_str(c);
            }
            if model.is_none() {
                model = v.get("model").and_then(|x| x.as_str()).map(|s| s.to_string());
            }
        }
    }
    if answer.trim().is_empty() {
        return Err("llm-stream-empty-response".to_string());
    }
    if model.is_none() { model = Some(LLM_DEFAULT_MODEL.to_string()); }
    let confidence = parse_confidence(&answer);
    let citations = build_citations(&snapshot);
    let suggested_actions = parse_suggested_actions(&answer);

    Ok(AgiAnalysis {
        answer,
        confidence,
        citations,
        suggested_actions,
        provider: "remote-llm".to_string(),
        disclaimer: "AI assistive output only. Verify telemetry and obtain human approval before taking operator actions."
            .to_string(),
        model,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot_json() -> serde_json::Value {
        serde_json::json!({
            "timestamp": "2026-01-01T00:00:00Z",
            "environment": "test-env",
            "targetHost": "test-host",
            "probe": {"status": "HEALTHY", "latency_ms": 12, "target": "http://localhost:4000/health/live", "ok": true},
            "nodes": [
                {"id": "arsy", "name": "ARSY CORE", "category": "core", "status": "HEALTHY", "latency_ms": 10, "uptime": "99%", "load": "1", "source": "backend", "port": 4000},
                {"id": "oracle", "name": "ORACLE", "category": "analytics", "status": "OFFLINE", "latency_ms": 5000, "error": "timeout", "source": "backend", "port": 8000},
            ],
            "recentLogs": [{"text": "[INIT] cockpit started"}, "plain log entry"],
        })
    }

    #[test]
    fn telemetry_includes_key_facts_and_is_bounded() {
        let snap = snapshot_json();
        let tel = build_telemetry(&snap);
        assert!(tel.contains("environment=test-env"));
        assert!(tel.contains("target_host=test-host"));
        assert!(tel.contains("snapshot_timestamp=2026-01-01T00:00:00Z"));
        assert!(tel.contains("probe={status=HEALTHY"));
        assert!(tel.contains("node[0]={id=arsy"));
        assert!(tel.contains("status=OFFLINE"));
        assert!(tel.contains("log[0]:"));
        assert!(tel.len() <= MAX_TELEMETRY_CHARS + 16);
    }

    #[test]
    fn nodes_beyond_cap_are_omitted_with_notice() {
        let mut snap = snapshot_json();
        let many: Vec<serde_json::Value> = (0..25)
            .map(|i| {
                serde_json::json!({
                    "id": format!("n{}", i),
                    "name": format!("Node {}", i),
                    "category": "core",
                    "status": "HEALTHY",
                    "latency_ms": 1.0
                })
            })
            .collect();
        snap.as_object_mut()
            .unwrap()
            .insert("nodes".to_string(), serde_json::Value::Array(many));
        let tel = build_telemetry(&snap);
        let count = tel.matches("node[").count();
        assert_eq!(count, MAX_NODES_IN_PROMPT);
        assert!(tel.contains("more nodes omitted"));
    }

    #[test]
    fn citations_reflect_probe_and_nodes() {
        let snap = snapshot_json();
        let citations = build_citations(&snap);
        assert!(citations.iter().any(|c| c.contains("probe target=")));
        assert!(citations.iter().any(|c| c.contains("node arsy [ARSY CORE]")));
    }

    #[test]
    fn parse_confidence_defaults_to_medium() {
        assert_eq!(parse_confidence("All systems nominal."), "Medium");
        assert_eq!(parse_confidence("Confidence: High"), "High");
        assert_eq!(parse_confidence("confidence low"), "Low");
    }

    #[test]
    fn suggested_actions_require_confirmation() {
        let actions = parse_suggested_actions("Draft: Recycle socket connector and run a diagnostics sweep.");
        assert!(!actions.is_empty());
        assert!(actions.iter().all(|a| a.requires_confirmation));
        assert!(actions.iter().any(|a| a.action_id == "CYCLE_SOCKET_CONNECTOR"));
    }
}

// Audit
#[tauri::command]
async fn audit_append(app: tauri::AppHandle, event: AuditEvent) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("audit.jsonl");
    let line = serde_json::to_string(&event).map_err(|e| e.to_string())? + "\n";
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(path).map_err(|e| e.to_string())?;
    f.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    f.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn audit_read(app: tauri::AppHandle, limit: Option<u64>) -> Result<Vec<AuditEvent>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("audit.jsonl");
    if !path.exists() { return Ok(vec![]); }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let cap = limit.unwrap_or(500) as usize;
    let mut events: Vec<AuditEvent> = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() { continue; }
        if let Ok(ev) = serde_json::from_str::<AuditEvent>(line) {
            events.push(ev);
        }
    }
    events.reverse();
    if events.len() > cap { events.truncate(cap); }
    Ok(events)
}

// keep agi_analyze
#[tauri::command]
fn agi_analyze(snapshot: AgiSnapshot, question: String) -> AgiAnalysis {
    let q = question.to_lowercase();
    let nodes = snapshot.nodes.clone().unwrap_or_default();
    let mut citations: Vec<String> = Vec::new();
    if let Some(probe) = snapshot.probe.as_ref() {
        citations.push(format!("Probe target={} status={} latency={}ms", probe.target.clone().unwrap_or_else(|| "unknown".into()), probe.status.clone().unwrap_or_else(|| "unknown".into()), probe.latency_ms.unwrap_or(0.0)));
    }
    let mut degraded: Vec<String> = Vec::new();
    for n in nodes.iter() {
        let status = n.status.clone().unwrap_or_else(|| "UNKNOWN".into());
        let name = n.name.clone().unwrap_or_else(|| n.id.clone().unwrap_or_else(|| "node".into()));
        citations.push(format!("{} status={} latency={}ms uptime={} load={}", name, status, n.latency_ms.unwrap_or(0.0), n.uptime.clone().unwrap_or_else(|| "n/a".into()), n.load.clone().unwrap_or_else(|| "n/a".into())));
        if status != "HEALTHY" { degraded.push(format!("{} ({})", name, status)); }
    }
    let mut suggested_actions: Vec<AgiSuggestedAction> = Vec::new();
    if !degraded.is_empty() {
        suggested_actions.push(AgiSuggestedAction { action_id: "DIAGNOSTIC_HEALTH_CHECK".into(), label: "Draft: Run diagnostics sweep".into(), reason: "Degraded nodes detected; confirm before dispatch.".into(), requires_confirmation: true });
    }
    if q.contains("lockdown") || q.contains("emergency") {
        suggested_actions.push(AgiSuggestedAction { action_id: "EMERGENCY_DEGRADE_SYSTEM".into(), label: "Draft: Fail-closed lockdown mode".into(), reason: "Destructive action. Explicit human confirmation required.".into(), requires_confirmation: true });
    }
    let answer = if degraded.is_empty() { "System snapshot shows no degraded nodes.".into() } else { format!("Degraded: {}", degraded.join("; ")) };
    AgiAnalysis {
        answer,
        confidence: "High".into(),
        citations,
        suggested_actions,
        provider: "tauri-local-heuristic".into(),
        disclaimer: "AI assistive output only.".into(),
        model: None,
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResult {
    pub ok: bool,
    pub timestamp_ms: u128,
    pub host: String,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub process_count: usize,
    pub status: String,
    pub source: String,
}

#[tauri::command]
fn get_system_telemetry() -> SystemMetrics {
    let mut sys = System::new();
    sys.refresh_memory();
    let host = System::host_name().unwrap_or_else(|| "unknown-host".to_string());
    let total = sys.total_memory() / 1024 / 1024;
    let used = sys.used_memory() / 1024 / 1024;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    SystemMetrics {
        timestamp_ms: now,
        host,
        // Not probed by this read-only command; kept for struct compatibility.
        active_containers: 0,
        memory_used_mb: used,
        memory_total_mb: total,
        status: "OPERATIONAL".to_string(),
    }
}

/// Governed read-only diagnostic execution for DIAGNOSTIC_HEALTH_CHECK (desktop/Tauri only).
/// Collects host/memory/process counts via safe OS queries. No writes, no privileged ops.
#[tauri::command]
fn run_diagnostic_health_check() -> DiagnosticResult {
    let mut sys = System::new();
    sys.refresh_memory();
    // refresh_processes is sufficient for a process count; keep scope minimal.
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let host = System::host_name().unwrap_or_else(|| "unknown-host".to_string());
    let total = sys.total_memory() / 1024 / 1024;
    let used = sys.used_memory() / 1024 / 1024;
    let process_count = sys.processes().len();
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    DiagnosticResult {
        ok: true,
        timestamp_ms: now,
        host,
        memory_used_mb: used,
        memory_total_mb: total,
        process_count,
        status: "OPERATIONAL".to_string(),
        source: "tauri-read-only-diagnostic".to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_telemetry,
            run_diagnostic_health_check,
            agi_analyze,
            get_cockpit_telemetry,
            keychain_get,
            keychain_set,
            keychain_delete,
            llm_analyze,
            llm_analyze_stream,
            audit_append,
            audit_read,
            riot_release::riot_release_add_repository,
            riot_release::riot_release_list_repositories,
            riot_release::riot_release_remove_repository,
            riot_release::riot_release_get_preview,
            riot_release::riot_release_save_draft,
            riot_release::riot_release_list_drafts,
            riot_release::riot_release_list_history,
            riot_release::riot_release_create_local_tag,
            riot_release_build::riot_release_list_build_profiles,
            riot_release_build::riot_release_run_build,
            riot_release_build::riot_release_list_build_history,
            riot_release_build::riot_release_list_artifact_candidates,
            riot_release_build::riot_release_import_artifact,
            riot_release_build::riot_release_list_vault
        ])
        .run(tauri::generate_context!())
        .expect("error while running MOONWITNESS COCKPIT application");
}
