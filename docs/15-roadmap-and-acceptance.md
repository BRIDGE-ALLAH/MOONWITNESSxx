# 15 — Roadmap & Acceptance Criteria

**Status:** Approved execution baseline  
**Version:** 1.1  
**Updated:** 2026-11-07

## 1. Delivery strategy

Build the business loop in small increments. The visual prototype, backend runtime, ORM, adapters, addons, and revenue operations are separate milestones. Do not claim a target package exists until code, tests, and build checks prove it.

## 2. Phases

### Phase 0 — Product and architecture baseline
Narrative, business model, marketplace matrix, product factories, autonomy, Headquarter IA, design DNA, monorepo, Fastify, ORM/addon architecture, BaseEntity, audit, adapter boundaries.

Exit: documentation is internally consistent and a coding agent can scaffold without inventing package responsibilities.

### Phase 1 — Headquarter prototype
- apps/headquarter.
- RIOTWORKS design system.
- ARSY DECK, SIGNAL ROOM, RIOT RADAR, THE FORGE, ZILL WATCH.
- Secondary module shells.
- Dark/light themes and local interactions.
- Explicit demo data.

Exit: responsive UI, no dead controls, no fake integrations, visual acceptance met.

### Phase 2 — Workspace and shared contracts
- pnpm monorepo.
- Root TypeScript/lint configuration.
- packages/types.
- packages/contract.
- packages/lint.
- apps/arsy minimal Fastify bootstrap.
- Headquarter typed API client.

Exit: all workspace packages build/typecheck; health route and contract tests pass.

### Phase 3 — ARSY runtime core
- packages/arsy-core.
- Fastify app factory.
- Plugin/lifecycle management.
- Config validation.
- Health/readiness.
- Structured logging and errors.
- Graceful shutdown.

Exit: ARSY starts and stops cleanly; Fastify injection tests pass.

### Phase 4 — ORM foundation
- packages/orm.
- Metadata/field builders.
- Model registry.
- Model extension and composition.
- Query/domain AST.
- Addon manifest and dependency resolution.
- Typed CRUD abstractions.

Exit: registry and model composition tests pass; invalid conflicts and cycles fail explicitly.

### Phase 5 — DB runtime and PocketBase adapter
- packages/orm-db.
- packages/orm-db-adaptor.
- packages/orm-db-adaptor-pocketbase.
- Capability matrix.
- PocketBase contract tests.
- Migrations and deployment runbook.

Exit: supported operations pass adapter tests and unsupported capabilities fail with typed errors. No false transaction/join claims.

### Phase 6 — Base addon and shared audit
- packages/orm-addon-base.
- Automatically composed BaseEntity.
- active/archive/restore behavior.
- created/updated timestamps and actor fields.
- central AuditTrail service and lifecycle hooks.

Exit: new test addon receives common fields without redeclaring them; audit is generated centrally with failure-mode tests.

### Phase 7 — Domain addons
- packages/orm-addon-project.
- packages/orm-addon-intelligent.
- Their models, services, migrations, and permission declarations.

Exit: each addon installs in dependency order and uses base fields/audit without duplication.

### Phase 8 — Headquarter and ARSY business integration
- Auth and permissions.
- Project and Intelligent API modules.
- Replace selected demo data with real typed endpoints.
- Audit/approval views.
- Asset and product workflows.

Exit: Headquarter-to-ARSY contract and integration tests pass.

### Phase 9 — First real commercial slice
- One useful Digital Utility product family.
- One original Stock Asset product family.
- Evidence and provenance.
- Inspection and listing package.
- Manual marketplace submission first.
- Actual statement/fee/payout reconciliation.

Exit: at least one real product passes QA and is submitted through an allowed channel; real financial records are reconciled.

### Phase 10 — Safe automation and portfolio learning
- Job scheduler and worker execution.
- Approval inbox and budgets.
- Official marketplace integrations only after exact capability verification.
- Aftershock experiments and portfolio retirement.

Exit: repeatable, observable, bounded automation with safe recovery.

## 3. First commercial pilot

Start with:
1. An original useful digital utility, e.g. a tested small-business spreadsheet/template.
2. An original differentiated stock asset collection.
3. One affiliate media experiment only after actual account eligibility, product truth, and disclosure requirements are checked.

Do not activate every factory/channel at the same time.

## 4. Technical acceptance

- apps/headquarter is the frontend application; no generic apps/web.
- apps/arsy starts Fastify through packages/arsy-core.
- Package names and boundaries match docs/18.
- TypeScript workspace builds and typechecks.
- packages/orm supports declarative metadata and model registry.
- Addon dependencies resolve deterministically.
- orm-addon-base supplies common fields and central audit.
- Project and Intelligent addons do not duplicate base fields.
- PocketBase adapter capability declaration matches tested behavior.
- No untrusted code loading or raw secrets in client/logs.
- Contract schemas are shared between frontend and backend.
- Tests cover happy paths, failures, unsupported operations, and permissions.

## 5. Business acceptance

- Opportunity scores cite dated evidence and show confidence.
- Products have clear buyer/job/differentiation.
- Rights, licenses, and AI disclosures are recorded.
- Channel eligibility and fees are verified at activation.
- Distribution mode is honestly labeled.
- Financial data distinguishes gross, fees, pending, settled, refunds, payouts, and costs.
- Net contribution can be reconciled to source evidence.
- No fake traffic, orders, reviews, clicks, or sales.

## 6. Design acceptance

- RIOTWORKS identity is recognizable without logo.
- Extreme Riot + MoonWitness Comic + Industrial + Game HUD DNA is coherent.
- Night Riot and Paper Riot themes are intentional.
- Characters are original and consistent.
- Data, tables, finance, and forms remain accessible.
- No generic SaaS template drift.
- Responsive, keyboard-usable, reduced-motion aware.

## 7. Definition of done

A feature is complete only when its user problem, domain state, permission rules, failure behavior, tests, logs/audit, documentation, and user-visible states are all covered. Do not mark scaffolding or placeholder folders as completed features.
