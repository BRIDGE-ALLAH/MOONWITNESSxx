# Technical Specification: Consume Shared Contracts in Cockpit & Git Commits

## Scope & Objective

1. Refactor `apps/cockpit` to consume types and schemas directly from `@riotworks/contract`, eliminating duplicated type definitions.
2. Verify all contract tests, type checks, and builds pass.
3. Commit working changes atomically following Conventional Commits convention.

## Stable IDs

- `REQ-INT-001`: `@riotworks/contract` dependency added to `apps/cockpit/package.json`.
- `REQ-INT-002`: Cockpit telemetry and actions modules import schemas/types from `@riotworks/contract`.
- `REQ-INT-003`: Unit and contract test validation across cockpit and contract.
- `REQ-INT-004`: Atomic Conventional Commits for cockpit, gate, contract, and documentation plans.
