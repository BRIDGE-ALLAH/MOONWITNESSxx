# ATLAS

**DNS & Observability Control Plane** for MOONWITNESS.

ATLAS manages DNS engines, logging infrastructure, metrics sources, inventory, desired state, reconciliation, and operational visibility. It is a control plane—not a DNS server, recursive resolver, syslog receiver, metrics database, or log analytics engine.

## Architecture boundary

- **ARSY** owns ecosystem identity, authorization, policy, approval, orchestration, and canonical audit.
- **ATLAS** owns DNS/observability configuration management, inventory, engine adapters, operational workflows, and reconciliation.
- **AEGIS** executes infrastructure provisioning and lifecycle operations.
- External engines own data-plane work: PowerDNS Authoritative, Unbound, dnsdist, collectors, VictoriaMetrics, and ClickHouse.

ATLAS can run standalone. When integrated, it must honor ARSY governance and delegate infrastructure execution to AEGIS.

## Runtime

- Rust 2024, minimum Rust 1.94
- Loco.rs 1.3
- Axum handlers managed by Loco
- SQLx MySQL protocol driver for MariaDB operational storage
- Server-served dashboard; no separate frontend runtime

Loco's built-in SeaORM database integration currently targets PostgreSQL and SQLite. ATLAS therefore uses SQLx's MySQL driver directly for MariaDB rather than claiming native Loco/SeaORM MariaDB support. The HTTP/application lifecycle remains Loco-managed.

## Run locally

Install Rust 1.94+ and the Loco CLI:

```sh
cargo install loco --version 1.3.1
export DATABASE_URL='mysql://atlas:password@127.0.0.1:3306/atlas'
cargo loco start
```

The dashboard is served at `http://127.0.0.1:5150/`.

## Run with Docker Compose

From `apps/atlas`, provide dedicated database credentials (use URL-safe characters for the database password because it is embedded in `DATABASE_URL`):

```sh
export ATLAS_DB_PASSWORD='replace-with-a-strong-url-safe-password'
export ATLAS_DB_ROOT_PASSWORD='replace-with-a-strong-root-password'
docker compose up --build
```

The dashboard is bound to `127.0.0.1:5150` by default. Override the host port with `ATLAS_PORT`.

## API

- `GET /api/v1/system/health` — application health and actual MariaDB probe result.
- `GET /api/v1/system/readiness` — readiness; returns 503 if MariaDB is not configured or reachable.
- `GET /api/v1/system/version` — build/package version.
- `GET /api/v1/engines/catalog` — adapter roadmap with explicit implementation status.

Loco's built-in `/_ping`, `/_health`, and `/_readiness` routes remain available.

No engine is reported as connected until a real adapter and readback check exist. The initial catalog deliberately reports adapters as `not_implemented`.

## MariaDB schema

ATLAS uses MariaDB for transactional control-plane metadata only. It does not store DNS query traffic, syslog streams, metrics samples, or raw observability data.

Install SQLx CLI and apply versioned migrations:

```sh
cargo install sqlx-cli --no-default-features --features mysql,rustls
DATABASE_URL='mysql://atlas:password@127.0.0.1:3306/atlas' sqlx migrate run --source migrations
```

The migration baseline creates the engine registry table. Application readiness checks the database with a real `SELECT 1`; it does not imply that every future domain is implemented.

## Development checks

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release
```

## Implementation status

### Implemented in this foundation

- Loco application and runtime CLI.
- ATLAS dashboard shell.
- Versioned health, readiness, version, and engine catalog endpoints.
- MariaDB connectivity probe with bounded connection pool configuration.
- Initial engine registry schema migration.
- Standalone Compose and container build definition.
- Dedicated Rust CI workflow.

### Planned; not yet implemented

- Persistent inventory and engine CRUD.
- PowerDNS, Unbound, and dnsdist control adapters.
- VictoriaMetrics metrics integration.
- Collector management and ClickHouse log analytics integration.
- Desired/actual state reconciliation and durable operational jobs.
- ARSY authorization/approval integration and AEGIS execution integration.
- HA, backup/restore, and production hardening.

Do not treat a planned adapter or an unconfigured integration as operational.
