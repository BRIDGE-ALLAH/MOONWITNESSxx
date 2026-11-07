# 22 — Base Platform & Odoo-Inspired ORM Capability Blueprint

**Status:** Architecture contract | **Version:** 1.0 | **Updated:** 2026-11-07

## 1. The critical distinction

RIOTWORKS needs an Odoo-inspired modular business platform, not a three-field persistence wrapper. Keep three layers separate:

1. **BaseEntity:** universal metadata automatically composed into every persisted model.
2. **Base platform addons:** foundational models and services: users, access groups, workspaces, companies, messages, activities, attachments, sequences, settings, audit, integrations and more.
3. **ORM engine:** model registry, field engine, inheritance, domains, recordsets, access integration, lifecycle, cache, unit-of-work and adapter-independent persistence.

Odoo is a reference for metadata-driven model registration, module dependencies, extension, access control and reusable abstract mixins. RIOTWORKS is a TypeScript-native implementation, not an Odoo clone or API-compatible fork. Odoo documents regular, transient and abstract models, recordsets and multiple inheritance/extension patterns. Reference: https://www.odoo.com/documentation/master/developer/reference/backend/orm.html

## 2. Universal BaseEntity

Every persisted model receives exactly these ORM-managed fields:

| Logical field | Type | Rule |
|---|---|---|
| id | Opaque string | Stable identity; UUID strategy on v1 SQL providers |
| createdAt | UTC instant | Immutable, server-controlled |
| createdById | Nullable principal ID | Set from trusted execution context |
| updatedAt | UTC instant | Updated on successful persisted mutation |
| updatedById | Nullable principal ID | Set from trusted execution context |

createdById and updatedById follow the access-log pattern found in mature ORMs. They may be null for bootstrap, system, or imported records only when provenance is explicit. Actor IDs supplied by an untrusted client are never trusted. Actor references target a principal abstraction that can represent a human user, service account, or system process.

The ORM injects these fields once into composed model metadata. Addon authors never declare them. Provider adapters map their physical representation.

Do not universally add active/enabled, archivedAt/deletedAt, version/revision, workspaceId/companyId, displayName, arbitrary metadata JSON, or audit payload. These change lifecycle, query, security or retention semantics and belong to explicit mixins or owning addons.

## 3. Base addon package architecture

Keep one source package, packages/orm-addon-base, for release and dependency management, but define independent addon manifests internally:

    packages/orm-addon-base/src/addons/
      core/
      identity/
      security/
      workspace/
      company/
      audit/
      events/
      communication/
      activity/
      attachment/
      sequence/
      settings/
      localization/
      transient/
      import-export/
      integration/
      taxonomy/

Each addon has its own manifest, models, services, policies, hooks, tests and public exports. Addons can be installed by profile. The default RIOTWORKS profile may include mandatory core capabilities and selected optional modules. Disabling an addon never drops stored data.

## 4. Foundation addon catalog and ownership

| Addon ID | Owns models/capabilities | Explicitly does not own |
|---|---|---|
| base.core | BaseEntity composition, principal abstraction, system references, common validation/value objects | Login, roles, business records |
| base.identity | User, UserIdentity, AuthSession, ServiceAccount, invitations, account lifecycle, credential metadata | Authorization policy evaluation, raw secrets |
| base.security | Group, Role, Permission, ModelAccess, RecordRule, FieldPolicy, RoleBinding, policy evaluator | Authentication/session issuance |
| base.workspace | Workspace, WorkspaceMembership, WorkspaceInvitation, WorkspacePreference, tenant context | Legal entity/accounting company |
| base.company (optional) | Company, CompanyMembership, CompanyRole, hierarchy and consistency checks | Workspace tenancy |
| base.audit | AuditEvent, safe diff, actor/source/request attribution, retention/export | User-facing chatter |
| base.events | Domain event envelope, Outbox, Inbox, delivery receipt, idempotency | Audit history or job scheduling |
| base.communication (optional) | Message, Thread, Follower/Subscription, Notification, DeliveryAttempt | Generic audit or activity assignment |
| base.activity (optional) | ActivityType, Activity, assignment, due date, completion, reminders | Worker execution queue |
| base.attachment | Attachment metadata, storage contract, checksum, MIME/size validation, access and retention | Binary object storage implementation |
| base.sequence | SequenceDefinition, counter/allocation service, formatted references | Primary key identity |
| base.settings | Typed config parameters, scoped preferences, secret references | Secret vault implementation |
| base.localization | Locale, timezone, currency/country/unit references and formatting policy | Authoritative FX or financial ledger |
| base.transient | Temporary wizard/session models, TTL, cleanup | Durable business records |
| base.import-export | ImportJob, ExportJob, mapping, validation report, checkpoint | Ad hoc direct DB copy |
| base.integration (optional) | ExternalConnection metadata, WebhookEndpoint, WebhookDelivery, signature/idempotency services | Provider credentials or marketplace business rules |
| base.taxonomy (optional) | Shared Tag/Category only when truly cross-domain | Domain-specific labels/classifications |

