# Architecture & Decisions: Shared Contracts

## Module Boundary

`@riotworks/contract` serves as the cross-cutting contract boundary in the monorepo:

```mermaid
graph TD
    Contract["@riotworks/contract (Zod Schemas)"]
    Cockpit["apps/cockpit (NOC & Desktop)"] -->|Consumes Schemas & Types| Contract
    ARSY["apps/arsy (Fastify Orchestrator)"] -->|Validates Inputs & Telemetry| Contract
    Gate["apps/gate (Public Gateway)"] -->|Validates Universe Catalog| Contract
```

## Decisions

- Export both raw Zod schemas and TypeScript types (`z.infer<typeof ...>`).
- Implement contract tests in `@riotworks/contract/tests/*.test.mjs` verifying schema invariants.
- Ensure package can be imported via `"main"` or `"exports"` in package.json.
