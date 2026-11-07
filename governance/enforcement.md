# Governance Rule-to-Enforcement Register

**Authority:** [Governance index](./README.md) and the contracts in [contracts/](./contracts/README.md).  
**Purpose:** make every normative contract rule traceable to a concrete control and honest maturity status.  
**Review owner:** Repository maintainers coordinate; each contract owner approves its rows.

## Status vocabulary

- **CI active** — currently checked by a passing CI step on the PR head.
- **Local active** — currently checked by a local script or hook; CI coverage may be separate.
- **Repository pending** — requires GitHub administrator configuration/readback.
- **Human review** — currently enforced by an explicit owner/reviewer decision, not executable automation.
- **Phase 2/3/4/5 planned** — not enforced yet; the named phase must add tests and evidence before this becomes active.

A document stating a rule is not enforcement. A check that covers only part of a rule is labelled partial. Do not promote a row to active based only on file existence.

## Identity contract

- **ID-01** — Canonical repository is BRIDGE-ALLAH/MOONWITNESS
  - Enforcement: GitHub repository context; repo audit identity constant; owner review for rename
  - State: CI active / Human review
- **ID-02** — Root package is moonwitness
  - Enforcement: `scripts/repo-audit.mjs`
  - State: CI active
- **ID-03** — RIOTWORKS is a division, not repository identity
  - Enforcement: Governance index and identity contract; review references in docs/agents
  - State: Human review
