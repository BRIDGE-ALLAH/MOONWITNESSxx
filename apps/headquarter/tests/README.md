# Headquarter tests

Run the focused Node.js test suite from the repository root:

```sh
pnpm --filter @riotworks/headquarter test
```

The suite uses Node 24's built-in test runner and native TypeScript type stripping; it adds no runtime or test-framework dependency.

- `arsy-client.test.mjs` verifies request defaults, request IDs, GET-only transient retries, mutation retry prohibition, safe gateway error normalization, and timeout behavior.
- `arsy-deck.test.mjs` verifies that the reference fixture remains explicitly synthetic, internally consistent, and uses sample-only lifecycle values.

These tests do not replace browser E2E, accessibility, visual regression, or backend contract tests. Those require a browser harness and approved ARSY identity/workspace/permission/API contracts.
