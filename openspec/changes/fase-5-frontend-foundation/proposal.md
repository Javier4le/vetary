# Proposal: Phase 5 Frontend Foundation (PR-1 Bootstrap)

## Intent

Vetary is currently a **backend-only monorepo**. Phases 1 and 2 are complete and
verifiable through the API, but nothing built is *visible*. The developer needs
something showable to potential clients and in job applications. Phase 5
("Dashboard y UI final") is therefore **pulled forward** to bootstrap the
frontend now, rather than waiting for Phase 3 (Bookings) and Phase 4 (Clinical
records) to close.

Phase 3 (internal bookings) is **PAUSED at PR-3**
(`feature/fase-3-internas-pr3-concurrency`) and **MUST NOT be touched**. This
change only adds a frontend; it does not modify the backend, the bookings
module, or the paused branch.

This proposal plans **PR-1 (bootstrap only)**: a working, visible frontend
scaffold — Vite + React + TypeScript + Tailwind + shadcn/ui — integrated into the
existing pnpm workspace, with a configured `apiClient`, a test proving its auth
interceptor, a placeholder route, and frontend CI. PR-2 (login against the real
API, protected routes, layout) is explicitly **out of scope** here, but PR-1 must
leave the hooks ready for it.

## Why Now (Frontend Pull-Forward)

- **Nothing showable:** The API works, but there is no UI. A portfolio needs a
  visible artifact; clients need to see a screen, not Swagger.
- **Phase 3 is blocked-paused:** The bookings backend is paused at PR-3. Waiting
  for it would stall visibility indefinitely. The frontend foundation is
  independent of that work and can proceed in parallel without touching it.
- **Phases 4–5 depend on a frontend existing:** Phase 4 (clinical records) and
  Phase 5 (dashboard) both assume a UI. Pulling the foundation forward de-risks
  those phases.

This decision is recorded in **ADR-005** (see Work-Unit Breakdown) so the phase
order in `SPEC.md` and `README.md` no longer misrepresents reality.

## Scope

### In Scope (PR-1)

- **Toolchain scaffold:** Vite + React + TypeScript integrated into the existing
  pnpm workspace (`vetary-web` is already listed in `pnpm-workspace.yaml`).
- **Tailwind CSS v4** (with a verification gate against shadcn compatibility —
  fall back to v3 and record why if v4 is incompatible; see Work-Unit Breakdown).
- **shadcn/ui** initialized with its **defaults** (neutral base color). No brand
  palette is invented; the developer decides colors separately. Primitives land in
  `src/shared/components/ui/` with `components.json` aliases overridden
  (exploration Option A).
- **React Router** with one placeholder route; pages live inside features.
- **`apiClient`** in `shared/lib` using the **factory pattern**
  `createApiClient(getToken: () => string | null)` with a singleton export. The
  request interceptor reads the token **inside the function on each call** (never
  captured at module load). baseURL is **relative `/api/v1`** per the deployment
  topology decision below.
- **Vitest + React Testing Library** configured, with one test proving the
  interceptor attaches the `Authorization` header (and reads the token
  dynamically).
- **Remove ESLint** that the Vite template installs. This repo uses Biome from the
  root; CI runs `biome check .` over the whole monorepo.
- **Structure** per `vetary-web/STACK-react.md`:
  `features/<feature>/{components,hooks,services,pages,types.ts}` + `shared/` +
  `app/`.
- **Frontend CI:** add `tsc --noEmit` and Vitest for `vetary-web` to
  `.github/workflows/ci.yml` (see Work-Unit Breakdown).
- **Docs-first commit:** `ADR-005` in `docs/decisions.md` plus `SPEC.md` and
  `README.md` edits, committed **before** any app code.

### Out of Scope (PR-1)

- **Login / auth flow** (PR-2). No login page, no token storage, no auth store.
- **Protected routes** (PR-2).
- **Layout** (sidebar, header, shell chrome) (PR-2).
- **Real API calls from services** — `apiClient` exists and is wired, but no
  feature service consumes it yet. No fake data or mocks as *final* behavior.
- **Brand colors / custom design tokens** — shadcn defaults only.
- **Backend changes of any kind**, including the bookings module and the paused
  Phase 3 branch.
- **Resolving the subdomain→tenantId login gap** (open decision — see below).

## Capabilities

> Contract between proposal and specs. `sdd-spec` reads this to know which spec
> files to create or update. Existing `openspec/specs/` holds backend capabilities
> only (`auth`, `users-vets`, `users-staff`, `vet-weekly-availability`,
> `clinic-services`); none are modified by PR-1.

### New Capabilities

