# 13 — Domain Model, BaseEntity & AuditTrail

**Status:** Approved conceptual model | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Design principles

Separate universal persistence metadata from business attributes. Keep one BaseEntity composition in the ORM registry. Add lifecycle concerns through opt-in mixins. Keep AuditTrail centralized. Preserve provenance and financial history. Never store raw credentials in ordinary domain tables or frontend state.

## 2. Minimal BaseEntity

Every persisted model receives exactly these fields through ORM composition:

| Logical field | Domain type                                 | Meaning                                     |
| ------------- | ------------------------------------------- | ------------------------------------------- |
| id            | Opaque string ID (UUID on v1 SQL providers) | Stable provider-independent entity identity |
| createdAt     | UTC datetime                                | Immutable creation instant                  |
| updatedAt     | UTC datetime                                | Last successful mutation instant            |

Addon authors never redeclare them. Duplicate names or incompatible definitions cause a model-registry error.

Provider mapping: libSQL uses TEXT ID and normalized UTC ISO-8601 timestamp text; PostgreSQL uses UUID and TIMESTAMPTZ. For v1 SQL providers, ARSY generates UUID IDs; the logical entity contract remains an opaque string. Adapters normalize physical values to one domain contract. A future provider-native ID format requires an explicit ID-factory/mapping policy and export/import tests. Workspace timezone is for display only.

### PocketBase compatibility (not a v1 provider)

PocketBase BaseModel already has system fields id, created, updated. This is not inherently a logical conflict. A future adapter maps logical id → native id, createdAt → native created, updatedAt → native updated. PocketBase's native ID format may not match the current SQL UUID policy, so the adapter must define a compatible ID-generation/normalization strategy; do not assume UUID values are accepted unchanged. Never create duplicate physical fields. This is mapping, not a reason to rename BaseEntity.

## 3. Non-universal concerns

Do not automatically add these fields to every model:

| Concern               | Fields/behavior                         | Apply when                                      |
| --------------------- | --------------------------------------- | ----------------------------------------------- |
| Ownership attribution | createdBy, updatedBy                    | Record-level actor attribution is useful        |
| Archiveable           | archivedAt, archivedBy; archive/restore | Recoverable archival is required                |
| Versioned             | version/concurrency token               | Optimistic concurrency is needed                |
| Toggleable            | active or enabled                       | Independent enable/disable has business meaning |
| SoftDeletable         | deletedAt and retention/restore policy  | Domain explicitly requires it                   |

Business status, enablement, archive, and deletion are different concepts. Do not combine active=false and archivedAt as interchangeable flags or inject universal active.

## 4. Actor attribution

createdBy and updatedBy are optional trusted actor references, not universal fields. AuditTrail is the authoritative generic change history. System jobs and agents use explicit system/agent principals, never fabricated human actors.

## 5. AuditTrail

One shared service/model in orm-addon-base records audit ID, model, record ID, action, actor ID/type, UTC occurredAt, source, request/trace ID, changed fields, safe diff, and reason/metadata where appropriate.

- Append through normal application flows; ordinary code cannot update/delete history.
- Redact secrets, credentials, protected prompt content, and sensitive personal data.
- Audit reads require authorization.
- Domain addons do not create duplicate generic audit tables/hooks.
- SQL mutation and required audit insert share a transaction where atomic audit is required.
- External effects use an outbox and idempotent dispatch.
- Do not claim tamper-proof storage without verified integrity mechanism.

## 6. Base addon composition

packages/orm-addon-base loads before business addons. It provides minimal BaseEntity, optional ownership/archive/version/toggle/soft-delete mixins, actor context, AuditTrail, common validation, and lifecycle services. Registry injects BaseEntity exactly once; mixins are explicit and deterministic.

## 7. Core domain entities

Workspace; MarketSource; EvidenceItem; Opportunity; Product/ProductVersion; ProductionJob; Asset/ProvenanceRecord; Inspection; Channel/ChannelAccount/Listing; Workflow/WorkflowRun; FinancialEvent/Payout; Experiment; AuditEvent. Each owns only domain attributes beyond BaseEntity and selected mixins.

## 8. Field, money, time, privacy

Use typed metadata for common scalar, JSON, selection, and relation fields. Query expressions are validated against metadata and adapter capabilities. Money uses exact decimal or integer minor units plus currency; never binary float as authority. Store UTC and display workspace timezone. Preserve source currency and FX rate/source/time separately. Collect only required data and define export, deletion, retention.

## 8. v1.3 superseding BaseEntity decision

This section supersedes earlier three-field BaseEntity wording. The universal metadata contract is five fields: id, createdAt, createdById, updatedAt and updatedById. Actor references are server-controlled and nullable only for documented bootstrap/system/import provenance. Archive, soft-delete, active, version, workspace and company scope remain explicit mixins. The full base platform addon catalog and ownership matrix are defined in docs/22.
