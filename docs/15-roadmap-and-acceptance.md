# 15 — Roadmap & Acceptance Criteria

**Status:** Approved execution baseline | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Delivery strategy
Build incrementally. Visual prototype, backend runtime, ORM, SQL providers, addons, and commercial workflows are separate milestones. Do not claim a package exists until code, tests, and build checks prove it.

## 2. Phases
### Phase 0 — Product and architecture baseline
Narrative, business model, marketplace matrix, factories, autonomy, Headquarter IA, design DNA, monorepo, Fastify, ORM/addons, minimal BaseEntity, audit, provider portability, programmatic schema API. Exit: docs are internally consistent and coding agents need not invent package/schema responsibilities.

### Phase 1 — Headquarter prototype
apps/headquarter, design system, ARSY DECK, SIGNAL ROOM, RIOT RADAR, THE FORGE, ZILL WATCH, secondary module shells, dual themes, explicit demo data. Exit: responsive UI, no dead controls, no fake integrations.

### Phase 2 — Workspace and contracts
pnpm workspace, TypeScript/lint, types, contract, minimal apps/arsy, typed Headquarter API client. Exit: build/typecheck, health route and contract tests.

### Phase 3 — ARSY runtime
arsy-core, Fastify factory, lifecycle, config validation, health/readiness, logs/errors, graceful shutdown. Exit: clean start/stop and Fastify injection tests.

### Phase 4 — ORM foundation
Metadata/fields, registry, extension/composition, query AST, addon manifest/dependencies, typed CRUD. Exit: deterministic composition and invalid conflict/cycle errors.

### Phase 5 — Database runtime and SQL adapters
orm-db, provider-neutral contract, PostgreSQL/libSQL adapters, capability matrix, Kysely internal query execution, private schema API, schema-state ledger. Exit: shared provider tests pass, unsupported capability errors are explicit, sync is idempotent/recoverable.

### Phase 6 — Base addon and audit
Minimal BaseEntity: id, createdAt, updatedAt. Opt-in ownership/archive/toggle/version/soft-delete mixins. Central AuditTrail and transaction/outbox. Exit: fields composed once, optional mixins only when requested, audit consistency tested.

### Phase 7 — Domain addons
Project and Intelligent models/services/permissions; typed data-upgrade handlers only for semantic data transformations. Exit: dependency order and no duplicate base/audit fields.

### Phase 8 — Headquarter/ARSY integration
Auth/permissions, typed APIs, audit/approval views, asset/product workflows. Exit: frontend/backend contract and integration tests.

### Phase 9 — First commercial slice
One Digital Utility and one Stock Asset product family, evidence/provenance, inspection/listing package, manual marketplace submission first, financial reconciliation. Exit: real product QA and submitted through an allowed channel; actual financial records reconciled.

### Phase 10 — Safe automation
Job scheduler/workers, approval inbox/budgets, verified marketplace integrations, Aftershock experiments and portfolio retirement. Exit: observable, bounded automation with recovery.

## 3. First commercial pilot
Start with one useful digital utility, one differentiated stock asset collection, optionally one affiliate experiment after eligibility, product truth, and disclosures are checked. Do not activate every factory/channel at once.

## 4. Technical acceptance
- apps/headquarter is the frontend; no apps/web.
- ARSY starts Fastify through arsy-core.
- Package boundaries match docs/18 and docs/21.
- ORM/addon composition is deterministic.
- BaseEntity injects only id, createdAt, updatedAt.
- Optional mixins have distinct semantics and tests.
- Required SQL audit writes are transactionally consistent.
- PostgreSQL/libSQL pass shared portable adapter tests.
- Routine model additions need no handwritten schema files.
- Private schema API applies safe changes and records receipts.
- Destructive/semantic changes require explicit plan, authorization, typed handling.
- No untrusted code loading or raw secrets in client/logs.
- Shared contracts and provider-specific tests are maintained.

## 5. Business acceptance
Opportunity scores cite dated evidence/confidence. Products have clear buyer/job/differentiation. Rights/licenses/AI disclosures are recorded. Channel eligibility/fees verified. Revenue, fees, pending/settled, refunds, payouts, costs are distinct. Net contribution reconciles to evidence. No fabricated traffic, orders, reviews, sales.

## 6. Design acceptance
RIOTWORKS identity, Extreme Riot + MoonWitness Comic + Industrial + Game HUD DNA, Night Riot/Paper Riot themes, consistent original characters, accessible data/forms, responsive and keyboard use, reduced motion. Avoid generic SaaS drift.

## 7. Definition of done
A feature is complete only when user problem, domain state, permissions, failure behavior, tests, audit/logs, docs, and visible states are covered. Scaffolding/placeholders are not done.


## 6. v1.3 ORM/base-platform acceptance
BaseEntity injects five fields exactly once: id, createdAt, createdById, updatedAt and updatedById. Implement the Odoo-inspired foundation addon suite in dependency order as defined in docs/22. Prove persistent/abstract/transient models, registry extension, typed fields/relations, domain AST, recordset batching, cache invalidation, ACL/record rules and workspace isolation. Audit, events/outbox, chatter, activities, jobs and notifications must remain distinct. The complete target is staged; do not claim all capabilities are implemented before tests pass.
