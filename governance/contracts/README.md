# Governance Contract Standard

Every contract has one accountable owner and one canonical source.

| Field               | Required content                                      |
| ------------------- | ----------------------------------------------------- |
| Owner               | One accountable role/system owner                     |
| Scope               | Paths, components, and lifecycle covered              |
| Rules               | Normative, testable requirements                      |
| Allowed / Forbidden | Supported paths and prohibited shortcuts              |
| Enforcement         | Advisory, local, CI, repository, or operational       |
| Acceptance evidence | Tests, commands, CI, or administrator readback        |
| Exceptions          | Approver, reason, scope, expiry, compensating control |

Use MUST/MUST NOT for hard invariants, SHOULD/SHOULD NOT for defaults, and MAY for optional behavior. Cross-reference instead of copying. Prefer executable checks for objective facts and human review for architecture intent. Do not introduce schema files as a substitute for programmatic checks. Required checks fail closed and must not silently mutate source, versions, dependencies, issue state, or production state.

Contract changes require rationale, affected owners, compatibility impact, acceptance evidence, and a recovery/exception path.
