#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPO="https://github.com/bjo163/moonwitness-corpus.git"
SOURCE_REMOTE="moonwitness-corpus"
SOURCE_HEAD="$(printenv CORPUS_SOURCE_HEAD || true)"
RIGHTS_APPROVED="$(printenv CORPUS_RIGHTS_APPROVED || true)"
MANIFEST="docs/migrations/corpus-subtree-import.md"

if [[ "$RIGHTS_APPROVED" != "true" ]]; then
  echo "Refusing import: set CORPUS_RIGHTS_APPROVED=true only after the rights inventory is approved." >&2
  exit 2
fi
if [[ ! "$SOURCE_HEAD" =~ ^[0-9a-f]{40}$ ]]; then
  echo "CORPUS_SOURCE_HEAD must be an exact 40-character commit SHA." >&2
  exit 2
fi
if [[ -e corpus ]]; then
  echo "Refusing import: ./corpus already exists." >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing import: working tree must be clean." >&2
  exit 2
fi

if git remote get-url "$SOURCE_REMOTE" >/dev/null 2>&1; then
  git remote set-url "$SOURCE_REMOTE" "$SOURCE_REPO"
else
  git remote add "$SOURCE_REMOTE" "$SOURCE_REPO"
fi
git fetch --tags "$SOURCE_REMOTE"
ACTUAL_HEAD="$(git rev-parse "$SOURCE_REMOTE/main")"
if [[ "$ACTUAL_HEAD" != "$SOURCE_HEAD" ]]; then
  echo "Source moved: expected $SOURCE_HEAD but fetched $ACTUAL_HEAD. Review the new source and rights inventory." >&2
  exit 3
fi

git subtree add --prefix=corpus "$SOURCE_REMOTE" "$SOURCE_HEAD"
SOURCE_TREE="$(git rev-parse "$SOURCE_HEAD^{tree}")"
IMPORTED_TREE="$(git rev-parse "HEAD:corpus")"
if [[ "$SOURCE_TREE" != "$IMPORTED_TREE" ]]; then
  echo "Subtree root tree mismatch: source=$SOURCE_TREE imported=$IMPORTED_TREE" >&2
  exit 4
fi
FILE_COUNT="$(git ls-tree -r --name-only "$SOURCE_HEAD" | wc -l | tr -d " ")"
mkdir -p "$(dirname "$MANIFEST")"
cat > "$MANIFEST" <<EOF
# Corpus subtree import

- Source repository: $SOURCE_REPO
- Source branch: main
- Exact source HEAD: $SOURCE_HEAD
- Import mode: full-history Git subtree
- Destination: corpus/
- Source root tree: $SOURCE_TREE
- Imported root tree: $IMPORTED_TREE
- File count: $FILE_COUNT
- Rights approval: explicitly attested by the operator invoking this script
- Verification: root tree SHA and complete Git blob inventory match the pinned source commit; run Corpus validation before merge
- Safety: do not archive/delete the source until verification and backup are independently approved
EOF
git add "$MANIFEST"
git commit -m "docs(corpus): record pinned subtree source and rights attestation"
echo "Corpus subtree imported at source HEAD $SOURCE_HEAD."
echo "Next: verify inventory, hashes, rights, and Corpus checks before closing the source repository."