- `frontend-api-client`: the shared configured HTTP client (`createApiClient`
  factory + singleton) whose request interceptor reads the auth token dynamically
  on each call and whose baseURL is a same-origin `/api/v1` with an optional env
  override.
- `frontend-app-shell`: the bootstrap app structure (`features/` + `shared/` +
  `app/`), React Router with one placeholder route, and the Vite + TypeScript +
  Tailwind + shadcn toolchain wired to Biome and Vitest.

### Modified Capabilities

None. PR-1 adds frontend code and CI steps; it changes no backend requirement or
spec. The deployment topology decision (below) is an infrastructure/deploy
concern, not a backend code change.

## Verified Backend Evidence

The following facts were verified against source (see
`exploration.md` for full citations) and constrain the design:

1. **Tenant is resolved from `Host` only.** `TenantMiddleware` resolves the tenant
   exclusively from `req.hostname`, with a `DEFAULT_TENANT_SUBDOMAIN` fallback when
   the hostname has ≤1 dot
   (`vetary-api/src/common/middleware/tenant.middleware.ts:49,84-96`).
   `X-Tenant-Id` was explicitly rejected as insecure (`:21-22`).
2. **Cross-domain prod breaks tenant resolution.** A cross-domain API
   (`api.vetary.app`) loses the tenant subdomain, so `TenantGuard` — which compares
   `req.tenant.id` against the JWT `tenantId`
   (`vetary-api/src/common/guards/tenant.guard.ts:46-49`) — cannot pass.
   Additionally, `api` is a reserved subdomain
   (`vetary-api/src/modules/tenants/services/tenant.service.ts:13-31`), so
   `api.vetary.app` cannot even be a tenant.
3. **Global prefix must be preserved.** The API is mounted at `/api/v1`
   (`vetary-api/src/main.ts:54`). A reverse proxy must **not** strip `/api/v1`.
4. **Login is tenant-agnostic but requires `tenantId`.** `POST /auth/login` is in
   the tenant-agnostic skip list (`tenant.middleware.ts:18`) but `LoginDto`
   requires a `tenantId` UUID in the body
   (`vetary-api/src/modules/auth/dto/login.dto.ts:22-24`), passed straight to
   `authService.login` (`vetary-api/src/modules/auth/controllers/auth.controller.ts:46-48`).
5. **No subdomain→tenantId resolution endpoint exists.** The tenants module
   exposes only `POST /tenants/register`
   (`vetary-api/src/modules/tenants/controllers/tenant.controller.ts`). The SPA
   can know the subdomain (from its own hostname) but cannot resolve it to a
   tenant UUID. This is an **open decision** (below) that blocks PR-2's real login.

## Deployment Topology Decision (First-Class)

**Decision: SAME-DOMAIN WITH REWRITE.** The frontend is served on the tenant's
subdomain (`laspalmeras.vetary.app`) and `/api/*` is routed to the backend on the
same origin. The backend therefore keeps seeing the tenant subdomain in the Host
header, which is exactly what `TenantMiddleware` and `TenantGuard` require.

This is **not merely a deploy detail — it is a correctness requirement.** Under a
cross-domain topology the subdomain is lost, `TenantMiddleware` cannot resolve the
tenant, and `TenantGuard`'s `tenant.id === user.tenantId` check fails. Post-login
`TenantGuard` only works if the SPA is served on the tenant's own subdomain (or
`DEFAULT_TENANT_SUBDOMAIN` equals that tenant).

**Edge/rewrite requirements to state explicitly:**

- **Preserve the original Host** header (or set `X-Forwarded-Host` and enable
  Nest `trust proxy`). Preserving Host is safer and simpler.
- **Do NOT strip `/api/v1`** — it is the global prefix set in `main.ts:54`.
- **Dev convention:** Vite proxy with `changeOrigin: false` (preserves Host),
  accessed via `<sub>.localhost:5173`. This reproduces real subdomain resolution
  locally. With plain `localhost` or `changeOrigin: true`, the backend falls back
  to `DEFAULT_TENANT_SUBDOMAIN` and real resolution is hidden.

**Consequence for `apiClient` in PR-1:**

- `baseURL` is a **relative `/api/v1`** (same-origin), not an absolute URL.
- An **optional env override** (e.g. `VITE_API_URL`) is supported for
  non-proxied/staging use; when unset, the client defaults to the same-origin
  relative path.
- The env is read at client construction, not hardcoded; `.env.example` documents
  the override with a comment explaining the same-domain default.

> **Recommendation (not decided here):** this topology has lasting consequences
> (baseURL shape, CORS, tenant resolution, post-login correctness) and warrants
> its own **ADR-006** alongside ADR-005. The `sdd-design`/`sdd-tasks` phases should
> treat it as a candidate docs work unit; the developer decides whether to split it
> from ADR-005.

