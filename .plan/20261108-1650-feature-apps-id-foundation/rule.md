# Hard Rules: Apps ID Authentication Authority

1. **NO HARDCODED SECRETS**: Secrets must come from validated environment configs or generate secure ephemeral defaults with warnings in non-production.
2. **TIMING-SAFE COMPARISONS**: All credential and token verifications must use constant-time comparison (`crypto.timingSafeEqual`).
3. **FAIL CLOSED**: Invalid tokens, tampered signatures, or expired claims must strictly reject with HTTP 401.
4. **NO ANY / ZERO LINT SUPPRESSION**: Full TypeScript strictness with zero compiler warnings.
5. **CONSISTENT MONOREPO PACKAGING**: Consume `@riotworks/ui`, `@riotworks/assets`, and `@riotworks/contract`.
