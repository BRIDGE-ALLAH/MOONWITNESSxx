# Headquarter tests

Run the focused Node.js test suite from the repository root:

```sh
pnpm --filter @riotworks/headquarter test
```

The suite uses Node 24's built-in test runner and native TypeScript type stripping; it adds no runtime or test-framework dependency.

- `arsy-client.test.mjs` verifies request defaults, request IDs, GET-only transient retries, mutation retry prohibition, safe gateway error normalization, and timeout behavior.
- `opportunity-proxy.test.mjs` and `opportunity-record-proxy.test.mjs` verify operator session requirements, same-origin mutation checks, identifier validation, and server-only ARSY credentials.
- `product-lifecycle-proxy.test.mjs` verifies the lifecycle BFF rejects invalid IDs, anonymous requests, and cross-origin mutation before forwarding; authenticated transitions preserve payload and service credential.
- `arsy-deck.test.mjs` verifies that the reference fixture remains explicitly synthetic, internally consistent, and uses sample-only lifecycle values.
- `decision-graph.test.mjs` verifies provenance, traceability, expiry, confidence, and graph-reference integrity.
- `scenario-forge.test.mjs` verifies deterministic shadow replay, baseline immutability, and fail-closed validation.
- `governance-kernel.test.mjs` verifies SHA-256 capsule integrity/replay, tamper detection, Decision Debt findings and downstream impact, and human-only uncertainty gate states.

## Browser E2E

The focused browser workflow is defined in `.github/workflows/headquarter-e2e.yml`. It installs a pinned Playwright browser runner in the CI temporary directory (not the workspace dependency graph), starts isolated PostgreSQL, ARSY, and Headquarter services, then verifies:

- operator login and the authenticated RIOT RADAR route;
- creation of an opportunity with explicit score rationales and all hard gates set as clearly synthetic CI fixtures;
- persistence after a full browser reload;
- creation of a product brief in THE FORGE and an authenticated lifecycle transition through the Headquarter BFF;
- four append-only rights, policy, technical, and creative inspections, with the product reaching READY; and
- anonymous visitors cannot read the persisted opportunity.

Run it in GitHub Actions with the `Headquarter browser E2E` workflow. The test uses synthetic evidence and gate records in an ephemeral CI database. It does not claim external market validation, licensing, provider eligibility, marketplace publication, accessibility conformance, or visual regression coverage.
