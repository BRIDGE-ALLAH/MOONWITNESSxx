# ADR 0001 — ATLAS PostgreSQL Storage and Observability Boundary

- **Status:** Accepted
- **Date:** 2026-11-08
- **Scope:** MOONWITNESS / ATLAS / FreeRADIUS
- **Decision owners:** MOONWITNESS architecture

## Context

The initial ATLAS proposal used MariaDB for operational metadata and ClickHouse for log analytics. That conflicts with the selected MOONWITNESS platform direction: PostgreSQL is the primary transactional database, Redis is used for cache and transient coordination, VictoriaMetrics stores metrics, and VictoriaLogs stores searchable logs.

ATLAS is a control plane. It should own infrastructure inventory, desired state, engine configuration, operator workflows, and reconciliation metadata. It must not become a replacement DNS server, RADIUS runtime, metrics database, or log store.

FreeRADIUS requires a SQL backend for subscriber credentials, NAS client inventory, accounting, and group policy. FreeRADIUS 3.2.10 provides an upstream PostgreSQL schema, SQL query set, and PostgreSQL SQL driver.

## Decision

1. PostgreSQL is the only relational database engine in the ATLAS local stack.
2. Use separate PostgreSQL databases and roles:
   - atlas database / atlas role for ATLAS control-plane metadata.
   - radius database / radius role for FreeRADIUS SQL data.
   - The application roles are database owners only for their own database; neither is a cluster superuser.
3. FreeRADIUS uses its upstream 3.2.10 PostgreSQL schema and query configuration through rlm_sql_postgresql.
4. Redis remains the transient coordination/cache service.
5. VictoriaMetrics remains the metrics engine; VictoriaLogs remains the log storage and search engine.
6. Do not add MariaDB, MySQL, ClickHouse, or DuckDB to the ATLAS stack without a new reviewed ADR.
7. ARSY remains the authority for identity, authorization, policy, approvals, orchestration, and canonical audit. ATLAS manages infrastructure configuration; AEGIS executes narrowly scoped infrastructure actions.

## Runtime and data boundaries

- ATLAS SQL tables contain engine inventory and control-plane metadata, not DNS query traffic, raw metrics, or log streams.
- FreeRADIUS owns its RADIUS SQL tables in the separate radius database.
- Subscriber credentials are stored as supported password attributes (bcrypt Crypt-Password for PAP, NT hash only where MSCHAP requires it); plaintext is never persisted.
- FreeRADIUS loads SQL-backed NAS clients at process startup. NAS create/update/delete operations therefore report pending_radius_restart; they do not claim immediate runtime activation.
- Subscriber SQL records are read by the SQL authorization path during authentication; their API response reports persistence in RADIUS SQL, not an unconditional authentication success.
- No Docker socket is mounted into ATLAS to restart FreeRADIUS. Runtime restarts remain an explicitly orchestrated operational action until a narrowly scoped execution contract is approved.

## Alternatives considered

| Option | Decision | Reason |
|---|---|---|
| MariaDB for ATLAS and FreeRADIUS | Rejected | Introduces a second relational engine contrary to the selected PostgreSQL platform direction |
| PostgreSQL for ATLAS and FreeRADIUS | Selected | One supported relational platform, separate databases/roles, upstream FreeRADIUS 3.2.10 SQL support |
| ClickHouse for log analytics | Rejected | VictoriaLogs is the selected log engine |
| DuckDB for operational persistence | Rejected | Not an application control-plane database |
| Redis as the system of record | Rejected | Redis is transient coordination/cache, not authoritative relational persistence |

## Operational consequences

- Back up and restore the atlas and radius databases independently, while retaining one PostgreSQL service lifecycle.
- PostgreSQL initialization scripts run only for a fresh data volume. Existing MariaDB data volumes are not deleted or converted automatically; migration requires a deliberate export/import and verification procedure.
- SQLx migrations govern ATLAS metadata. FreeRADIUS schema upgrades must follow the upstream PostgreSQL schema and be applied as explicit database migrations.
- CI must verify both database-role isolation and a real API-to-FreeRADIUS authentication path before the ATLAS implementation is considered merge-ready.

## Implementation status

The ATLAS implementation is being aligned with this ADR in PR #156. The decision is accepted; implementation remains subject to PostgreSQL integration tests, FreeRADIUS driver verification, Compose smoke tests, and repository CI.
