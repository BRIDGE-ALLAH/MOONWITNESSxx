# Divine architecture decisions

Status: Phase 0 baseline; accepted for implementation.

| ADR | Decision |
|---|---|
| ADR-0001 | Purpose, non-goals and conceptual inspiration boundary |
| ADR-0002 | Corpus remains canonical owner; Divine only projects |
| ADR-0003 | Plural ontology and scoped theological claims |
| ADR-0004 | Open-world epistemic states and abstention |
| ADR-0005 | Explainable defeasible reasoning and standards interop |
| ADR-0006 | Package naming, addon DAG and adapter ports |

Dependency direction: platform contracts (when implemented) -> Divine ports/adapters -> downstream applications. Divine must not import Headquarter internals. ORM, ARSY, ZILL and MIZAN are not assumed to exist.

Readiness: Phase 0 ADR baseline, Phase 1 pure TypeScript core, Phase 2 read-only Corpus adapter are implemented. No persistence, production runtime integration, access-control integration or full Corpus monorepo migration is claimed.