Dependency direction:
- core has no dependency on other base addons;
- identity depends on core;
- security depends on core and identity;
- workspace depends on core, identity and security;
- company depends on core, identity and security; it may integrate with workspace but never replaces it;
- audit depends on core and identity;
- events depends on core;
- communication depends on core and identity;
- activity depends on core and identity;
- attachment depends on core and security;
- sequence, settings, localization and transient depend on core;
- import-export depends on core, security and audit;
- integration depends on core, security and events;
- taxonomy depends on core.

Do not force optional addons into every deployment. Project and Intelligent addons depend only on the base capabilities they actually use.

## 5. Reusable mixin catalog

Mixins are metadata/behavior bundles with dependencies, query semantics, security effects, lifecycle hooks and tests. They are not global field bags.

| Mixin | Fields/behavior | Use |
|---|---|---|
| OwnershipAttribution | ownerPrincipalId/assigneePrincipalId | Business ownership, separate from creator |
| Archiveable | archivedAt, archivedById, archive/restore | Recoverable archival |
| SoftDeletable | deletedAt, deletedById, retention/restore | Logical deletion |
| Toggleable | active/enabled | Independent operational enablement |
| Versioned | revision token / optimistic concurrency | Conflict-sensitive edits |
| WorkspaceScoped | workspaceId + mandatory record scope | Tenant-owned data |
| CompanyScoped | companyId + allowed-company checks | Multi-company business data |
| ParentTree | parentId, hierarchy operators, cycle protection | Hierarchical models |
| ChatterEnabled | thread/follower/message integration | Collaboration history |
| ActivityEnabled | activity relation and due-date services | Human follow-up |
| AttachmentEnabled | attachment relation and access policy | File-bearing records |
| SequenceAssigned | human-readable reference | Business document number |
| Translatable | localized values and fallback | Translated content |
| CustomMetadata | typed extension attributes with schema validation | Truly dynamic attributes |

A mixin must add behavior, validation, policy and tests—not merely columns. WorkspaceScoped and CompanyScoped are independent. Archive and soft-delete are not synonyms. Toggle and business status are not synonyms. Creator and owner are not synonyms. Registry composition rejects duplicate or incompatible mixins.

## 6. Odoo-inspired ORM capability matrix

| Capability | RIOTWORKS contract |
|---|---|
| Model kinds | PersistentModel, AbstractModel, TransientModel with TTL/cleanup |
| Registry | Deterministic registry composed once per runtime |
| Addon graph | Versioned manifests, dependency ordering, cycle/conflict rejection |
| Classical inheritance | Extend an existing model with compatible additive fields/method contributions |
| New model from base | Create distinct model based on an abstract/model contract |
| Composition/delegation | Explicit relation-backed composition; avoid implicit field shadowing |
| Fields | Typed scalar, selection, decimal, date/time, JSON, relation, computed, related, translated |
| Field behavior | required, nullable, readonly, default, copy policy, index, validation, visibility hints |
| Computed fields | Dependency graph, stored/non-stored, deterministic recompute; inverse/search only when implemented |
| Relations | belongs-to, one-to-many, many-to-many, inverse, FK/delete policy and validation |
| Constraints | Typed application constraints plus provider-supported DB constraints |
| Domains | Safe AST operators, nested AND/OR/NOT, validated fields, no string evaluation |
| Recordsets | Typed collection facade with batch reads/writes and predictable empty/single/multiple behavior |
| Prefetch/cache | Request-scoped identity map and batch prefetch; explicit invalidation after writes |
| Environment | Actor, workspace/company, locale/timezone, trace ID, transaction, permissions |
| Access control | Model ACL, record rules, field policy, service authorization; deny by default |
| Lifecycle | before/after create/update/delete/archive hooks with deterministic ordering |
| Defaults/onchange | Server defaults; onchange is advisory form behavior, never security enforcement |
| Search/read | search, searchRead, count, grouping/aggregation where supported, pagination and sorting |
| Sequences | Concurrency-safe human reference allocation separate from id |
| Multi-company | Explicit company scope and relational consistency checks |
| Transient data | TTL, cleanup and no durable business-history guarantee |
| API exposure | ORM models are not automatically public APIs; explicit service/contract boundary |

Implement in staged slices. The capability matrix is the target, not a demand for a risky big-bang implementation.

