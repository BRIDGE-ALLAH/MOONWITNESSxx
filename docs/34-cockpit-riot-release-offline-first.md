# 34 — COCKPIT RIOT RELEASE: Offline-First Architecture & Delivery

**Status:** Initial local release workflow implemented on a feature branch; exact-head CI and desktop build verification remain required before merge.  
**Owner:** COCKPIT desktop application, apps/cockpit  
**Runtime:** Tauri 2 + Rust; existing Next.js static-export and React UI retained.  
**Product boundary:** RIOT RELEASE is a workspace inside COCKPIT, not a standalone product and not a Headquarter module.

## 1. Product contract

RIOT RELEASE manages the local software-release lifecycle without requiring an account, internet connection, cloud service, ARSY, or remote Git provider.

The local workflow is:

1. Register an existing Git working directory. COCKPIT does not clone, move, or take ownership of source files.
2. Inspect branch, HEAD, working-tree cleanliness, origin URL, nearest reachable tag, and recent commits.
3. Generate an editable Markdown changelog from local commit subjects.
4. Save release drafts and history under the COCKPIT application-data directory.
5. After explicit operator confirmation, create a SemVer-validated annotated Git tag in the local repository.
6. Export release notes as Markdown.

The local Git working tree and filesystem are the source of operational truth. Remote URLs are inspected as local Git configuration only; the offline workflow does not call provider APIs.

## 2. Ownership boundaries

| Capability | Owner | RIOT RELEASE rule |
| --- | --- | --- |
| Local Git read/write | COCKPIT Rust runtime | Invoke Git with argument arrays; never interpolate user input into a shell |
| Repository catalog | COCKPIT local app-data store | Store canonical paths and display metadata only |
| Drafts/history | COCKPIT local app-data store | Local convenience metadata; Git tags remain authoritative |
| Provider credentials | OS keychain, future online adapter | Never store credentials in local JSON or browser storage |
| Remote publication/mirroring | Optional provider adapter, future | No push, tag deletion, release publication, or mirroring in the offline core |
| Cloud build / remote artifact storage | Separate optional capability | Not part of the first local vertical slice |
| Authentication, policy, central audit | Not required for local operations | No ARSY or cloud dependency for basic release tasks |

## 3. Safety invariants

- Only an existing Git working tree can be registered.
- Removing a repository removes only its COCKPIT registry entry; it never deletes the directory.
- User-controlled paths, versions, and notes are passed as process arguments, not shell source.
- Versions are validated as SemVer and normalized to a v-prefixed tag.
- Local tag creation requires a clean working tree and refuses an existing tag.
- Tag creation is an explicit second-step action in the UI.
- The workflow creates annotated local tags only. It does not push, publish, upload, delete, or overwrite tags.
- Provider APIs are not contacted. An origin URL does not prove that a remote is online or authenticated.
- Drafts, history, and repository paths stay in the operating-system application-data directory; secrets are not stored there.

## 4. Initial implementation and known limits

Implemented in the initial vertical slice:

- Rust Tauri commands for local repository registration/list/removal, Git status and commit preview, changelog generation, draft persistence, draft/history retrieval, and annotated tag creation.
- React route /release, linked from the COCKPIT operations flight deck.
- Rust unit tests and frontend contract tests.
- Offline release workflow with no network calls.

Not included yet:

- Native folder-picker UX; the first slice accepts a local filesystem path.
- Build profiles, build/test command orchestration, artifact packaging, checksums, and signing.
- GitHub/GitLab authentication, API publication, mirroring, provider quota monitoring, and upload retry queues.
- Embedded Git implementation; the first slice requires Git CLI installed and available on PATH.
- Cross-device sync or cloud backup.

The Tauri desktop build and exact-head CI must pass before merge. This document does not claim COCKPIT or RIOT RELEASE is production-complete.

## 5. Deferred extension order

1. Native directory picker and Git installation diagnostics.
2. Build profiles with explicit allowlisted toolchains and bounded process execution; no arbitrary shell input.
3. Artifact vault with checksums, metadata, and local retention policy.
4. Optional GitHub/GitLab provider adapters using OS-keychain credentials and explicit publication confirmation.
5. Optional mirror/backup workflows with conflict detection and visible sync state.

## 6. Acceptance for the initial slice

- COCKPIT remains usable without internet; RIOT RELEASE local operations make no network calls.
- A valid local Git repository can be registered and inspected.
- Changelog notes can be edited, saved locally, and exported.
- A clean repository can receive a new annotated SemVer tag after confirmation.
- Dirty repositories and duplicate tags are blocked.
- No remote mutation is available through the local release commands.
- Exact-head CI and Tauri desktop build evidence are recorded before merge.
