# Architecture & Design: COCKPIT Desktop Runtime

## 1. System Topology

```mermaid
flowchart TD
    subgraph Host_OS ["Operator Workstation (Desktop)"]
        subgraph Rust_Backend ["Tauri Desktop Host (Rust)"]
            NativeWindow["Native Window & Tray"]
            IPC["IPC Command Router"]
            SysMonitor["System / Network Telemetry"]
        end

        subgraph Operator_UI ["Operator UI (React / Next.js)"]
            TelemetryConsole["Live Telemetry Console"]
            NodeMatrix["Service Health Grid"]
            ActionTriggers["Operator Action Triggers"]
            IncidentStream["Live Event Stream"]
        end

        NativeWindow --> Operator_UI
        IPC <--> Operator_UI
        SysMonitor --> IPC
    end

    subgraph Infrastructure ["Internal Infra / Swarm"]
        ARSY["ARSY Engine (:4000)"]
        ORACLE["ORACLE Engine"]
        Postgres["PostgreSQL / RADIUS"]
    end

    Operator_UI -.->|Direct Status Check| ARSY
    Operator_UI -.->|Direct Status Check| ORACLE
```

## 2. Port Allocation

- `apps/headquarter`: `3000`
- `apps/gate`: `3001`
- `apps/cockpit`: `3002` (Web Preview) & Desktop Window
- `apps/arsy`: `4000`
