# Platform integration contracts

These APIs are presentation and composition contracts for MOONWITNESS / ARSY consumers. They are deliberately not a workflow engine or security boundary.

## Ownership rules

- The application/backend owns identity, permissions, capability checks, approval policy, execution, persistence, retries, and audit events.
- @riotworks/ui owns visual presentation and callback contracts only.
- Never trust a hidden/disabled action as authorization. The server must re-check every privileged request.
- Plugin UI is supplied by a trusted host registry; do not evaluate arbitrary remote code or load plugin bundles from untrusted URLs.

## Action and command registries

```ts
const actions = createActionRegistry()
const commands = createCommandRegistry()
const unregister = actions.register({
  id: 'record.archive',
  label: 'Archive record',
  dangerous: true,
  isAvailable: context => Boolean(context.recordId && context.canArchive),
  run: async context => { await api.archive(context.recordId!) },
})
unregister()
```

Definitions are typed, in-memory registrations. The host app owns the context object and must enforce authorization at the backend. Duplicate IDs throw to expose collisions. Registration returns a cleanup callback.

## Plugin slots

A slot definition declares a stable ID, owner, optional priority, React component, and host-controlled enablement predicate. Sort by priority with sortPluginSlots. The host must validate plugin ownership and lifecycle before registering a component. Keep slot props typed and pass only explicitly approved context.

## ApprovalCard

Provide status and callbacks from the workflow owner. The component shows approve/reject affordances only for pending items and disables them while busy. The callback must call the authorized application endpoint; update status only after the server confirms the result. Do not treat client-side UI state as an approval record.

## JobMonitor

Map backend job states to queued, running, blocked, succeeded, failed, or cancelled. Progress is optional; omit it when the backend cannot provide a meaningful percentage. Retry and cancel callbacks are shown only for applicable states, but server-side policy remains authoritative.

## RecordInspector

A generic details surface for a selected record, fields, status, and contextual action slots. It receives already-authorized data from the application.

## Command palette

RiotCommandPalette supports Ctrl/Cmd+K and delegates execution to supplied callbacks. The application should filter commands with its current capability context before presenting them and still re-check authorization when a command executes.
