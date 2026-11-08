# Technical Specification: Shared Contract & Telemetry Schema Alignment

## Scope & Objective

Establish `@riotworks/contract` as the single authoritative source of shared schemas across `@riotworks/cockpit`, `@riotworks/arsy`, and `@riotworks/gate`.
Provide strongly-typed Zod schemas for:

- Telemetry probes and cluster node states
- Operator dispatch actions & confirmation contracts
- Audit events and replay payloads
- Universe experience registries

## Stable IDs

- `REQ-CONTRACT-001`: Core Telemetry Schema (`TelemetryProbeSchema`, `ClusterNodeSchema`, `CockpitSnapshotSchema`)
- `REQ-CONTRACT-002`: Dispatch Action Schema (`OperatorActionSchema`, `ActionDispatchResultSchema`)
- `REQ-CONTRACT-003`: Audit Event Schema (`AuditEventSchema`)
- `REQ-CONTRACT-004`: Universe Registry Schema (`UniverseExperienceSchema`)

## Acceptance Criteria

- Full TypeScript types derived via `z.infer`.
- Comprehensive test coverage with valid and invalid parsing tests.
- Package export configuration allowing direct TypeScript or bundled consumption.
