# Phase 11 — Addon and Module Foundation

## Goal
Create a secure, deterministic installation planner for addon packages and business modules. Presence in a package catalog is not permission to execute code.

## Implemented slice
- Capability catalog with risk tiers: low, medium, high, critical.
- Allow-list, deny-list, risk ceiling, and per-capability approval policy.
- Unknown capabilities denied by default.
- Package trust evidence bound to publisher, signature verification, and exact artifact digest.
- Manifest checks for safe package-relative entrypoints, compatibility, module ownership, and exact module inventory.
- Deterministic module dependency ordering with version checks and cycle/missing dependency rejection.
- Install/upgrade/enable plan generation with approval list and reproducible SHA-256 plan ID.
- Invalid trust or manifest candidates are blocked before any package import can occur.

## New ideas adopted
1. Capability budget: each addon gets the minimum explicit capability set; high-risk grants require operator approval.
2. Quarantine lane: invalid signature, publisher mismatch, digest mismatch, or unsafe path blocks a candidate; no partial installation.
3. Install preview: pure plan can be rendered in Headquarter with dependency order, requested permissions, upgrade impact, and blocked reasons.
4. Reproducible install: plan digest binds ordered operations, artifact digest, module order, and approvals.
5. Blast-radius labels: capability risk levels can later drive sandbox choice, review requirements, and audit severity.

## Remaining gates
- Cryptographic verification and artifact retrieval must be supplied by a trusted package verifier; this package consumes evidence and does not claim to implement signatures.
- Persist plans, approvals, installed states, and quarantine records in SQLite System Store.
- Share semver implementation with registry composer.
- Integrate with System Mode and registry composer.
- Third-party executable addons remain isolated/RPC by default.
- Typecheck, lint, tests, adversarial security tests, and CI.
