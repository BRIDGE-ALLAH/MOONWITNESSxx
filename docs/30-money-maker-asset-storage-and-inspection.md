# Money Maker Asset Storage, Provenance & Inspection

## Purpose

An ARSY Asset is a version-bound binary artifact, not a product brief and not proof of publication. The asset workflow stores the original bytes, computes a server-side SHA-256 digest, preserves provenance, and appends inspection records. Headquarter never renders uploaded bytes inline; downloads are private attachments with `X-Content-Type-Options: nosniff`.

## Data ownership

- Every asset belongs to one `owner_id` and one existing `product_id + product_version`.
- A composite owner/product foreign key prevents attaching an asset to another operator's product.
- A version foreign key prevents linking to a nonexistent product version.
- Provenance is one-to-one with the asset. Source-asset references are constrained to the same owner.
- Inspection history is append-only. A new inspection never overwrites an earlier decision.
- Every upload and inspection writes a commerce audit event.

## Storage adapter contract

The application depends on the `AssetStorage` interface:

- `put(key, bytes)`: create a new object without overwriting an existing key.
- `get(key)`: return the exact stored bytes.
- `delete(key)`: remove an object for compensating cleanup.

The current implementation is `LocalAssetStorage`. It uses random UUID storage keys, rejects path traversal, creates private directories/files, and writes with exclusive-create semantics. The route reads the stored object back and compares byte length and SHA-256 before inserting database metadata. A failed storage write or checksum check leaves no asset metadata.

A future S3-compatible adapter must implement the same interface and must additionally document:
- private bucket/object ACLs and encryption at rest;
- TLS-only access, server-side credentials and least-privilege bucket scope;
- checksum verification on upload and retrieval;
- retention/versioning and deletion semantics;
- lifecycle/backup/restore behavior;
- no public object URLs or client-side credentials.

Do not add an object-storage SDK/provider until a provider, region/endpoint, bucket, credentials model and retention policy are deliberately selected. Unknown drivers fail closed.

## Environment and Docker Compose

Development:
- `ASSET_STORAGE_DRIVER=local`
- `ASSET_STORAGE_PATH=./.data/arsy-assets`

Single-node Compose:
- `ASSET_STORAGE_DRIVER=local`
- `ASSET_STORAGE_PATH=/var/lib/arsy/assets`
- Compose mounts the named `arsy_assets_data` volume at that path.

The volume is persistent across container replacement but is not a backup. Back up the asset volume and PostgreSQL database together, test restore, and retain the same owner/product/version records. A database restore without the matching asset volume can leave metadata whose bytes return `ASSET_BYTES_MISSING`.

Production startup fails if the local storage path is absent. A non-local driver fails closed until an approved adapter is implemented.

## Upload contract

- Authenticated operator token is mandatory.
- Product ID and product version must exist under the current operator.
- Required idempotency key is scoped to the operator. Identical retries replay the original asset; reusing a key with different bytes or provenance returns conflict.
- Maximum upload is 10 MiB.
- Accepted types: PNG, JPEG, WebP, PDF, plain UTF-8 text and ZIP.
- File signatures are checked against the declared type. SVG, HTML, executables and unknown media are rejected.
- SHA-256 is computed by ARSY; clients cannot submit an authoritative digest.
- Storage key and internal path are never returned to Headquarter.
- Download is an authenticated attachment with private/no-store caching and `nosniff`.

## Provenance

Every upload requires:
- creator/owner;
- exact license or original-work statement;
- permission basis;
- disclosure statement;
- optional source asset/reference;
- optional tool/model;
- edit-history entries.

A missing license is not treated as permission. Uploading an asset does not certify rights ownership.

## Inspections and channel readiness

Inspection types:
- `rights`
- `policy`
- `technical-qa`
- `creative-qa`

Each record stores status (`pass`, `blocked`, `unknown`), declared source (`operator-attestation`, `automated-check`, `independent-review`), rationale, findings, evidence, actor and timestamp.

Source qualification for readiness:
- rights: independent-review;
- policy: independent-review;
- technical QA: automated-check or independent-review;
- creative QA: independent-review.

All four latest statuses must be pass and each declared source must meet its qualification. An operator attestation is retained as evidence of what the operator asserted, but does not satisfy independent rights/policy/creative verification. The source label is recorded provenance; ARSY does not authenticate an external reviewer's identity. Channel publication remains blocked until that trust boundary is independently established.

## Non-goals

- No public CDN or unauthenticated asset URLs.
- No automatic publication or marketplace upload.
- No inferred license clearance.
- No fabricated inspection results or sample assets in production.
- No asset deletion or historical provenance rewrite through the current API.