- **ID-04** — Internal packages may use @riotworks/*
  - Enforcement: Workspace manifest review; duplicate-name audit
  - State: CI active (uniqueness), Human review (namespace policy)
- **ID-05** — Automation prefers GitHub Actions repository context
  - Enforcement: Workflow review; avoid hard-coded owner/repo where context is available
  - State: Human review
- **ID-06** — Repository rename and package namespace change are separate decisions
  - Enforcement: Identity contract and explicit decision record
  - State: Human review

## Repository contract

- **REP-01** — Headquarter owns frontend; ARSY owns backend/orchestration
  - Enforcement: Architecture docs, package ownership review
  - State: Human review
- **REP-02** — packages/* owns reusable libraries/contracts/adapters/domain modules
  - Enforcement: Workspace manifest audit; ownership review
  - State: Partial: CI active / Human review
- **REP-03** — services/* excluded until ownership reconciled
  - Enforcement: pnpm workspace glob audit
  - State: CI active
- **REP-04** — Packages cannot import apps; Headquarter uses API contracts; ARSY cannot depend on UI
  - Enforcement: Dependency graph/AST boundary tests
  - State: Phase 2 planned
- **REP-05** — Every workspace package has valid manifest and unique name; planning folders are not packages
  - Enforcement: `scripts/repo-audit.mjs`
  - State: CI active
- **REP-06** — Root commands are deterministic and propagate failures; no shell background orchestration
  - Enforcement: Script contract review; negative exit-code tests
  - State: Partial: Human review; Phase 2 planned
- **REP-07** — Declared commands perform real checks, not placeholder success
  - Enforcement: Root/package script review and command tests
  - State: Partial: Human review; Phase 2 planned
- **REP-08** — Manifest and lockfile changes are committed together
  - Enforcement: Frozen lockfile check and clean install
  - State: CI active

## Architecture contract

- **ARC-01** — Headquarter uses public versioned ARSY API and no direct database access
  - Enforcement: Import graph, secret scan, API boundary tests
  - State: Phase 2/3 planned
- **ARC-02** — ARSY is Fastify backend/composition root and owns runtime/security/ORM/addons/routes/readiness
  - Enforcement: Architecture review and runtime integration tests
  - State: Human review / Phase 5 planned
- **ARC-03** — packages/contract owns wire contracts; packages/types owns framework-neutral primitives
  - Enforcement: Import ownership and package contract tests
  - State: Phase 2 planned
- **ARC-04** — ORM, orm-db, provider-neutral contracts, and concrete adapters have distinct ownership
  - Enforcement: Dependency graph and adapter contract tests
  - State: Phase 2 planned
- **ARC-05** — Kysely stays in concrete SQL adapters; no second ORM/model registry without approved replacement
  - Enforcement: Import graph plus architecture decision review
  - State: Phase 2 planned / Human review
- **ARC-06** — Trusted TypeScript addon declarations are desired-schema source; physical DDL is still real
  - Enforcement: ORM/schema reconciliation tests and architecture review
  - State: Phase 2/5 planned
- **ARC-07** — Legacy services stay outside workspace until ownership/runtime boundaries are reconciled
  - Enforcement: Workspace glob audit and migration review
  - State: CI active / Human review

## API contract

- **API-01** — Headquarter communicates with ARSY through typed, versioned API contracts
  - Enforcement: Client/server contract tests and import-boundary checks
  - State: Phase 2/3 planned
- **API-02** — Wire schemas/types live in packages/contract; primitives in packages/types
  - Enforcement: Package ownership and import-boundary checks
  - State: Phase 2 planned
- **API-03** — Headquarter cannot import ARSY internals, DB adapters/drivers, credentials, or private schema clients
  - Enforcement: AST dependency boundary tests and secret scanning
  - State: Phase 2/3 planned
- **API-04** — Validation and authorization run server-side; client types are not security
  - Enforcement: API authorization tests
  - State: Phase 3 planned
- **API-05** — Schema control-plane APIs require operator/deployment identity and are not ordinary UI capabilities
  - Enforcement: Endpoint exposure and role/permission integration tests
  - State: Phase 3/5 planned
- **API-06** — API changes state compatibility, authorization, error semantics, and version strategy
  - Enforcement: PR checklist/template and owner review
  - State: Human review
- **API-07** — External side effects are idempotent/receipt-protected; financial/publication receipts preserved
  - Enforcement: Idempotency/receipt integration tests and domain review
  - State: Phase 3/5 planned

## Data contract

- **DAT-01** — BaseEntity v1.3 has exactly five logical fields
  - Enforcement: ORM metadata tests and docs/13 reconciliation
  - State: Phase 2 planned / Human review
- **DAT-02** — ORM composes universal metadata once; addons do not redeclare it; optional concerns are mixins
  - Enforcement: Model registry tests and addon fixtures
  - State: Phase 2 planned
- **DAT-03** — AuditTrail is append-only for ordinary code; redact secrets/sensitive personal data
  - Enforcement: Repository/API policy review, append-only tests, redaction tests
  - State: Phase 2/5 planned
- **DAT-04** — Required audit mutation is atomic; external effects use outbox/idempotent dispatch
  - Enforcement: Transaction and outbox integration tests
  - State: Phase 5 planned
- **DAT-05** — PostgreSQL production recommendation; libSQL local/embedded/single-node; respect SQLite single-writer limits
  - Enforcement: Provider capability tests and deployment profile review
  - State: Phase 5 planned / Human review
- **DAT-06** — Portability is capability-based, not identical concurrency/locking/performance
  - Enforcement: Adapter capability contract tests
  - State: Phase 2 planned
- **DAT-07** — Money exact decimal/minor units plus currency; UTC instants; preserve FX provenance
  - Enforcement: Domain validation and persistence round-trip tests
  - State: Phase 2/5 planned
- **DAT-08** — Provenance, financial events, receipts, publication history retained by domain policy
  - Enforcement: Retention/export tests and domain owner review
  - State: Phase 5 planned / Human review
- **DAT-09** — Raw provider credentials never enter domain tables, logs, artifacts, or frontend state
  - Enforcement: Secret scanning, structured-log redaction tests, API review
  - State: Partial: CI security scanning / Phase 3/5 planned

## GitHub governance contract

- **GIT-01** — main protected against unreviewed changes
  - Enforcement: GitHub ruleset/branch protection readback and test PR
  - State: Repository pending
- **GIT-02** — Short-lived branches use approved slash prefixes
  - Enforcement: CI push filters; branch naming review
  - State: CI active / Human review
- **GIT-03** — PRs target main unless a documented protected integration branch exists
  - Enforcement: PR base review and ruleset
  - State: Human review / Repository pending
- **GIT-04** — PR describes problem, owner/boundaries, acceptance, validation, security/data and recovery impact
  - Enforcement: PR template/checklist and review
  - State: Human review
- **GIT-05** — Required checks match stable real check names
  - Enforcement: Administrator ruleset readback; workflow run verification
  - State: Repository pending
- **GIT-06** — Actions use least-privilege permissions; read-only jobs use contents: read
  - Enforcement: Workflow YAML review and CodeQL
  - State: Partial: CI active / Human review
- **GIT-07** — CI push filters match slash-based branches
  - Enforcement: Workflow trigger declaration and branch push run
  - State: CI active
- **GIT-08** — No workflow bypasses review, suppresses failures, or deploys after failed validation
  - Enforcement: Workflow review and negative-path tests
  - State: Human review / Phase 3 planned

## Automation contract

- **AUT-01** — Each automation has one owner, trigger, responsibility, and side-effect boundary
  - Enforcement: Workflow inventory and ownership review
  - State: Partial: Human review
- **AUT-02** — Read-only default; writes require intent, least privilege, idempotency, deduplication, observability, retry policy
  - Enforcement: Permission review and repeated-run integration tests
  - State: Partial: CI active / Phase 3 planned
- **AUT-03** — Scheduled detection reports findings and does not flood Issues
  - Enforcement: Weekly workflow read-only permissions; no issue-write step
  - State: CI active
- **AUT-04** — Hooks are local, fast, deterministic, offline, and credential-independent
  - Enforcement: Hook source review and isolated hook tests
  - State: Partial: Local active / Phase 2 planned
- **AUT-05** — Required validation fails closed if it cannot execute
  - Enforcement: Script exit-code tests and CI failure-path tests
  - State: Partial: CI active / Phase 2 planned
- **AUT-06** — Commits do not mutate versions, changelogs, production data, or architecture state
  - Enforcement: Hook source audit and commit integration tests
  - State: Local active / Human review
- **AUT-07** — AI assistance is opt-in and not required by CI/hooks
  - Enforcement: Workflow/hook source audit
  - State: Human review

## Installation contract

- **INS-01** — Installer is idempotent, version-aware, observable, safe to rerun
  - Enforcement: Installer integration/idempotency tests
  - State: Phase 4 planned
- **INS-02** — Shell entrypoints delegate shared behavior to one Node implementation
  - Enforcement: Installer architecture review and shell smoke tests
  - State: Phase 4 planned
- **INS-03** — Detect OS/architecture, Node, pnpm, Git, profile services
  - Enforcement: Preflight unit tests and OS matrix
  - State: Phase 4 planned
- **INS-04** — Separate preflight, dependencies, environment, hooks, validation, startup
  - Enforcement: Installer lifecycle tests
  - State: Phase 4 planned
- **INS-05** — Preserve user files/secrets; copy .env.example only if .env absent
  - Enforcement: Filesystem fixture tests
  - State: Phase 4 planned
- **INS-06** — Never print secrets or run unverified curl
  - Enforcement: Static script checks and secret-redaction tests
  - State: Phase 4 planned
- **INS-07** — Provide install, doctor, repair, update, verify, uninstall
  - Enforcement: CLI command/exit-code tests
  - State: Phase 4 planned
- **INS-08** — Production migrations/deletion/deployment/DNS/firewall/secret rotation require approval and recovery
  - Enforcement: Explicit approval gates and deployment audit
  - State: Phase 4/5 planned

## Security contract

- **SEC-01** — Secrets live in approved stores or ignored local env; examples use placeholders
  - Enforcement: Secret scanning, .gitignore review, sample-env tests
  - State: Partial: CI active / Phase 2 planned
- **SEC-02** — Workflows use least privilege and pinned toolchains
  - Enforcement: Workflow review, CodeQL, CI toolchain audit
  - State: Partial: CI active / Human review
- **SEC-03** — Dependency updates are reviewable and pass lockfile checks
  - Enforcement: Dependabot PR review and frozen lockfile CI
  - State: CI active
- **SEC-04** — Scripts/installers do not execute unverified remote code
  - Enforcement: Static script review and installer tests
  - State: Human review / Phase 4 planned
- **SEC-05** — Logs/artifacts redact credentials and sensitive application data
  - Enforcement: Redaction tests and artifact review
  - State: Phase 3/5 planned
- **SEC-06** — Production migrations/destructive operations require approval, backup, recovery
  - Enforcement: Deployment approval gates and restore drills
  - State: Phase 5 planned
- **SEC-07** — Scanners do not replace dependency review or runtime access-control verification
  - Enforcement: Required reviewer checklist and runtime security tests
  - State: Human review / Phase 3/5 planned

## Closure criteria

A row may be marked **CI active** only after:
1. The named test/check exists in the canonical repository.
2. A positive fixture passes and a negative fixture fails.
3. The check is wired to the intended workflow/required status.
4. A clean-checkout run is linked in the phase ledger.
5. An owner reviews the rule and its failure message.

Repository-pending rows require administrator readback. Human-review rows require an identified approving role and recorded decision. Planned rows remain open and MUST NOT be described as enforced.

