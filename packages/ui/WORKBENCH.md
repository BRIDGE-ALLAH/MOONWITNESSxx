# UI Component Workbench

The live component workbench is available at **/ui-lab** in the Headquarter application.

It is intentionally an application route rather than a second component runtime. It renders the actual @riotworks/ui exports inside the real Headquarter shell, so theme switching, responsive layout, and host typography are exercised in context.

## What to inspect

- Night Riot and Paper Riot through the host theme switch.
- Editorial signal header, atmosphere canvas, and live/standby/attention markers.
- Buttons, badges, cards, metrics, activity, approvals, and job states.
- Keyboard focus, narrow viewport behavior, and reduced-motion preference.

## Run

```sh
pnpm --filter @riotworks/headquarter run dev
```

Open http://localhost:3000/ui-lab.

## Scope and honesty

This workbench is a practical visual inventory, not Storybook and not a screenshot-regression runner. It is useful for human review in the real host app. Automated browser screenshots, axe-core audits, and cross-browser checks remain follow-up work until browser-test infrastructure is adopted by the repository.


## Signal intelligence modules

The workbench also includes two newer interaction patterns:

- **Signal Constellation** — an evidence map for inspecting host-supplied relationships. Nodes include provenance, observation time, confidence, and supporting evidence when provided. Coordinates are normalized to a 1000 × 600 field.
- **Decision Trail** — a selectable sequence of observed, interpreted, decided, actioned, and changed events. The inspector surfaces rationale, owner, and evidence without claiming to be an immutable audit log.

The example content on this route is explicitly illustrative. Production consumers should pass real, permission-filtered host data and should not label stale snapshots as live.
