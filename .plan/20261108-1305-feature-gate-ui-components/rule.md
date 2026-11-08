# Hard Rules for Gate UI Implementation

1. **Isolation First:** Implement all new UI components within `apps/gate/src/components/` first. Do NOT touch `packages/ui/src/index.ts` or `packages/ui/src/styles/globals.css` until PR #193 (`feat-moonwitness-skin-engine`) is merged to avoid merge conflicts.
2. **Reuse Existing Primitives:** Use `@riotworks/ui` existing components (`Card`, `Badge`, `Button`, `HalftoneSurface`) where applicable.
3. **TypeScript & Formatting Strictness:** Keep strict TypeScript compliance (`noEmit` passes). All code must satisfy Prettier before commit.
4. **No Direct Backend Coupling:** `apps/gate` must not import backend modules, database pools, or internal services. Only public contracts/types are allowed.
5. **Deterministic Testing:** Include contract and rendering unit tests for newly introduced UI components under `apps/gate/tests/`.

