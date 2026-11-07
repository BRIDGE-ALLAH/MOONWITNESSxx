undefined

## Phase 18–20 hardening update (2026-11-08)
- [x] Phase 18: reject malformed/blank capability context and fail closed on verifier outages.
- [x] Phase 19: enforce approval-after-allow ordering, reject duplicate approvals, bind trace digest to contract identity and prevent pre-trace attestation issuance.
- [x] Phase 20: detect empty traces, malformed context, duplicate policy decisions and cross-tenant terminal receipts; mark undefined benchmark metrics as null rather than perfect.
- [ ] Authenticated issuer registry, signed attestation envelope/KMS, actual tool-gateway enforcement, licensed benchmark import and calibrated CI thresholds remain open.
See `docs/30-arsy-phases-18-20-hardening.md`. These are deterministic contract checks, not production security enforcement.
