# MoonWitness Corpus migration runbook

**Status:** prepared; full import is blocked by source repository permissions.

## Verified source state (2026-11-08)
- Source: https://github.com/bjo163/moonwitness-corpus (default branch `main`, owner `bjo163`).
- Connected GitHub permission: read-only (`push=false`).
- Repository size metadata: 43,764 KB.
- Source tree: 5,278 entries, 4,757 files and 521 directories.
- Core package: `@moonwitness/corpus-core@0.1.0`.
- Specification: `spec/v0.1`, explicitly Draft / unstable.
- Canonical data includes JSON/JSONL datasets and profiles. Generated SQLite/search artifacts must be identified separately.

## Decision: import, do not recreate
Do not recreate Corpus, copy only a convenient subset, or use a submodule if the source repository is to close. Import the complete source repository and its Git history as a Git subtree at `corpus/` in MOONWITNESS. Keep original paths intact. Do not rewrite canonical IDs or source JSON/JSONL content during relocation. Add a separate migration manifest recording source URL, exact source HEAD, import date, import commit, file inventory/hash results and any exclusions.

## Required owner/admin actions
1. Source owner grants push/admin access or executes the import from an authorized machine.
2. Freeze source writes and record exact source HEAD; create an archival tag/release.
3. Verify license/rights, secrets, Git LFS objects, dataset manifests and generated artifacts.
4. Import the complete repository with history (no squash on first import).
5. Compare source/imported file inventory and hashes; run Corpus checks from a clean checkout.
6. Switch Divine's Corpus reader to the in-repo provider only after verification.
7. Keep source archived/read-only through a retention window. Delete only after an independently approved backup and verification checkpoint.

## Authorized import commands
```bash
git remote add moonwitness-corpus https://github.com/bjo163/moonwitness-corpus.git
git fetch moonwitness-corpus --tags
git rev-parse moonwitness-corpus/main
git subtree add --prefix=corpus moonwitness-corpus main
```
Do not use `--squash` for the initial archival import.

## Post-import verification
Record and compare source HEAD, imported subtree commit, file counts, content hashes, rights metadata and CI results. Run the Corpus repository's documented `pnpm check`/validation workflow. Migration is not complete until all evidence is recorded in a migration manifest and the adapter is tested against the imported release.

## Why not plain copy?
A plain copy loses commit history, blame, tags and upstream provenance. A subtree consolidates the repository while preserving its history. A submodule still depends on the separate repository and fails the closure objective.

## Current blocker
The connected identity can push to `BRIDGE-ALLAH/MOONWITNESS` but cannot push to `bjo163/moonwitness-corpus`. No change, archive or deletion was attempted on the source repository. The source owner must participate.