## 7. Audit, events, chatter, activities, jobs and notifications

These are different bounded concerns:
- AuditEvent: security/compliance history of changes.
- DomainEvent: business fact emitted for subscribers.
- Outbox/Inbox: reliable, idempotent event delivery/consumption.
- Message/Thread/Followers: human collaboration history (chatter).
- Activity: human task/follow-up with due date and assignee.
- Background Job: executable work with lease, retries, timeout and worker ownership.
- Notification: delivery intent/channel/result to a recipient.

No catch-all table may claim ownership of all these semantics. RIOT ENGINE owns business automation orchestration; base.events supplies reliable event transport contracts.

## 8. Database and schema API decision

PocketBase is not required for v1. RIOTWORKS owns one ARSY API, one ORM registry and one SQL persistence contract.

Schema synchronization is programmatic and API-triggered, not a handwritten migration-file workflow:
1. Trusted addon model declarations compose into a desired schema snapshot.
2. POST /internal/admin/schema/plan returns a deterministic plan.
3. POST /internal/admin/schema/reconcile authorizes and executes permitted changes.
4. POST /internal/admin/schema/verify checks actual state.
5. GET /internal/admin/schema/status reports fingerprints, drift and last receipt.

This is an ARSY control-plane API, not a claim that SQLite/libSQL/PostgreSQL expose one common REST schema endpoint. The selected adapter executes provider-native schema operations over its connection. There are no handwritten migration scripts for ordinary additive model changes. Semantic data transformations use typed handlers; destructive changes require explicit approval, backup and recovery. Schema writes run in one serialized release/setup process, not every ARSY replica.

Kysely remains internal to SQL adapters as query/dialect infrastructure, not a second ORM. libSQL and PostgreSQL share a tested portable feature subset; they are not behavior-identical. libSQL inherits SQLite's single-writer constraint; PostgreSQL is the recommended production profile. References: https://github.com/tursodatabase/libsql and https://kysely.dev/docs/getting-started

## 9. PocketBase BaseModel overlap decision

PocketBase's native model has id, created and updated. This is not a conceptual conflict with RIOTWORKS BaseEntity. If a PocketBase adapter is ever added, map logical id to native id, createdAt to native created, updatedAt to native updated; do not create duplicate physical fields. Actor metadata maps only if collections support a correct principal relation. PocketBase is excluded from v1 to avoid a second auth/schema/API authority. Do not build a PB compatibility layer now.

## 10. Portability rules

- Portable ID contract is an opaque string; v1 adapters use UUID values.
- Use UTC instants and normalize timestamps.
- Money uses decimal-safe values or integer minor units plus currency.
- Use common scalar, relation, index, uniqueness and JSON semantics.
- Capability-gate row/advisory locks, JSON path, full text, partial indexes, generated columns, vendor functions and advanced bulk operations.
- Unsupported semantics fail explicitly; never silently degrade.
- Changing provider requires export/import, constraint/index rebuild, checksum/aggregate comparison, FK validation and tested cutover/rollback. Changing DATABASE_URL does not move data.

## 11. Security requirements

- Workspace context comes from authenticated server-side principal and membership, not client-supplied workspace IDs alone.
- Record rules apply to reads and writes, including relation traversal and batch operations.
- Schema API requires deployment/operator authorization and least-privilege credentials.
- Secret values live in a secret manager; models store secret references.
- Audit redacts credentials and sensitive values.
- Public APIs expose DTOs/services, never arbitrary model access.

## 12. Acceptance checklist

- [ ] BaseEntity injects the five fields exactly once.
- [ ] Actor attribution is trusted and null only for documented system/import cases.
- [ ] Base addon manifests are independent, versioned and dependency-checked.
- [ ] Security/workspace/company are separate bounded contexts.
- [ ] Audit, events, outbox, chatter, activity, jobs and notifications are not conflated.
- [ ] Persistent/abstract/transient model semantics are tested.
- [ ] Extension, field conflicts, dependency cycles and deterministic registry are tested.
- [ ] Record rules and workspace isolation are tested for search/read/write/relations.
- [ ] Mixins add behavior and policy, not just fields.
- [ ] Programmatic schema API calls one reconciler and records receipts.
- [ ] libSQL/PostgreSQL shared portability contract passes integration tests.
- [ ] PocketBase is not a v1 runtime dependency.
- [ ] No feature is declared implemented without code, tests and build evidence.


