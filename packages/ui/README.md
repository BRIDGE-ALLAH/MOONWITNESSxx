# @riotworks/ui

Private shared React UI foundation for MOONWITNESS applications.

This package owns reusable presentation primitives, semantic theme tokens, and small visual compositions. It does not own domain rules, API clients, authentication, authorization, persistence, or application workflows.

## Current public API

The source entry point currently exports:

- `Button`, `buttonVariants`, and `ButtonProps`.
- `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, and `CardContent`.
- `Badge` and `BadgeProps`.
- `Separator`.
- `cn`, the class-name merge helper.
- `HalftoneSurface` and `HalftoneSurfaceProps`.

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
import uiConfig from '@riotworks/ui/tailwind.config'

const config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [uiConfig],
}
```

```ts
// apps/headquarter/next.config.ts
const nextConfig = {
  transpilePackages: ['@riotworks/ui', '@riotworks/assets'],
}
```

These snippets describe the current Headquarter setup; use the actual application configuration as the source of truth when integrating another consumer.

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

## Themes and tokens

The semantic source of truth is `src/styles/globals.css`.

- The default root theme is the light **Archive** experience.
- Use `.theme-archive` to explicitly select Archive, including inside an application-level `.dark` class.
- Use `.theme-observatory` or the application-level `.dark` class for the dark **Observatory** experience.
- Prefer semantic utilities such as `bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-success`, and `ring-focus`.
- Legacy RIOTWORKS palette aliases remain for existing prototype consumers only. Do not introduce them into new MOONWITNESS product screens.

See [DESIGN-TOKENS.md](./DESIGN-TOKENS.md) for the theme contract and accessibility constraints.

## Typography and assets

The shared stylesheet requests Space Grotesk for display/interface text and IBM Plex Mono for technical data from Google Fonts, with system fallbacks. The runtime does not load the experimental MOONWITNESS Signal WOFF2.

Original brand artwork and static illustrations belong to `@riotworks/assets`. The UI package may consume assets, but the assets package must not depend on UI.

## Accessibility and motion

- Preserve visible keyboard focus.
- Keep status meaning available through text or semantics, not color alone.
- Use semantic HTML and accessible names for interactive elements.
- Respect `prefers-reduced-motion`.
- Review rendered contrast and interactive states in both themes; source-level token tests are not a WCAG certification.

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