## PR-1 Work-Unit Breakdown

Ordered to satisfy the docs-first rule and the 400-line review budget
(ADR-003/ADR-004). One branch (`feature/fase-5-frontend-pr1-bootstrap`) targets
`develop`.

### Commit 1 — Docs (separate, before any app code)

1. **`docs/decisions.md` → ADR-005** "Frontend foundation pulled forward from
   Phase 5", inserted after ADR-004 (line 143) and before the template comment
   (line 145), following the existing template (lines 10-27). Context: backend-only
   / nothing showable; decision: bootstrap PR-1 early, Phase 3 stays paused;
   alternatives: wait for Phase 5 naturally (rejected), build in Phase 3 gap
   (rejected); consequences: Phase 5 now has multiple slices, phase order updated.
2. **`SPEC.md`** — Phase 5 section (lines 172-175) gains a bootstrap bullet so it
   no longer describes only the final dashboard. (English artifact language per
   contract; the surrounding file is Spanish — the edit is a minimal additive
   note.) **Exact Spanish edit kept as the existing file's language** — see note.
3. **`README.md`** — phase status table (lines 97-104): Phase 3 → "Pausada en
   PR-3", Phase 5 → "Frontend Foundation + Dashboard — En progreso"; and the two
   "frontend no existe" lines (41-42, 155) updated after scaffold lands.
4. **Optional `docs/decisions.md` → ADR-006** (deployment topology) — recommended,
   developer decides.

> **Note on SPEC/README language:** these two files are currently Spanish. The
> proposal's own artifact is English (mandatory), but the *edits* to `SPEC.md` and
> `README.md` should preserve the existing Spanish voice of those files to avoid a
> mixed-language document. This is a docs-consistency decision, flagged here so the
> `sdd-apply` phase does not silently bilingualize them.

### Commit 2+ — Scaffold (app code)

5. Scaffold Vite React-TS in `vetary-web/` (preserve existing `STACK-react.md`).
6. **Remove ESLint** (delete `eslint.config.js`, remove ESLint deps, replace the
   `lint` script with `biome check --write .`). This repo uses root Biome; CI runs
   `biome check .` over the whole monorepo.
7. **Tailwind v4 verification gate (explicit, before first component):** run
   `pnpm dlx shadcn@latest init` with Tailwind v4 and confirm it does **not**
   generate a `tailwind.config.js` (v3 artifact) and that a sample primitive
   (`pnpm dlx shadcn@latest add button`) compiles. **If v4 is incompatible, pin
   Tailwind v3 and record why** in the commit/design. This is a gate, not a
   footnote.
8. Initialize shadcn/ui with defaults, then override `components.json` aliases to
   `src/shared/components/ui/` (Option A).
9. Add `vi` and `test` to `biome.json` `javascript.globals` (Vitest globals).
10. Install Vitest + RTL + `jsdom` (+ `axios` runtime dep).
11. Create `shared/lib/apiClient.ts` — factory + singleton, relative baseURL, env
    override, request interceptor reading token dynamically.
12. Write the proving interceptor test (dynamic-read pattern).
13. Create `app/router.tsx` + one placeholder feature route.
14. Add `vetary-web/.env.example` (documents `VITE_API_URL` override and the
    same-domain default).
15. Update `pnpm-lock.yaml` (frozen-lockfile CI will fail otherwise).

### Commit 3 — CI

16. Add frontend `tsc --noEmit` and `vitest run` to CI. **Recommendation: a second
    `Vetary Web CI` job** (parallel), rather than appending to `Vetary API CI`,
    because: (a) the API job provisions a PostgreSQL service and runs Prisma
    generate/migrate + Jest integration/E2E — the web job needs none of that;
    (b) it keeps backend and frontend failure domains separate and reviewable;
    (c) `biome check .` already runs from the root and covers `.tsx`, so no new
    Biome step is required. Tradeoff: one extra `pnpm install` in the second job.
    The `sdd-design` phase finalizes the exact step list.

## Open Decision: Subdomain → tenantId Resolution (blocks PR-2)

Under the same-domain topology the SPA knows its own subdomain but **not** the
tenant UUID that `POST /auth/login` requires (`login.dto.ts:22-24`). There is no
endpoint to resolve subdomain → tenant UUID (tenants module only exposes
`POST /tenants/register`). This blocks PR-2's real login. Options with tradeoffs:

- **(a) New public `GET /tenants/resolve?subdomain=` endpoint** — small backend
  change in the tenants module (a *separate* change, **not** the paused bookings
  module). Cleanest long-term; requires a small backend slice and its own tests.
- **(b) Extend login to accept `subdomain` instead of `tenantId`** — folds
  resolution into auth; touches the auth contract and its tests; slightly less
  clean separation.
