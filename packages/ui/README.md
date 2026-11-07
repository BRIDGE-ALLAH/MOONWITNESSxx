# @riotworks/ui

Shared React + TypeScript component foundation for RIOTWORKS and MOONWITNESS.

## Workspace usage

```tsx
import { Button, Input, Dialog, DataTable, FormField } from '@riotworks/ui'
import '@riotworks/ui/styles'
```

The ESM package exports accessible primitives and data-in/data-out operational composites. The host application owns theme selection and applies `.dark` for Night Riot; the default theme is Paper Riot. See [TOKENS.md](./TOKENS.md).

## Component groups

- **Actions:** Button, IconButton.
- **Forms and selection:** Input, Textarea, Checkbox, CheckboxGroup, RadioGroup, Switch, Select, FormField.
- **Navigation:** Tabs, Breadcrumb, Pagination.
- **Overlays:** Dialog, Popover, Tooltip.
- **Feedback:** Alert, Progress, Spinner, Skeleton, Avatar, Badge.
- **Operational:** DataTable, FilterBar, BulkActions, EmptyState, ErrorState, MetricCard, ActivityTimeline.

## FormField

FormField uses a render-prop contract so generated IDs and ARIA relationships are forwarded to the control:

```tsx
<FormField label="Workspace name" required description="Shown to workspace members." error={error}>
  {(control) => <Input {...control} value={name} onChange={(event) => setName(event.target.value)} />}
</FormField>
```

## DataTable

DataTable accepts rows, columns, and a stable row-key function. Sorting and pagination are local presentation behavior; fetching, filtering, authorization, and server-side pagination remain consumer-owned. Pass `selectedRowIds` and `onSelectionChange` to enable controlled row selection.

## Development

- `pnpm --filter @riotworks/ui run type-check`
- `pnpm --filter @riotworks/ui run lint`
- `pnpm --filter @riotworks/ui run test`
- `pnpm --filter @riotworks/headquarter run build`

React/React DOM are peer dependencies. Components use Radix primitives for focus management, keyboard navigation, and accessible interaction semantics where appropriate.

## Application shell

Compose the shell with application-owned navigation, header actions, contextual content, and status content:

```tsx
<RiotAppShell sidebar={<RiotSidebar brand={<Brand />}>{navigation}</RiotSidebar>} topbar={<RiotTopbar>{headerActions}</RiotTopbar>} contextPanel={<RiotContextPanel title="Inspector">{inspector}</RiotContextPanel>}>
  <RiotWorkspace>{children}</RiotWorkspace>
  <RiotCommandPalette commands={commands} />
</RiotAppShell>
```

The shell does not own routing, identity, workspace selection, or authorization. The host application supplies those via slots and callbacks.

## Platform integration

See PLATFORM.md for action/command registry contracts, plugin slot lifecycle, approval callbacks, job status presentation, and record inspection. Registry factories are in-memory helpers only: they do not persist definitions, grant capabilities, authorize users, or invoke backend services.

## MOONWITNESS visual language

The shared brand signatures are exported as `RiotSignalHeader`, `RiotLiveIndicator`, and `RiotAtmosphere`. They provide editorial page hierarchy, explicit live/standby/attention states, and a restrained ambient hero surface. All decorative motion respects `prefers-reduced-motion`.

See [VISUAL-DNA.md](./VISUAL-DNA.md) for the composition and motion contract, and [WORKBENCH.md](./WORKBENCH.md) for the live Headquarter component workbench at `/ui-lab`.
