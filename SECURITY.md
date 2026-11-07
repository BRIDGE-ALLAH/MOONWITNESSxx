# Security Policy

## Supported code

Security fixes are applied to the default branch, `main`. Prototype packages and legacy code may not yet have production support; report exposure risks even when a component is marked experimental.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, credential leak, exploitable endpoint, or sensitive user-data exposure.

Use GitHub's **Report a vulnerability** flow for this repository:

https://github.com/BRIDGE-ALLAH/MOONWITNESS/security/advisories/new

Include the affected commit or version, impact, prerequisites, and a minimal reproduction. Do not include live credentials, personal data, or unredacted production logs.

If private vulnerability reporting is unavailable, contact the repository maintainers privately through GitHub before publishing technical details.

## Secret handling

- Never commit API keys, access tokens, private keys, passwords, session cookies, or production connection strings.
- Use GitHub Actions secrets for CI credentials and grant each workflow only the permissions it needs.
- Use local `.env` files for development; `.env.example` contains names and safe defaults only.
- Rotate any secret that is accidentally committed. Removing it from the latest commit is not sufficient; treat it as compromised.
- Prefer short-lived, narrowly scoped tokens. Avoid personal access tokens when the built-in `GITHUB_TOKEN` is sufficient.

## Security checks

CodeQL runs on pull requests, pushes to `main`, and a weekly schedule. Dependabot checks dependency and GitHub Actions updates weekly. These automated checks complement—not replace—review, threat modeling, secure configuration, and operational monitoring.
