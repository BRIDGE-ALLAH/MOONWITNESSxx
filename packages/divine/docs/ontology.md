# Ontology Intelligence

Divine ontologies are versioned research views, not a universal taxonomy. Profiles are scoped by canonical Corpus references such as tradition, community, school, period, method or project. Two versions coexist; registration is immutable.

## Identity boundary
- Ontology-local concept IDs are not Corpus IDs.
- Each concept reference points to a canonical Corpus lexicon concept ID; Divine does not copy lexicon entries or mint replacements.
- Labels are not identity keys. Similar labels do not imply sameAs, exactMatch or equivalence.
- Relations declare domain, range, semantics and explanatory notes.

## Mapping governance
Mapping relations are exact, close, broader, narrower, partial, related, disputed or none. Candidate generation produces candidates only. Promotion to accepted/rejected/deprecated requires a method, evidence references and a reviewer. A mapping's scope is explicit and historical versions remain addressable.

## Change management
Ontology diffs identify concept/relation/mapping changes and impacted concepts. Deprecation plans require a reason, effective version and reviewers; redirects require a replacement concept.

## SKOS subset
The adapter exports labels resolved from canonical Corpus lexicon references, selected SKOS relations and accepted supported mappings. It omits candidate/disputed mappings and unsupported relation semantics, and returns a fidelity report. Imports return candidates only. This is not full SKOS/SHACL conformance and does not create a second source of truth.