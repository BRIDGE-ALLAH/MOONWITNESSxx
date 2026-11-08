# MoonWitness Corpus migration runbook

**Decision:** consolidate Corpus inside MOONWITNESS using a Git subtree, not a plain file copy and not a submodule. The exact import scope is subject to dataset-rights review.

## Verified source state (2026-11-08)
- Source: https://github.com/bjo163/moonwitness-corpus (default branch `main`).
- Source HEAD inspected: `534a21893728de64b5f28f27ea600e8609d7b8c4`.
- Connected GitHub permission is read-only. This is sufficient to fetch a public repository and its Git history; **source write access is not required for subtree import**.
- Repository metadata size: approximately 43,764 KB; recursive tree: 5,278 entries (4,757 files and 521 directories).
- Core package: `@moonwitness/corpus-core@0.1.0`.
- Specification: `spec/v0.1`, Draft / unstable.
- Canonical data includes core JSON/JSONL records and profile datasets for textual, manuscript, variants, lineage, lexicon, contextual, bibliographic, media, scholarly, source and other domains.
- The source README explicitly states that there is no single repository-wide license. Individual datasets and third-party artifacts may have different rights; public GitHub visibility is not permission to redistribute.

## Non-negotiable rights gate
MOONWITNESS is public. Do not blindly subtree-import and republish every dataset artifact until the rights inventory is complete.

1. Preserve Corpus code, schemas, specifications, documentation, original metadata, manifests, source references and license notices.
2. Import dataset content only where the exact license/permission allows redistribution into this public repository.
3. For unclear/restricted content, preserve the manifest, canonical identifiers where lawful, source URI, checksum and rights metadata, but exclude the protected payload. Never replace an excluded payload with a generated approximation.
4. Record every included/excluded path and reason in a migration manifest. Keep source HEAD and content hashes so excluded records remain traceable.
5. If rights are later clarified, add the corresponding dataset through a separately reviewed import.

A full unfiltered subtree is allowed only after every included artifact is rights-cleared for this destination.

## Preferred import: full-history subtree (after rights approval)

A guarded importer is included at `scripts/migrate-corpus-subtree.sh`. The manual workflow `.github/workflows/corpus-subtree-migration.yml` asks for an exact source SHA and a separate `rights_approved=true` attestation, then pushes an import branch for review; it never merges directly to `main`. The script verifies that the imported subtree root tree SHA exactly matches the pinned source tree before recording the migration manifest.
Run from a clean MOONWITNESS checkout. Read access to the public source is sufficient:

```bash
git remote add moonwitness-corpus https://github.com/bjo163/moonwitness-corpus.git
git fetch moonwitness-corpus --tags
SOURCE_HEAD=$(git rev-parse moonwitness-corpus/main)
printf 'Corpus source HEAD: %s\n' "$SOURCE_HEAD"
git subtree add --prefix=corpus moonwitness-corpus main
```

Do not use `--squash` if preserving source commit history is part of the approved migration. If a rights-filtered import is required, filter the source history before subtree integration and record that the history is intentionally filtered; do not leave restricted payloads reachable in earlier imported commits.

## Verification and closure sequence
1. Freeze source writes with the source owner and record the exact source HEAD.
2. Inventory every dataset manifest, license file, source artifact, LFS object and rights restriction.
3. Approve the full or filtered import scope.
4. Import the source history/snapshot into `corpus/`.
5. Compare included file inventory and SHA-256 hashes against the approved source scope.
6. Run Corpus validation from a clean checkout; verify deterministic IDs, referential integrity, profiles and dataset dependencies.
7. Update Divine's read-only adapter to the in-repo Corpus provider only after release/spec compatibility is proven.
8. Preserve an archival tag/release and backup. Prefer **archiving** the old repository over deleting it.
9. Only the source owner/admin may archive or delete the source repository. Keep it available read-only until the retention and recovery checkpoint passes.

## Migration manifest requirements
The final manifest must record:
- source URL, branch and exact source HEAD;
- import mode (full-history or rights-filtered);
- destination commit and subtree path;
- source file count and included/excluded counts;
- per-file or per-dataset SHA-256 checks for imported payloads;
- rights/license evidence and exclusion reasons;
- Corpus validation commands/results;
- backup/archive location and approval.

## Current blocker
The read-only source permission is **not** a blocker for fetching/importing. The blocker is that the source repository has no repository-wide license and explicitly warns against redistributing third-party text, translations, scans, audio and datasets without permission. The rights-cleared import scope must be established before copying those payloads into the public MOONWITNESS repository. Source archive/delete actions also require owner/admin permission.

## Why not a plain copy or submodule?
- Plain copy loses source history, tags, blame and commit-level provenance.
- Submodule keeps the separate repository as a dependency and does not meet the consolidation/closure objective.
- Subtree embeds the approved source history under one path and keeps the downstream repository self-contained.
