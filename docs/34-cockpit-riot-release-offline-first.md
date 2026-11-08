# 34 — COCKPIT RIOT RELEASE: Offline-First Architecture & Delivery

**Status:** Offline release core plus local Build Deck and Artifact Vault implemented on a feature branch; exact-head CI and desktop build verification required before merge.  
**Owner:** COCKPIT desktop application, \`apps/cockpit\`  
**Runtime:** Tauri 2 + Rust; existing Next.js static-export and React UI retained.  
**Product boundary:** RIOT RELEASE is a workspace inside COCKPIT, not a standalone product and not a Headquarter module.

## 1. Product contract

RIOT RELEASE manages the local software-release lifecycle without requiring an account, cloud service, ARSY, or remote Git provider. Repository inspection, draft management, tagging, build history, and the artifact vault work against local files.

The local workflow is:

1. Register an existing Git working directory. COCKPIT does not clone, move, or take ownership of source files.
2. Inspect branch, HEAD, working-tree cleanliness, origin URL, nearest reachable tag, and recent commits.
3. Generate an editable Markdown changelog from local commit subjects.
4. Save release drafts and history under the COCKPIT application-data directory.
5. After explicit operator confirmation, create a SemVer-validated annotated Git tag in the local repository.
6. Detect a small set of known local build profiles from project manifests. Display the exact executable and arguments, require explicit confirmation, then run with a fixed timeout.
7. Discover output files under known build directories and copy selected regular files into the local Artifact Vault with SHA-256 verification.
8. Export release notes as Markdown.

The local Git working tree and filesystem are the source of operational truth. Remote URLs are inspected as local Git configuration only; no provider API is called by this workflow.

## 2. Ownership boundaries

| Capability | Owner | RIOT RELEASE rule |
| --- | --- | --- |
| Local Git read/write | COCKPIT Rust runtime | Invoke Git with argument arrays; never interpolate user input into a shell |
| Repository catalog | COCKPIT local app-data store | Store canonical paths and display metadata only |
| Drafts/history | COCKPIT local app-data store | Local convenience metadata; Git tags remain authoritative |
| Build profile detection | COCKPIT Rust runtime | Allowlisted Cargo, package.json build script, and .NET profiles only |
| Local build execution | COCKPIT Rust runtime | Direct executable + fixed argument arrays, operator confirmation, 15-minute timeout, bounded logs |
| Artifact discovery/import | COCKPIT Rust runtime | Known output directories only; skip symlinks; bounded traversal and size |
| Artifact Vault | COCKPIT local app-data store | Copy selected files; persist size and SHA-256 |
| Provider credentials | OS keychain, future online adapter | Never store credentials in local JSON or browser storage |
| Remote publication/mirroring | Optional provider adapter, future | No push, tag deletion, release publication, or mirroring in the offline core |
| Cloud build / remote artifact storage | Separate optional capability | Not part of the local Build Deck |
| Authentication, policy, central audit | Not required for local operations | No ARSY or cloud dependency for basic release tasks |

## 3. Safety invariants

- Only an existing Git working tree can be registered.
- Removing a repository removes only its COCKPIT registry entry; it never deletes the directory.
- User-controlled paths, versions, and notes are passed as process arguments, not shell source.
- Versions are validated as SemVer and normalized to a v-prefixed tag.
- Local tag creation requires a clean working tree and refuses an existing tag.
- Tag creation and build execution each require an explicit second-step operator confirmation.
- Build profiles are detected from repository manifests. The frontend cannot submit an arbitrary executable or argument list.
- Build scripts are project-controlled code. Cargo build scripts, package manager lifecycle scripts, and MSBuild targets may execute; the UI displays this trust boundary before the build starts.
- The release core itself needs no network. Project build scripts or package tools may access a network according to their own configuration and behavior.
- Build execution has a 15-minute timeout, null stdin, and bounded captured output. The child process is configured to terminate on cancellation/timeout.
- Artifact discovery skips symbolic links, dependency/cache folders, and files above the 2 GiB import limit. Traversal is depth- and count-bounded.
- Artifact imports must resolve inside a known build output directory. SHA-256 and size are checked again after the file is copied into the vault.
- Provider APIs are not contacted. An origin URL does not prove that a remote is online or authenticated.
- Drafts, history, build records, vault metadata, and copied artifacts stay in the operating-system application-data directory; secrets are not stored there.

## 4. Current implementation and known limits

Implemented:

- Rust Tauri commands for local repository registration/list/removal, Git status and commit preview, changelog generation, draft persistence, draft/history retrieval, and annotated tag creation.
- React route \`/release\`, linked from the COCKPIT operations flight deck.
- Manifest-derived Build Deck profiles for Cargo release builds, package.json build scripts (pnpm/yarn/bun/npm based on lockfiles), and .NET publish.
- Local build history with timeout state, exit code, and bounded stdout/stderr.
- Artifact candidate discovery, path validation, local vault copy, and SHA-256 digest verification.
- Rust unit tests and frontend contract tests.
- Windows CI compiles the Tauri runtime and runs Rust tests; repository CI validates the full workspace.

Not included yet:

- Native folder-picker UX; repository registration and artifact selection currently use local filesystem paths.
- Go, Python packaging, arbitrary Makefile, custom command, or user-defined shell profiles.
- Artifact archive packaging, signing, SBOM generation, provenance attestations, reproducible-build evidence, and retention cleanup.
- GitHub/GitLab authentication, API publication, mirroring, provider quota monitoring, and upload retry queues.
- Embedded Git implementation; local repository operations require Git CLI installed and available on PATH.
- Cross-device sync or cloud backup.

The Tauri desktop build and exact-head CI must pass before merge. This document does not claim COCKPIT or RIOT RELEASE is production-complete.

## 5. Deferred extension order

1. Native directory picker and clearer Git installation diagnostics.
2. Artifact archive packaging, checksums for archive bundles, signing, SBOM/provenance, and reproducible-build evidence.
3. Optional GitHub/GitLab provider adapters using OS-keychain credentials and explicit publication confirmation.
4. Optional mirror/backup workflows with conflict detection and visible sync state.
5. Retention management and export/import of the local release workspace.

## 6. Acceptance for this delivery

- COCKPIT remains usable without internet; local Git/release/vault operations make no network calls.
- A valid local Git repository can be registered and inspected.
- Changelog notes can be edited, saved locally, and exported.
- A clean repository can receive a new annotated SemVer tag after confirmation.
- Dirty repositories and duplicate tags are blocked.
- Build profiles are detected only from known project manifests and require explicit confirmation.
- Build execution is bounded by a timeout and stores local history and truncated logs.
- Only regular files beneath allowlisted build output paths can be imported into the vault.
- SHA-256 is visible and verified after the vault copy.
- No remote mutation or artifact upload is available through these local commands.
- Exact-head CI and Tauri desktop build evidence are recorded before merge.
