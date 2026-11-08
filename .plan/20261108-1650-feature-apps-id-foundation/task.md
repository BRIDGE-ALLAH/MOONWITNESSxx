# Executable Checklist: Apps ID Foundation

- [x] **Task 1: Scaffold `apps/id` Monorepo Package** `[S]`
  - Paths: `apps/id/package.json`, `apps/id/tsconfig.json`, `apps/id/next.config.ts`, `apps/id/tailwind.config.ts`
  - Acceptance: Clean setup in monorepo with port 3003.

- [x] **Task 2: Build Token & Session Verification Engine** `[M]`
  - Paths: `apps/id/src/lib/session.ts`, `apps/id/src/app/api/auth/token/route.ts`, `apps/id/src/app/api/auth/verify/route.ts`
  - Acceptance: Constant-time comparison, HMAC SHA-256 signing, fail-closed verification.

- [x] **Task 3: Implement Identity & Session Inspector UI** `[M]`
  - Paths: `apps/id/src/app/page.tsx`, `apps/id/src/components/*`
  - Acceptance: Interactive session simulator, token verification tester, and realm configuration overview.

- [x] **Task 4: Add Automated Verification Tests** `[S]`
  - Paths: `apps/id/tests/id-contract.test.mjs`, `apps/id/tests/session.test.mjs`
  - Acceptance: 100% tests pass.

- [x] **Task 5: Update Gate Universe Registry Linkage** `[S]`
  - Path: `apps/gate/src/app/page.tsx`
  - Acceptance: Experience 04 reflects `Operational Authority` linking to `http://localhost:3003`.
