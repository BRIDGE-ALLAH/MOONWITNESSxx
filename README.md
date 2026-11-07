# MOONWITNESS // RIOTWORKS

**The Creative Commerce Engine**  
**MAKE WORK THAT OUTLIVES THE FEED.**

RIOTWORKS is the marketplace-native creative business division of the MOONWITNESS ecosystem. It helps one operator research demand, create original digital products, protect quality and provenance, prepare distribution through buyer-facing marketplaces, and learn from actual commercial outcomes.

> **READ THE SIGNAL. FORGE THE WORK. LET IT TRAVEL.**

RIOTWORKS is not a generic AI content generator, agency CRM, dropshipping dashboard, or passive-income promise. It is a responsible operating system for building a diversified portfolio of digital works.

## Product thesis

Most AI tools ask: "What can we generate?"

RIOTWORKS asks: **"What real need can we verify, what original product can serve it, and where do relevant buyers already discover solutions?"**

**SIGNALS → EVIDENCE → OPPORTUNITIES → ORIGINAL WORK → QUALITY GATES → DISTRIBUTION → REVENUE → LEARNING → BETTER PORTFOLIO**

The system automates repeatable work where technically and legally permitted. It does not manufacture demand or guarantee traffic, sales, ranking, monetization approval, or passive income.

## MoonWitness ecosystem position

- **EMPIRE OF THE LIGHT** — overarching narrative and values universe.
- **MOONWITNESS** — ecosystem for witnessing, discovering, creating, protecting, and sharing.
- **RIOTWORKS** — creative commerce and digital business operations.
- **HEADQUARTER** — the human-facing command experience and frontend application.
- **ARSY** — the backend application/runtime and orchestration API.
- **ZILL** — integrity, quality, licensing, policy, and protection guardrails.
- **MIZAN** — revenue, cost, payout, and accountability records.

Sacred and spiritual language is treated respectfully. It is not used as a gimmick, false authority claim, or decorative shortcut.

## Business engines

| Priority | Factory | Example products | Monetization route |
|---|---|---|---|
| P1 | Digital Utility | Original spreadsheets, calculators, planners, templates, useful packs | Eligible digital marketplaces |
| P1 | Stock Asset | Original illustrations, vectors, backgrounds, motion/video assets | Agencies accepting the asset type |
| P2 | Affiliate Media | Honest product explainers and demonstrations | Eligible affiliate programs |
| P2 | Publishing | Original ebooks, workbooks, practical guides | Publisher/retail royalties |
| P3 | Workflow Products | Original automation templates, scripts, presets, creator workflows | Suitable creator marketplaces |
| P3 | Media | Original explainers, tutorials, animation, educational media | Platform monetization when eligible |
| P4 | Game Assets & Microgames | Original UI kits, models, game assets, experiences | Eligible creator stores and programs |

Channels are enabled only after current country eligibility, payout, policy, fees, and integration capability are checked.

## Differentiation

- **Demand Gap Mining:** discover underserved buyer problems from permitted public evidence.
- **Evidence-first scoring:** source, date, confidence, assumptions, and unknowns are visible.
- **Product families:** create meaningful variations, not duplicate spam.
- **Living Products:** versioning, compatibility, changelogs, and maintenance.
- **ZILL Watch:** rights, provenance, technical quality, disclosure, and platform-policy gates.
- **Channel Capability Registry:** distinguish manual packages from official read/write APIs.
- **Aftershock:** learn which products create discovery, conversion, and net contribution.
- **Portfolio Retirement:** improve, pause, archive, or retire weak products.
- **Marketplace-native discovery:** prioritize buyer-search and recommendation ecosystems instead of cold outreach.
- **Responsible autonomy:** automate repeatable tasks without bypassing platform rules or human accountability.

## Applications and packages

### Applications

- **apps/headquarter** — RIOTWORKS frontend and operator experience; the only user-facing frontend application name.
- **apps/arsy** — Fastify backend application and API composition root.

### Core packages

- **packages/arsy-core** — Fastify platform core, lifecycle, plugins, configuration, health, and shared runtime facilities.
- **packages/orm** — custom Odoo-inspired metadata-driven ORM and addon registry.
- **packages/orm-db** — database runtime, transactions, unit-of-work, programmatic schema reconciliation, and data-upgrade coordination.
- **packages/orm-db-adaptor** — provider-neutral contracts, capabilities, and registry.
- **packages/orm-db-adaptor-postgres** — PostgreSQL adapter for production.
- **packages/orm-db-adaptor-libsql** — libSQL/SQLite-compatible adapter for local/single-node deployments.
- **packages/orm-addon-base** — minimal BaseEntity, opt-in lifecycle mixins, central audit.
- **packages/orm-addon-project** — project-domain models and services.
- **packages/orm-addon-intelligent** — AI, agents, models, prompts, tools, runs, evaluations, and usage.
- **packages/types** — shared framework-agnostic TypeScript types.
- **packages/contract** — runtime API schemas, DTO contracts, and inferred types.
- **packages/lint** — shared lint, format, and TypeScript configuration.

PostgreSQL is recommended for production; libSQL is the lightweight/local/single-node option. Kysely is internal to SQL adapters. PocketBase is not part of v1 persistence. BaseEntity injects five universal metadata fields; the Odoo-inspired base platform is a suite of independently declared addons for identity, security, workspace, audit, events, communication, activities, attachments, sequences, settings, localization and more.

