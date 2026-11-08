# Technical Specification: MOONWITNESS COCKPIT

## 1. Role & Identity
- **Name:** `@riotworks/cockpit` / MOONWITNESS COCKPIT
- **Product Classification:** Additional Operational Application (Experience 08 / 09)
- **Target Audience:** Internal SREs, DevOps, Network Engineers, Infrastructure Operators.

## 2. Architecture & Modules
- **Desktop Runtime (Rust):**
  - Manages native OS window lifecycle, low-level process monitoring, and IPC commands between Rust backend and React frontend.
- **Operator Frontend (React / TypeScript):**
  - Live Telemetry Console (Node/Service Heartbeat, CPU/RAM, Container health).
  - Operator Action Controls (Restart Service, Flush Cache, Trigger Health Diagnostic, Kill Task).
  - Incident Stream Log (Timestamped operational telemetry).

## 3. Package Contract
- `package.json` with scripts: `dev`, `build`, `type-check`, `test`.
- Cargo manifest `src-tauri/Cargo.toml` for native desktop compilation.