## 13. Delivery staging and repository status
The 17 logical addon manifests above are the complete target catalog, not a requirement to implement all modules in the first milestone. First deliver base.core, base.identity, base.security, base.workspace, base.audit and base.events after the ORM and database runtime are proven. Next add settings, attachment, sequence and transient capabilities as required by the first commercial workflow. Company, communication, activity, import-export, integration, taxonomy and localization are staged by demonstrated use case. Keep one release package with independent manifests; do not split into 17 npm packages without a real versioning/deployment need.

At the audited MOONWITNESS repository snapshot, the ORM and all Base Platform addon packages are absent. This blueprint is a target contract, not implementation evidence. Follow docs/23 for current-state inventory and execution order.


## 14. Canonical TypeScript declaration and System Mode contract

The canonical v1 declaration is programmatic TypeScript source inside the addon/module that owns the model. Do not add a separate hand-maintained schema file or schema DSL as a second source of truth.

Preferred declaration shape:

```ts
import { Model, fields } from "@riotworks/orm";

export class Customer extends Model {
  static modelName = "crm.customer";
  static module = "crm";

  static fields = {
    name: fields.Char({ required: true, maxLength: 160 }),
    email: fields.Char({ index: true }),
    active: fields.Boolean({ default: true }),
    creditLimit: fields.Decimal({ precision: 18, scale: 2 }),
  };
}
```

The static field map is the canonical v1 syntax because it is explicit, introspectable without constructing a record instance, and compatible with deterministic registry composition. Property decorators may be added later only as optional syntax sugar that normalizes to the same metadata contract. They must not create a second model-definition path or require experimental decorator settings for v1.

The ORM turns declarations into immutable normalized metadata. That metadata is the runtime registry input and the source for desired persistence state; it is not edited independently. Physical database schema is a projection of the composed registry.

### System Mode

System Mode is an explicit install/upgrade/reconciliation lifecycle:

1. Initialize SQLite System Database and core configuration.
2. Discover trusted packages; validate signatures, manifests, compatibility and permissions.
3. Resolve enabled addon/module dependency graph.
4. Register model declarations and compose the deterministic registry.
5. Inject BaseEntity once; validate fields, relations, extensions, constraints and policy metadata.
6. Generate a stable registry fingerprint and desired persistence snapshot.
7. Introspect actual database state and produce a deterministic plan.
8. Apply only authorized changes under a serialized deployment/system lock.
9. Run versioned TypeScript semantic upgrade handlers when needed.
10. Verify the result and persist a synchronization receipt.
11. Activate Runtime Mode with the verified immutable registry.

Runtime Mode serves API/worker requests against the activated registry. It does not discover arbitrary code or execute schema DDL. Normal HTTP requests never invoke reconciliation. API replicas must not race to apply schema changes.

### Environment and recordset

`env` is an immutable/scoped execution context containing transaction/unit-of-work, authenticated principal, workspace/tenant, optional company context, permissions, locale/timezone, trace/request metadata and approved ARSY service capabilities.

A recordset is a typed collection bound to one model and one Environment. It has consistent empty/single/multiple behavior, batch operations and controlled relation prefetch. Mixing recordsets across tenants, registries, principals or transactions is rejected unless an explicit safe conversion is defined. Prefer `env.models` as the foundational access API; class/static convenience methods must delegate to it and never hide security or transaction context.

### Reconciliation safety

Additive, deterministic, non-destructive changes may be eligible for automatic application. Destructive changes, type narrowing, relation semantic changes, drops and data transformations require an explicit operator plan/approval and recovery readiness. Disabling a module or removing a declaration never silently drops stored data. Semantic transformations use versioned TypeScript handlers; physical DDL remains adapter-owned.

## 15. System Database, Business Database and plugin trust boundary

SQLite is the ARSY System Database for plugin/module installation state, typed system configuration, registry fingerprints/snapshots, schema plans/receipts, system audit and runtime control-plane state. Use a persistent volume, WAL where appropriate, busy timeout, integrity checks and one serialized writer. Do not use a shared network filesystem as a multi-writer SQLite cluster.

PostgreSQL is the primary Business Database for users/workspaces and business-domain records, with transactions for business mutations and required audit/outbox writes. Do not assume a distributed transaction exists between SQLite and PostgreSQL. Use explicit orchestration and idempotent recovery across the boundary.

Redis provides runtime cache/coordination/locks/queue transport; it is not the durable source of business or model-definition truth. Object-storage providers store bytes while business records store metadata/object keys. Telegram is an external connector, never a database provider. libSQL can be evaluated as an optional lightweight business provider, but does not replace SQLite control-plane ownership or PostgreSQL production default.

Only trusted, verified in-process addons may contribute executable TypeScript model classes to the ARSY registry. Community/untrusted plugins run isolated and communicate through versioned, permission-scoped RPC contracts. A future declarative remote-model contract must not allow arbitrary remote code injection into the main process.
