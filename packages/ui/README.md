# @riotworks/ui

Shared React + TypeScript component foundation for RIOTWORKS and MOONWITNESS.

## Workspace usage

The package is consumed by workspace applications through `workspace:*`. Its JavaScript entry point is ESM; the Tailwind preset remains an explicit `.cjs` subpath for compatibility with the existing Tailwind configuration:

```tsx
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'
import '@riotworks/ui/styles'
```

The stylesheet defines the shared semantic CSS variables and Night Riot / Paper Riot color modes. The consuming application owns the theme provider and decides when to apply the `.dark` class.

## Tailwind

Extend the package preset from the consuming app's Tailwind configuration:

```ts
import uiConfig from '@riotworks/ui/tailwind.config'
```

The consumer must include `packages/ui/src/**/*.{ts,tsx}` in its Tailwind content paths so utility classes used by shared components are generated.

## Development

From the repository root:

- `pnpm --filter @riotworks/ui run type-check` — type-check source files without emitting output.
- `pnpm --filter @riotworks/ui run build` — emit ESM JavaScript and TypeScript declarations to `dist/`.
- `pnpm --filter @riotworks/ui run smoke-test` — build the package and verify its public exports through the package name.
- `pnpm --filter @riotworks/ui run clean` — remove generated output.

React and React DOM are peer dependencies and must be supplied by the consuming application. Tailwind CSS is also a peer dependency because it processes the exported stylesheet and utility classes.

## Package boundaries

This package owns reusable presentation, component composition, and interaction primitives. Applications own data fetching, persistence, authorization, business rules, and workflow execution. Components should receive data and callbacks rather than importing application or backend clients.
