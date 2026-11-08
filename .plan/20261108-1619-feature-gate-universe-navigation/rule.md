# Hard Rules: Apps Gate Universe Navigation

1. **NO FAKE HEALTH CLAIMS**: When querying operational experiences, indicators must accurately represent whether an experience is active, degraded, or target/planned.
2. **ZERO LINT/TYPE SUPPRESSION**: Do not disable typescript checks or eslint rules to force passes.
3. **PRESERVE ALL EXISTING CONTRACTS**: Respect the ports `3000` (Headquarter), `3001` (Gate), `3002` (Cockpit), and `4000` (ARSY).
4. **ACCESSIBILITY COMPLIANCE**: Ensure focus visible states, semantic headings, ARIA roles, and WCAG contrast conformance.
5. **ISOLATION & DETERMINISM**: Gate must remain operable independently without hard runtime crashes if sibling apps are offline.
