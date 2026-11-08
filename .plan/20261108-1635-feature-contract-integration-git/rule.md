# Hard Rules: Contract Integration & Commits

1. **NO REGRESSIONS**: All existing 44 tests in `apps/cockpit` and 5 tests in `packages/contract` must continue to pass 100%.
2. **ZERO TS/LINT SUPPRESSION**: No `@ts-ignore` or lint disabling.
3. **ATOMIC COMMITS**: Group changes logically into conventional commits. Never sweep unrelated files together.
4. **NO BREAKING CHANGES**: Maintain exact runtime payload shapes between Rust IPC and frontend.
