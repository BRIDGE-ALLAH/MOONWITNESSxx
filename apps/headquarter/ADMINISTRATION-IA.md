# Headquarter Administration — Information Architecture

**Status:** Product design baseline; routes and backend capabilities are not implemented unless explicitly listed in `FEATURE-ROLLOUT.md`.  
**Authority:** `docs/09-information-architecture.md`

## Operating principles

- Administration is separate from daily Command and Operations navigation.
- Workspace-scoped settings and platform-wide controls must not be conflated.
- Every write operation requires server-enforced authorization, explicit impact/confirmation, a result state, and an audit reference.
- Secrets are write-only/secret-reference values; never return provider credentials to the browser.
- Health and capability displays must be source-backed, timestamped, and distinguish degraded, unknown, unavailable, and healthy states.
- ORM, database, addon, and runtime internals are read-only diagnostics for restricted technical operators unless an explicit controlled workflow is approved.
- Navigation visibility is not authorization. ARSY must enforce every request.

## Proposed administration areas

### 1. Workspace Settings

**Purpose:** workspace-owned preferences and operating context.

Sections:
- Workspace identity and basic profile.
- Default locale, timezone, and currency.
- Workspace members and invitations (only after identity/membership APIs exist).
- Environment indicator (demo/staging/production) and workspace context.
- Data retention/export preferences when supported.

Required contracts:
- Workspace read/update and membership APIs.
- Server-enforced owner/admin capability.
- Audit events for member, environment, and retention changes.

Do not expose credentials, raw database configuration, or platform-wide provider settings here.

### 2. Policy Center

**Purpose:** policy configuration, eligibility governance, and review status.

Sections:
- Policy catalog and version.
- Country/channel eligibility requirements.
- Rights and content restrictions.
- Review queue, exceptions, and effective dates.
- Policy change history.

Required contracts:
- Versioned policy read model and evaluation result.
- Authorized policy mutation workflow, if approved.
- Provenance for evaluation, rule version, and reviewer.

Do not let Headquarter independently decide policy outcomes; ARSY/ZILL remain authoritative.

### 3. Marketplace Accounts

**Purpose:** connect, inspect, reauthorize, and revoke marketplace accounts.

Sections:
- Account identity and channel.
- Authorization status and expiry metadata (never token values).
- Verified connection health and capability scope.
- Reauthorization and revoke workflow.
- Account-level audit history.

Required contracts:
- OAuth start/callback lifecycle owned by backend.
- Secret-vault references and redacted account metadata.
- Verified health/capability response and scoped permission checks.

Never mark an account connected based on saved form state or a successful OAuth redirect alone.

### 4. AI Providers

**Purpose:** manage provider configuration and capability availability.

Sections:
- Provider/model catalog.
- Secret reference and credential validation state.
- Supported capability, limits, and availability.
- Default/fallback policy.
- Usage and error summary.

Required contracts:
- Backend secret vault and write-only secret update flow.
- Provider verification job and timestamped health.
- Capability and usage contracts.
- Platform-operator authorization and audit.

Do not send provider secrets to browser storage or return them from read APIs.

### 5. Addon Manager

**Purpose:** inspect and perform controlled addon lifecycle operations.

Sections:
- Installed addon identity, version, and signature.
- Compatibility and dependency status.
- Requested capabilities and granted permissions.
- Install/upgrade/disable/remove review.
- Operation progress, result, and audit reference.

Required contracts:
- Signed manifest/catalog and compatibility checks.
- Permission/capability declaration.
- Isolated execution and controlled lifecycle operation API.
- Technical-operator authorization and immutable audit event.

Do not execute arbitrary addon code in the browser or imply installation from a UI-only state change.

### 6. ORM / Infrastructure Health

**Purpose:** read-only diagnostics for technical operators.

Sections:
- ARSY liveness/readiness and dependency state.
- ORM model/registry summary.
- Adapter capability and migration status.
- Queue/worker/workflow health.
- Diagnostic correlation IDs and last checked timestamps.

Required contracts:
- Dedicated read-only diagnostic API with field redaction.
- Separate liveness and readiness semantics.
- Technical-operator access and audit logging for sensitive diagnostics.

Never expose database credentials, connection strings, SQL console, schema mutation, or raw internal objects in Headquarter.

### 7. Security & Audit

**Purpose:** review access and sensitive operational activity.

Sections:
- Actor, action, target, and timestamp.
- Workspace/environment scope.
- Outcome and reason.
- Correlation/request ID.
- Filter by actor, action, time range, and outcome.
- Export only where policy permits.

Required contracts:
- Append-only server-side audit event source.
- Cursor pagination and filter contract.
- Redaction, retention, and export policy.
- Auditor/security-operator authorization.

Do not fabricate audit events from frontend click handlers.

## Proposed access boundary (not an implemented role model)

| Area | Intended audience | Backend requirement |
|---|---|---|
| Workspace Settings | Workspace owner / delegated admin | Workspace-scoped settings and membership capabilities |
| Policy Center | Policy operator / authorized owner | Policy read and versioned review/write capability |
| Marketplace Accounts | Workspace owner / integration operator | Account-scoped connect, inspect, reauthorize, revoke |
| AI Providers | Platform operator | Secret-vault and provider configuration capability |
| Addon Manager | Technical platform operator | Signed addon and isolated lifecycle capability |
| ORM / Infrastructure Health | Technical operator | Read-only, redacted diagnostics |
| Security & Audit | Security auditor / authorized owner | Append-only audit read and permitted export |

These audience labels are design intent, not permission identifiers. Do not hardcode permission strings until ARSY publishes the canonical capability contract.

## Delivery sequence

1. Implement Workspace Settings read-only shell after workspace identity exists.
2. Implement Policy Center read/evaluation view with policy provenance.
3. Implement Marketplace Accounts with server-owned OAuth and secret vault.
4. Implement Security & Audit read-only view against the append-only audit source.
5. Implement AI Providers with write-only secrets and verification jobs.
6. Implement Addon Manager and Infrastructure Health only after isolation, diagnostics, and technical access contracts are approved.
