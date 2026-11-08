# Hard Rules for COCKPIT Implementation

1. **Isolation First:** Keep all files strictly inside `apps/cockpit/`. Do not modify existing apps (`headquarter`, `arsy`, `oracle`, `gate`) or shared packages (`packages/ui`, `packages/policy`).
2. **Architecture Conformity:** Respect the role of COCKPIT defined in `docs/32-universe-and-product-architecture-registry.md` as: _"Real-time NOC and infrastructure operations, dispatch, telemetry, and operator actions"_. Do not collapse strategic governance into COCKPIT.
3. **Multiplatform Desktop & Web Stack:** The frontend is React/Next/Vite with Tailwind + `@riotworks/ui` tokens. The desktop runtime backend is powered by Rust (`src-tauri` / Cargo).
4. **No Secrets / Keys Stored:** Do not embed private credentials, production certificates, or hardcoded tokens in source code.
5. **Quality Gate:** Automated contract verification must be included under `apps/cockpit/tests/`.
