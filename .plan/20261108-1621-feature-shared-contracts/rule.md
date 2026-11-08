# Hard Rules: Shared Contracts

1. **NO ANY**: All contracts must be strictly validated with Zod schemas.
2. **FAIL CLOSED**: Invalid incoming payloads must fail parsing rather than silently coercing into invalid states.
3. **ZERO UNTESTED SCHEMAS**: Every schema defined in `@riotworks/contract` must have roundtrip validation tests.
4. **COMPATIBILITY**: Schemas must match the runtime JSON payloads emitted by Rust backend in `apps/cockpit/src-tauri` and Fastify routes in `apps/arsy`.
