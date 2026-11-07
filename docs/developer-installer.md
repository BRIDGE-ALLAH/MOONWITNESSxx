# Developer Installer

The repository installer is a thin Bash/PowerShell launcher over one Node.js implementation. It deliberately does not install global runtimes, change shell profiles, request AI credentials, or execute production operations.

## Requirements

- Node.js 22 or newer.
- The exact pnpm version declared by `package.json` (`packageManager`).
- Git is recommended for repository-aware diagnostics.
- Docker Engine and the Compose v2 plugin are optional and only needed for the container stack.

The installer checks the pinned package manager. If it is unavailable, enable Corepack or install that exact version yourself. It does not silently upgrade Node, pnpm, Docker, or system packages.

## Quick start

Linux/macOS:

```sh
./install.sh --profile full-dev
```

Windows PowerShell:

```powershell
.\install.ps1 -Profile full-dev
```

Profiles:

| Profile       | Installs                                   |
| ------------- | ------------------------------------------ |
| `minimal`     | Root workspace tooling only                |
| `headquarter` | Headquarter and its workspace dependencies |
| `arsy`        | ARSY and its workspace dependencies        |
| `full-dev`    | Entire pnpm workspace                      |

Useful commands:

```sh
node scripts/moonwitness.mjs doctor
node scripts/moonwitness.mjs install --profile arsy --dry-run
node scripts/moonwitness.mjs repair
node scripts/moonwitness.mjs update
node scripts/moonwitness.mjs verify
node scripts/moonwitness.mjs uninstall
```

Or use the root scripts: `pnpm setup:doctor`, `pnpm setup:repair`, `pnpm setup:update`, `pnpm setup:verify`, and `pnpm setup:uninstall`.

## Safety and repeatability

- Every dependency installation uses `--frozen-lockfile`; `--offline` is available when the package store is populated.
- `.env` is copied from `.env.example` only when absent. Existing environment files and credentials are never overwritten.
- Installer metadata is written to `.moonwitness/install-state.json` with restrictive file permissions.
- `update` synchronizes dependencies to the committed lockfile; it does not upgrade dependency versions or pull Git changes.
- `repair` repeats the frozen install for the recorded profile.
- `verify` checks the local marker, environment file, and pnpm installation metadata.
- `uninstall` removes only the generated installer marker. It intentionally preserves `.env`, `node_modules`, source files, Docker volumes, and databases.

The installer does not run database migrations, start containers, change host services, install Git hooks, or deploy anything.

## Troubleshooting

1. Run `node scripts/moonwitness.mjs doctor`.
2. Confirm the active Node and pnpm versions match repository requirements.
3. Run `node scripts/moonwitness.mjs install --profile full-dev --offline` only if the required package tarballs already exist in the local pnpm store.
4. If the lockfile is intentionally changed, have a maintainer refresh and review it separately; never use an installer repair to rewrite the lockfile.
