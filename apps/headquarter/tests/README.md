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

## Browser E2E

The focused browser workflow is defined in `.github/workflows/headquarter-e2e.yml`. It installs a pinned Playwright browser runner into the CI temporary directory (not the workspace dependency graph), starts isolated PostgreSQL, ARSY, and Headquarter services, then verifies:

- operator login and the authenticated RIOT RADAR route;
- creation of a source-labeled opportunity through the actual browser form and Headquarter BFF;
- persistence after a full browser reload; and
- anonymous visitors cannot read the persisted opportunity.

Run it in GitHub Actions with the `Headquarter browser E2E` workflow. The test uses clearly labeled synthetic records in an ephemeral CI database. It does not claim that every browser workflow, marketplace integration, accessibility scenario, or visual regression path is covered.
