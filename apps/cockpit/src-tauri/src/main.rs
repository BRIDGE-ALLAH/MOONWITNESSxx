// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemMetrics {
    pub timestamp_ms: u128,
    pub host: String,
    pub active_containers: u32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub status: String,
}

#[tauri::command]
fn get_system_telemetry() -> SystemMetrics {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    SystemMetrics {
        timestamp_ms: now,
        host: "local-operator-workstation".to_string(),
        active_containers: 4,
        memory_used_mb: 1420,
        memory_total_mb: 16384,
        status: "OPERATIONAL".to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_telemetry])
        .run(tauri::generate_context!())
        .expect("error while running MOONWITNESS COCKPIT application");
}