- **(c) Demo-only seeded `tenantId` via env** — zero backend change; unblocks the
  demo fast; not production-correct and risks shipping a fake-path login.

**Recommendation (for the developer, not decided here):** (a) as a small
follow-up backend change, with (c) acceptable only as a temporary demo bridge.
This is recorded as an open decision so PR-2's planning resolves it explicitly.

> Note explicitly: the same-domain topology makes post-login `TenantGuard` work
> only if the SPA is served on the tenant's subdomain (or `DEFAULT_TENANT_SUBDOMAIN`
> equals that tenant). The topology is therefore a correctness requirement, not a
> deploy convenience.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `vetary-web/` | New | Frontend scaffold (Vite/React/TS/Tailwind/shadcn), `shared/lib/apiClient.ts`, router, test setup. |
| `pnpm-lock.yaml` | Modified | Updated by `pnpm install` after scaffold; required for frozen-lockfile CI. |
| `biome.json` | Modified | Add `vi` and `test` to `javascript.globals`. |
| `.github/workflows/ci.yml` | Modified | Add frontend `tsc --noEmit` + `vitest run` (second job recommended). |
| `docs/decisions.md` | Modified | Add ADR-005 (and optionally ADR-006). |
| `SPEC.md` | Modified | Phase 5 gains a bootstrap bullet. |
| `README.md` | Modified | Phase status table + "frontend no existe" lines corrected. |
| `vetary-api/**` | **Untouched** | Backend and paused Phase 3 branch are out of scope. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind v4 + shadcn incompatibility | Medium | Explicit verification gate before first component; pin v3 and record why if incompatible. |
| Same-domain topology misconfigured (Host not preserved / `/api/v1` stripped) | Medium | State the rewrite requirements explicitly (preserve Host, keep prefix); Vite dev proxy `changeOrigin: false` + `<sub>.localhost` reproduces resolution locally. |
| Frontend tests green locally but CI lacks `tsc`/Vitest | Medium | Add web CI in PR-1 (this happened with E2E in Phase 2 — don't repeat). |
| Lockfile drift breaks frozen-lockfile CI | Low | Commit `pnpm-lock.yaml` alongside scaffold. |
| React 19 vs React 18 (SPEC says 18) | Low | Check scaffold output; either pin 18 or update SPEC.md. |
| ESLint remnants left behind | Low | Delete config, remove deps, replace `lint` script, verify `biome check .` passes. |

## Rollback Plan

- The frontend is **additive**; no backend code is touched, so rollback is a
  branch revert (`git revert` of the PR merge, or delete the branch before merge).
- If Tailwind v4 + shadcn fails verification, the scaffold commit reverts to
  Tailwind v3 and the reason is recorded — no partial v4 state is left.
- If CI changes break the workflow, the CI commit is reverted independently; the
  existing `Vetary API CI` job is unchanged and remains green.
- Docs commits (ADR/SPEC/README) are reverted independently of the scaffold.

## Dependencies

- None external. Uses the existing pnpm workspace (`vetary-web` already listed in
  `pnpm-workspace.yaml`; `allowBuilds` already covers `@biomejs/biome`).
- Requires the paused Phase 3 branch to remain untouched (a constraint, not a
  dependency).
- PR-2 depends on this PR-1 landing (apiClient factory, router placeholder,
  Vitest, CI) and on the open subdomain→tenantId decision being resolved.

## Success Criteria

- [ ] `pnpm exec biome check .` from root passes (0 errors, 0 warnings) — proves
      ESLint removal and Biome coverage of `.tsx`.
- [ ] `pnpm --filter vetary-web exec tsc --noEmit` passes (strict TS).
- [ ] `pnpm --filter vetary-web test` passes, including the interceptor test that
      proves `Authorization` is attached and the token is read dynamically per call.
- [ ] `pnpm --filter vetary-web build` succeeds (`tsc -b && vite build`).
- [ ] CI workflow green, including the new frontend `tsc`/Vitest steps.
- [ ] No ESLint artifacts remain in `vetary-web` (no `eslint.config.js`, no ESLint
      deps/scripts).
- [ ] shadcn primitives resolve to `src/shared/components/ui/` via overridden
      `components.json` aliases, using default (neutral) colors only.
- [ ] `apiClient` baseURL is same-origin `/api/v1` by default with `VITE_API_URL`
      override documented in `.env.example`.
- [ ] `docs/decisions.md` contains ADR-005 (and ADR-006 if approved); `SPEC.md` and
      `README.md` reflect the pulled-forward Phase 5 foundation.
- [ ] No backend file, bookings module, or Phase 3 branch is modified.
