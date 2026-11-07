# 26 — Phase 3 Deterministic Registry Foundation

**Status:** Initial implementation slice; acceptance gate open  
**Date:** 2026-11-07

## Objective

Compose trusted addon/module declarations and normalized model metadata into one deterministic registry snapshot. The active snapshot is immutable for the lifetime of a Runtime Mode process. System Mode owns discovery, composition, validation, fingerprinting and persistence.

## Implemented in this slice

- Add workspace manifests and public exports for `@riotworks/orm`, `@riotworks/orm-db-adaptor` and `@riotworks/orm-db`.
- Add `DeterministicRegistryComposer` under `@riotworks/orm/registry`.
- Validate duplicate addon/module/model/extension identities.
- Validate addon ownership of modules and required/optional addon/module dependencies.
- Detect dependency cycles and return a deterministic topological order.
- Check addon conflicts and declared addon version requirements.
- Compose model fields and explicit extension/mixin contributions in deterministic order.
- Reject duplicate field contributions rather than silently allowing load-order overrides.
- Validate relation target existence against the discovered model set.
- Produce a SHA-256 fingerprint from normalized declarations, versions, order and composed model metadata; timestamp is deliberately excluded from the fingerprint.
- Freeze the returned snapshot and its top-level model/field structures.

## Deliberate boundaries / not yet implemented

- This composer accepts trusted in-process model constructors only. It is not a plugin sandbox or arbitrary package loader.
- Signature verification, package provenance, compatibility against the actual running ARSY/ORM version, permissions and capability grants remain System Mode responsibilities.
- Model base classes, field factories and full declaration normalization belong to Phase 2. This composer consumes the normalized static metadata contract and does not instantiate business model classes.
- Full classical inheritance, explicit override markers, method contribution chains, BaseEntity injection, schema persistence to SQLite and activation locks remain open.
- Extension collisions currently fail closed. A later override contract must be explicit and validated; priority is not permission to overwrite a field.
- Relation validation currently validates direct target model existence. Inverse/cardinality validation remains open.
- The snapshot is operational state, not a second source of truth; code declarations remain canonical.

## Required verification

1. Add unit tests for stable fingerprints independent of input order and timestamp.
2. Add tests for missing/optional dependencies, dependency cycles, conflicts and version mismatch.
3. Add tests for duplicate model/field, unknown module, invalid relation target, extension ordering and missing mixin.
4. Verify deep immutability, not only top-level `Object.freeze`.
5. Run TypeScript check, lint, workspace install and package consumer fixture.
6. Add a System Mode integration test proving registry persistence and atomic activation only after verification.

Phase 3 must not be marked complete until these tests and the System Mode integration gates pass.
