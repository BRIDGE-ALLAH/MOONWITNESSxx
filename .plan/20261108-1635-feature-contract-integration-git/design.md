# Architecture & Design: Contract Consumer in Cockpit

## Relationship

```mermaid
graph LR
    Contract["@riotworks/contract"] -->|Exports Telemetry & Action Types| CockpitLib["apps/cockpit/src/lib/*"]
    CockpitLib --> CockpitUI["apps/cockpit/src/components/* & page.tsx"]
    RustBackend["apps/cockpit/src-tauri"] -->|Serializes JSON| CockpitLib
```

## Decisions

- Add `"@riotworks/contract": "workspace:*"` to `apps/cockpit/package.json`.
- Replace local interface duplicates in `apps/cockpit/src/lib/telemetry.ts` and `apps/cockpit/src/lib/actions.ts` with imports from `@riotworks/contract`.
- Ensure tests run cleanly with zero syntax warnings.
