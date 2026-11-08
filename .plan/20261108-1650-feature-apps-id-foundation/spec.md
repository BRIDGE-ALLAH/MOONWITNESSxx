# Technical Specification: Apps ID — Shared Identity & Auth Authority (Experience 04)

## Scope & Objective

Establish `apps/id` as Experience 04 (**MOONWITNESS ID**) within the monorepo.
Provide centralized operator and subscriber identity verification, session tokens, and security policies matching the verified contracts in `apps/headquarter` and `apps/gate`.

## Stable IDs

- `REQ-ID-001`: Next.js 15 App Scaffold at `apps/id` with port `3003` configuration.
- `REQ-ID-002`: Authoritative Session & Authentication API (`/api/auth/token`, `/api/auth/verify`).
- `REQ-ID-003`: Identity UI Dashboard & Session Inspector.
- `REQ-ID-004`: Universe Registry Linkage (`apps/gate` updated to operational status for ID at `:3003`).
- `REQ-ID-005`: Automated Contract and E2E Tests.
