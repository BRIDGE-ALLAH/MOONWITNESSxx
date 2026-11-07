# 08 — Technical Architecture

**Status:** Approved target architecture; implementation choices may be refined during engineering  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Architecture goals

- Modular, maintainable, and testable.
- Local-first friendly with optional cloud services.
- Provider-agnostic AI model access.
- Marketplace adapters isolated from domain logic.
- Traceable asset provenance and financial events.
- Background processing for generation and batch jobs.
- Strong permission, audit, and cost controls.
- No frontend access to marketplace secrets.

## 2. Logical layers

1. **Experience layer:** web app, responsive interface, design system.
2. **Application layer:** use cases, commands, queries, approval flows.
3. **Domain layer:** opportunities, products, assets, channels, listings, revenue, policies, workflow runs.
4. **Intelligence layer:** retrieval, evidence evaluation, scoring, agent orchestration.
5. **Production layer:** image, video, document, spreadsheet, game/workflow asset providers.
6. **Integration layer:** marketplace adapters, official APIs, manual package exporters.
7. **Infrastructure layer:** PostgreSQL, object storage, queue, secrets, telemetry, scheduler.

## 3. Suggested initial stack

This is a recommendation, not a reason to over-engineer the prototype.

| Concern | Candidate |
|---|---|
| Web application | Next.js, React, TypeScript |
| Backend API | Fastify / TypeScript |
| Database | PostgreSQL |
| Job queue | Redis-backed queue or PostgreSQL-backed job pattern, selected after workload validation |
| Object storage | S3-compatible storage |
| Workflow automation | n8n as an optional external/private workflow tool, or native jobs |
| Local image generation | ComfyUI through a controlled adapter |
| AI providers | Provider abstraction for local and cloud models |
| Search | PostgreSQL full-text first; separate search engine only when needed |
| Deployment | Docker Compose; optional Coolify-managed deployment |
| Observability | Structured logs, job traces, metrics, error reporting |

Do not assume n8n can be embedded, white-labeled, or resold as part of RIOTWORKS. Review its current Sustainable Use License and obtain appropriate licensing for any restricted commercial use. Keep domain logic independent from n8n.

## 4. Service boundaries

### Web App
Owns user interaction, navigation, forms, dashboards, and client-side state. Never stores provider secrets or performs privileged external mutations directly.

### API / Application Service
Authenticates users, authorizes actions, validates payloads, executes use cases, and returns stable domain responses.

### Domain Modules
- Workspace and identity.
- Market intelligence.
- Opportunity management.
- Product and production.
- Asset and provenance.
- QA and compliance.
- Channel registry.
- Publishing.
- Finance and payout.
- Analytics and portfolio.
- Workflow and agent operations.

### Worker Runtime
Processes generation, conversion, metadata preparation, QA, scheduled research, permitted API actions, and reconciliation.

### Provider Adapters
Wrap models, media tools, marketplaces, payout data sources, and storage. Each adapter declares capabilities, scopes, rate limits, and failure modes.

## 5. Marketplace adapter contract

Every adapter must declare:
- Provider ID and version.
- Supported countries / account states.
- Supported actions: read, prepare, create, update, publish, analytics.
- Official API/documentation URL.
- Required scopes.
- Rate limits and quotas.
- Product/file constraints.
- AI disclosure requirements.
- Known limitations.
- Capability level C0-C4.
- Test fixtures and health checks.
- Manual fallback.

An adapter cannot claim write support merely because browser automation is technically possible.

## 6. AI architecture

Use a provider interface with:
- Model capability declaration.
- Context and token limits.
- Structured output support.
- Cost estimate and actual usage.
- Timeout and retry policy.
- Data handling classification.
- Version and prompt provenance.
- Evaluation and fallback behavior.

Use local models for appropriate routine work, and cloud models only when their benefit justifies cost and data exposure. Do not hardcode a single vendor.

## 7. Data and event flow

- Store metadata and relational business records in PostgreSQL.
- Store binaries and generated files in object storage.
- Use immutable artifact versions with checksums.
- Use a queue for long-running tasks.
- Emit domain events for product, publication, and financial lifecycle changes.
- Preserve external IDs and source receipts.
- Make ingestion jobs idempotent.
- Keep an append-only audit trail for material operations.

## 8. Security boundaries

- OAuth/API tokens are server-side secrets.
- Encrypt stored credentials and restrict access by integration.
- Redact secrets and personal data from logs.
- Apply least privilege and per-action authorization.
- Separate demo data from production data.
- Isolate untrusted documents, listing descriptions, prompts, and imported content from system instructions.
- Validate uploaded files and process them in constrained workers.
- Protect internal APIs against CSRF, SSRF, injection, path traversal, and privilege escalation.
- Back up database and asset metadata; test restore.

## 9. Prototype boundary

The v0 prototype is frontend-only with synthetic data. The production architecture must not be inferred from prototype mock state. No real OAuth, payment, API keys, generation worker, or publication capability is part of the first UI prototype.
