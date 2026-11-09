# Headquarter tests

Run the focused Node.js test suite from the repository root:

```sh
pnpm --filter @riotworks/headquarter test
```

The suite uses Node 24's built-in test runner and native TypeScript type stripping; it adds no runtime or test-framework dependency.

- `arsy-client.test.mjs` verifies request defaults, request IDs, GET-only transient retries, mutation retry prohibition, safe gateway error normalization, and timeout behavior.
- `arsy-deck.test.mjs` verifies that the reference fixture remains explicitly synthetic, internally consistent, and uses sample-only lifecycle values.
- `decision-graph.test.mjs` verifies provenance, traceability, expiry, confidence, and graph-reference integrity.
- `scenario-forge.test.mjs` verifies deterministic shadow replay, baseline immutability, and fail-closed validation.
- `governance-kernel.test.mjs` verifies SHA-256 capsule integrity/replay, tamper detection, Decision Debt findings and downstream impact, and human-only uncertainty gate states.

## Real browser E2E

`money-maker-workspace.browser.e2e.mjs` is deliberately excluded from the fast unit-test glob. It is run by [Money Maker PostgreSQL Browser E2E](../../../.github/workflows/money-maker-e2e.yml), which:

- starts an isolated PostgreSQL 17 service and applies the complete ARSY migration set twice;
- starts the actual ARSY API and Headquarter Next.js application with ephemeral CI-only operator credentials;
- uses pinned Playwright 1.65.0 with Chromium, without replacing the Headquarter-to-ARSY path with a mock;
- signs in, creates an evidence-backed opportunity, reloads the browser page to prove read-after-reload persistence, archives it, and queries PostgreSQL to verify the durable row and create/archive audit events.

The E2E writes only synthetic records to the disposable CI database. Its source URL and evidence summary are explicit fixtures, not market research. It does not contact marketplace providers, publish listings, or move money.

The existing unit suite still does not replace browser accessibility/visual regression or a production deployment smoke test. Those remain separate acceptance gates.