Package boundaries and dependency rules are defined in [docs/18-monorepo-and-orm-addon-architecture.md](./docs/18-monorepo-and-orm-addon-architecture.md), [docs/19-orm-addon-development-guide.md](./docs/19-orm-addon-development-guide.md), and [docs/20-schema-reconciliation-and-upgrade-engine.md](./docs/20-schema-reconciliation-and-upgrade-engine.md).

## Product modules

- **ARSY DECK** — command center.
- **SIGNAL ROOM** — market research and source evidence.
- **RIOT RADAR** — opportunity evaluation.
- **THE FORGE** — product creation and production.
- **ZILL WATCH** — quality, rights, and policy inspection.
- **LAUNCH BAY** — channel readiness and distribution.
- **SIDRA ARCHIVE** — assets, provenance, and versions.
- **MIZAN LEDGER** — financial records and payouts.
- **AFTERSHOCK** — performance and portfolio learning.
- **RIOT ENGINE** — agents, workflows, schedules, budgets, and logs.

## Repository documentation

| Path | Purpose |
|---|---|
| [MASTER-PROMPT](./MASTER-PROMPT) | Full-stack implementation master prompt |
| [docs/01-ecosystem-narrative.md](./docs/01-ecosystem-narrative.md) | MoonWitness narrative and values |
| [docs/02-product-charter.md](./docs/02-product-charter.md) | Product definition and scope |
| [docs/03-business-model.md](./docs/03-business-model.md) | Revenue portfolio and economics |
| [docs/04-marketplace-portfolio.md](./docs/04-marketplace-portfolio.md) | Marketplace rules and channel capability |
| [docs/05-market-intelligence.md](./docs/05-market-intelligence.md) | Demand research and scoring |
| [docs/06-product-factories.md](./docs/06-product-factories.md) | Production factories |
| [docs/07-autonomy-operating-model.md](./docs/07-autonomy-operating-model.md) | Agents, automation, approvals |
| [docs/08-technical-architecture.md](./docs/08-technical-architecture.md) | Headquarter, ARSY, ORM and adapters |
| [docs/09-information-architecture.md](./docs/09-information-architecture.md) | Headquarter navigation and journeys |
| [docs/10-design-dna.md](./docs/10-design-dna.md) | RIOT art direction |
| [docs/11-design-system.md](./docs/11-design-system.md) | Tokens and components |
| [docs/12-character-art-bible.md](./docs/12-character-art-bible.md) | Comic character universe |
| [docs/13-domain-and-data-model.md](./docs/13-domain-and-data-model.md) | Base entities and domain data |
| [docs/14-governance-and-risk.md](./docs/14-governance-and-risk.md) | Rights, security, and compliance |
| [docs/15-roadmap-and-acceptance.md](./docs/15-roadmap-and-acceptance.md) | Phases and acceptance criteria |
| [docs/16-research-register.md](./docs/16-research-register.md) | Research sources and caveats |
| [docs/17-glossary.md](./docs/17-glossary.md) | Canonical terminology |
| [docs/18-monorepo-and-orm-addon-architecture.md](./docs/18-monorepo-and-orm-addon-architecture.md) | Workspace, packages, ORM, adapter architecture |
| [docs/19-orm-addon-development-guide.md](./docs/19-orm-addon-development-guide.md) | Addon manifests, model inheritance, base fields |
| [docs/20-schema-reconciliation-and-upgrade-engine.md](./docs/20-schema-reconciliation-and-upgrade-engine.md) | ARSY internal schema API and programmatic reconciliation |
| [docs/21-database-provider-strategy.md](./docs/21-database-provider-strategy.md) | PostgreSQL/libSQL decision, portability, BaseEntity mapping |
| [docs/22-base-platform-and-orm-capability-blueprint.md](./docs/22-base-platform-and-orm-capability-blueprint.md) | Complete base addon catalog, Odoo-inspired ORM capability matrix, mixins and ownership boundaries |

## Current status

This repository is a **documentation and architecture baseline**. The target structure is specified; applications and packages are not claimed to be implemented until code, tests, and build checks exist.

Recommended delivery sequence:

1. Finalize specifications.
2. Build the apps/headquarter visual prototype.
3. Scaffold the TypeScript monorepo and package contracts.
4. Implement packages/orm and orm-addon-base with automatic schema reconciliation.
5. Implement PostgreSQL and libSQL adapters behind one contract and prove portability with shared integration tests.
6. Build apps/arsy and connect Headquarter through typed contracts.
7. Add Project and Intelligent addons.
8. Validate the first real product-to-marketplace workflow.

## Financial truth

Track net contribution, not vanity revenue:

Gross receipts  
− refunds / chargebacks  
− marketplace and payment fees  
− affiliate reversals  
− production and compute costs  
− paid promotion  
− other attributable variable costs  
= **net contribution before tax**

Cash received, pending commissions, estimated royalties, tax withholding, FX, and payout reserves are separate records.

## Documentation status

Product definition and architecture baseline: **v1.3**, updated 2026-11-07. This is a finalized specification baseline, not a claim that software, integrations, business results, or platform approvals are already complete.

---

**NO EMPTY NOISE. MAKE SOMETHING REAL.**  
**MOONWITNESS // RIOTWORKS**
