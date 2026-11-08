# Technical Specification: Apps Gate & Universe Navigation

## Scope & Objective

This specification formalizes `apps/gate` as the authoritative public entry portal and universe navigation system for MOONWITNESS, linking operational services (Gate, Headquarter, Cockpit) and registered ecosystem experiences with real-time status indicators and domain boundaries.

## Stable IDs

- `REQ-GATE-001`: Universe Directory & Experience Catalog
- `REQ-GATE-002`: Dynamic Live Service Health Probes
- `REQ-GATE-003`: Accessible & Responsive Navigation Controls
- `REQ-GATE-004`: Monorepo Contract Alignment & Verification

## Requirements

- `REQ-GATE-001`: Gate must present all 9 ecosystem experiences with exact boundary definitions, classifications, and valid target links (including operational links for Cockpit at port 3002, Gate at 3001, and Headquarter at 3000).
- `REQ-GATE-002`: Provide health status checks or indicators reflecting operational realities rather than static mocks.
- `REQ-GATE-003`: Complete accessibility attributes (ARIA landmarks, focus rings, keyboard navigation, contrast conformity).
- `REQ-GATE-004`: 100% passing tests without bypassing typecheck or build.
