# ATLAS

**DNS, RADIUS & Observability Control Plane** for MOONWITNESS.

ATLAS manages DNS, RADIUS, and observability engines, network inventory, desired state, reconciliation, and operational visibility. It is a control plane—not a DNS server, RADIUS protocol server, syslog receiver, metrics database, or log analytics engine.

## Architecture boundary

- **ARSY** owns ecosystem identity, authorization, policy, approval, orchestration, and canonical audit.
- **ATLAS** owns DNS/RADIUS/observability configuration management, inventory, engine adapters, operational workflows, and reconciliation.
- **AEGIS** executes infrastructure provisioning and lifecycle operations.
- **External engines** own data-plane work: PowerDNS Authoritative, Unbound, dnsdist, FreeRADIUS, VictoriaMetrics, VictoriaLogs, and log collectors.

ATLAS can run standalone. When integrated, it must honor ARSY governance and delegate infrastructure execution to AEGIS. ATLAS does not become a competing identity or governance plane.

## Runtime and dependencies

- Rust 2024, minimum Rust 1.94
- Loco.rs 1.3 with Axum handlers
- MariaDB 11.4 for transactional control-plane metadata, accessed through SQLx MySQL protocol driver
- Redis 7.4 is a **required** ATLAS dependency for cache and ephemeral coordination
- Server-served dashboard; no separate frontend runtime

Loco's built-in SeaORM database integration currently targets PostgreSQL and SQLite. ATLAS therefore uses SQLx's MySQL driver directly for MariaDB rather than claiming native Loco/SeaORM MariaDB support.

## External engine stack

| Domain | Engine | Responsibility |
|---|---|---|
| Authoritative DNS | PowerDNS Authoritative | DNS zone and record serving |
| Recursive DNS | Unbound | Recursive resolution |
| DNS traffic | dnsdist | DNS proxying, routing, and protection |
| RADIUS AAA | FreeRADIUS 3.2 | Authentication, authorization, accounting, EAP, and proxying |
| Metrics | VictoriaMetrics | Time-series metrics storage |
| Logs | VictoriaLogs | Log ingestion, storage, and search |

No ClickHouse or DuckDB component is part of ATLAS. VictoriaMetrics stores metrics; VictoriaLogs stores and searches logs. ATLAS only configures and observes these systems through adapters.

### RADIUS boundary

FreeRADIUS is the RADIUS data-plane engine. ATLAS will own NAS inventory, subscriber profiles, authentication policies, VLAN/rate-limit policies, realms, session visibility, accounting views, and engine lifecycle operations.

FreeRADIUS is launched by the development Compose stack using the upstream freeradius/freeradius-server:3.2.10 image. The upstream image's default configuration has no production NAS clients or subscriber database. It must be configured with explicit clients, secure shared secrets, certificates, and an authentication/accounting backend before being exposed to network devices. The Compose port bindings default to loopback for safety.

Compose initializes a separate MariaDB database named radius and a dedicated radius SQL user. This database is intentionally separate from ATLAS control-plane tables. The upstream FreeRADIUS image is not yet wired to this SQL backend; the ATLAS/FreeRADIUS adapter and accounting schema are still follow-up work. Redis is required by ATLAS but is not a mandatory FreeRADIUS dependency.

## Run with Docker Compose

From apps/atlas, copy .env.example to .env, replace all placeholder passwords with long URL-safe values, then run:

    cp .env.example .env
    docker compose up --build -d

The dashboard is bound to 127.0.0.1:5150 by default. MariaDB and Redis are internal-only. VictoriaMetrics and VictoriaLogs are exposed on loopback at ports 8428 and 9428. FreeRADIUS UDP ports 1812 and 1813 are also loopback-bound by default.

Do not change RADIUS_BIND_ADDRESS to a public or LAN interface until you have installed a production clients.conf, replaced test certificates, configured real NAS clients with unique strong secrets, configured firewall rules, and set up an authentication/accounting backend.

## Run locally

Install Rust 1.94+ and the Loco CLI:

    cargo install loco --version 1.3.1
    export DATABASE_URL='mysql://atlas:password@127.0.0.1:3306/atlas'
    export REDIS_URL='redis://:password@127.0.0.1:6379/0'
    cargo loco start

The dashboard is served at http://127.0.0.1:5150/.

## API

- GET /api/v1/system/health — liveness plus actual MariaDB and Redis probe results.
- GET /api/v1/system/readiness — returns 503 unless both MariaDB and Redis are reachable.
- GET /api/v1/system/version — build/package version.
- GET /api/v1/engines/catalog — engine integration catalog and explicit adapter status.

Loco's built-in /_ping, /_health, and /_readiness routes remain available.

An engine being present in Compose or in the catalog does not mean ATLAS has a working adapter or has verified its operational state.

## MariaDB schema

ATLAS uses MariaDB for transactional control-plane metadata only. It does not store DNS query traffic, syslog streams, metrics samples, or raw observability data.

Install SQLx CLI and apply versioned migrations:

    cargo install sqlx-cli --no-default-features --features mysql,rustls
    DATABASE_URL='mysql://atlas:password@127.0.0.1:3306/atlas' sqlx migrate run --source migrations

The initial migration creates the engine registry table. Application readiness checks MariaDB with a real SELECT 1 and Redis with PING; it does not imply that every future domain is implemented.

## Development checks

    cargo fmt --check
    cargo clippy --all-targets -- -D warnings
    cargo test
    cargo build --release
    docker compose config

## Implementation status

### Implemented in this foundation

- Loco application and runtime CLI.
- ATLAS dashboard shell with DNS, RADIUS, database, Redis, and observability status surfaces.
- Versioned health, readiness, version, and engine catalog endpoints.
- MariaDB connectivity probe with bounded connection pool configuration.
- Required Redis connectivity probe; readiness fails when Redis is unavailable.
- Compose services for MariaDB, Redis, VictoriaMetrics, VictoriaLogs, and FreeRADIUS.
- Initial engine registry schema migration.
- Dedicated Rust CI workflow.

### Planned; not yet implemented

- Persistent inventory and engine CRUD.
- PowerDNS, Unbound, and dnsdist control adapters.
- FreeRADIUS configuration/API adapter and secure NAS/subscriber provisioning workflows.
- VictoriaMetrics and VictoriaLogs query/configuration adapters.
- Dedicated RADIUS subscriber/accounting database provisioning and schema migrations.
- Collector management, desired/actual state reconciliation, and durable operational jobs.
- ARSY authorization/approval integration and AEGIS execution integration.
- HA, backup/restore, secrets management, and production hardening.

Do not treat a planned adapter or an unconfigured integration as operational.
