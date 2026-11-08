# @riotworks/ui

Private shared React UI foundation for MOONWITNESS applications.

This package owns reusable presentation primitives, semantic theme tokens, accessible interactions, and (as implementation progresses) the MOONWITNESS Skin System. It does not own domain rules, API clients, authentication, authorization, persistence, or application workflows.

## Current public API

The source entry point currently exports:

- `Button`, `buttonVariants`, and `ButtonProps`.
- `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, and `CardContent`.
- `Badge` and `BadgeProps`.
- `Separator`.
- `cn`, the class-name merge helper.
- `HalftoneSurface` and `HalftoneSurfaceProps`.
- `SkinRoot` and `SkinRootProps`.
- `SKIN_REGISTRY`, `DEFAULT_SKIN`, `getSkinDefinition`, and `isSkinName`.
- `resolveSkinConfig` plus skin, mode, density, and fallback types.

Only APIs exported from `src/index.ts` are public. Items in `todo.md` or historical pull requests are not shipped components unless they are present in the current mainline source.

## Workspace consumption

`@riotworks/ui` is a private workspace package, not a published npm package. Headquarter is the current consumer.

The consuming application should:

1. Declare `@riotworks/ui` as a workspace dependency.
2. Import the shared stylesheet once from its application root stylesheet.
3. Use the shared Tailwind preset and include the UI source in Tailwind content scanning.
4. Configure Next.js `transpilePackages` for `@riotworks/ui` and `@riotworks/assets`.

Current Headquarter integration:

```css
/* apps/headquarter/src/app/globals.css */
@import '@riotworks/ui/styles';
```

```ts
// apps/headquarter/tailwind.config.ts
import type { Config } from 'tailwindcss'
import uiConfig from '@riotworks/ui/tailwind.config'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [uiConfig],
  theme: {
    extend: {},
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

```ts
// apps/headquarter/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@riotworks/ui', '@riotworks/assets'],
}

export default nextConfig
```

These snippets describe the current Headquarter setup; use the actual application configuration as the source of truth when integrating another consumer.

## Peer compatibility

The consuming application must provide:

- React `^18` or `^19`.
- React DOM `^18` or `^19`.
- Tailwind CSS `^3.4.0`.

The package declares Radix UI primitives, class utilities, and Tailwind animation support as its own workspace dependencies. Keep React, React DOM, and Tailwind owned by the consuming application to avoid duplicate framework runtimes.

## Basic usage

```tsx
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@riotworks/ui'

export function ExamplePanel() {
  return (
    <Card>
      <CardHeader>
        <Badge variant="success">Ready</Badge>
        <CardTitle>Observation record</CardTitle>
        <CardDescription>Present application-owned information.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button">Open record</Button>
      </CardContent>
    </Card>
  )
}
```

The UI components receive application data and callbacks. The consuming application remains responsible for fetching records, enforcing permissions, performing mutations, and reporting the result.

## Themes and Skin System

The semantic source of truth is `src/styles/globals.css`; skin metadata and configuration are in `src/skin`.

### Initial runtime foundation

- A static typed registry defines **Observatory**, **Archive**, and **Signal**.
- `SkinRoot` scopes the selected skin to an application or route boundary using `data-mw-skin`, `data-mw-mode`, and `data-mw-density`.
- `resolveSkinConfig` validates untrusted configuration and records safe fallback reasons in `data-mw-fallback`.
- CSS maps the three initially supported pairs: Observatory/dark, Archive/light, and Signal/dark.
- Semantic status colors remain independent from expressive skin accents.

```tsx
import { SkinRoot } from '@riotworks/ui'

export function EditorialEntry({ children }: { children: React.ReactNode }) {
  return (
    <SkinRoot skin="signal" mode="dark" density="comfortable">
      {children}
    </SkinRoot>
  )
}
```

### Current support matrix

| Skin | Supported mode | Intended use |
|---|---|---|
| Observatory | Dark | Operational, monitoring, research, decision workspaces |
| Archive | Light | Reading, records, documentation, knowledge, provenance |
| Signal | Dark | Landing, onboarding, public stories, community, campaigns |

Unsupported mode/skin combinations fall back to the selected skin's documented default and are exposed as fallback metadata. Additional combinations require rendered contrast and component review before being advertised.

**Skin is not a dark/light toggle.** A skin defines visual grammar, composition, typography, surface character, texture, and component recipes. Appearance mode, density, and accessibility preferences remain separate concerns.

An initial internal specimen route is available at `/ui-lab/skin-system` in Headquarter. It compares the three profiles using illustrative content; it is not a complete component workbench or visual-regression suite. There is no global skin picker, preference persistence, React context, or automatic route mapping. Applications must explicitly apply `SkinRoot` to the route or application boundary. See [docs/13 — Skin System Blueprint](../../docs/13-skin-system-blueprint.md).

## Typography and assets

The shared stylesheet requests Space Grotesk for display/interface text and IBM Plex Mono for technical data from Google Fonts, with system fallbacks. The runtime does not load the experimental MOONWITNESS Signal WOFF2.

Original brand artwork and static illustrations belong to `@riotworks/assets`. The UI package may consume assets, but the assets package must not depend on UI.

## Accessibility and motion

- Preserve visible keyboard focus.
- Keep status meaning available through text or semantics, not color alone.
- Use semantic HTML and accessible names for interactive elements.
- Respect `prefers-reduced-motion`.
- Review rendered contrast and interactive states in every supported skin/mode pairing; source-level token tests are not a WCAG certification.

## Commands

Run from the repository root:

```sh
pnpm --filter @riotworks/ui type-check
pnpm --filter @riotworks/ui test
pnpm --filter @riotworks/ui lint
```

The package's `test` script runs the theme source-contract tests. Headquarter integration and production build checks run in repository CI.

## Distribution status

The package manifest is currently `private: true` and exposes source TypeScript, the shared CSS, and the Tailwind config to workspace consumers. There is no public package publication or standalone compiled distribution contract on main. Do not publish or version this package independently without a separately reviewed distribution decision.
