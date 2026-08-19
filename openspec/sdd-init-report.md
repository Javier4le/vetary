# Vetary — SDD Init Report
**Generated:** 2026-05-31  
**Refreshed:** 2026-08-19
**Project:** vetary  
**Phase:** sdd-init  
**Status:** ✅ Complete (refreshed)

---

## Executive Summary

SDD initialization complete for Vetary, a multi-tenant SaaS platform for veterinary clinic management. Project context persisted to OpenSpec (`openspec/config.yaml`) and Engram (`sdd-init/vetary`, `sdd/vetary/testing-capabilities`, `skill-registry`) with strict TDD mode ACTIVE.

**Key findings (verified 2026-08-19):**
- **Testing capabilities:** Jest 29.7 (backend) — **14 unit suites / 111 tests, 4 integration suites / 27 tests, and 3 E2E suites / 15 tests, all passing** (verified by separate pnpm commands). Frontend (Vitest) planned — not bootstrapped.
- **Strict TDD:** ACTIVE — mandatory for auth, tenant isolation, repositories, bookings, and services logic.
- **Test command:** `pnpm --filter vetary-api test`
- **Code status:** Phase 1 COMPLETED (`fase-1-complete` tag); Phase 2 (Clinic Configuration) COMPLETED and archived (`fase-2-complete` tag); Phase 3 (Bookings) NOT STARTED.
- **Linter/formatter:** Biome 1.9.4 only (ESLint + Prettier removed — commit `d9280eb`).
- **Architecture:** 4-layer architecture with mandatory Repository pattern for tenant filtering.

---

## 1. Stack Detection

### Backend (vetary-api/)
- **Runtime:** Node.js 22 (engine-strict=true in `.npmrc`)
- **Framework:** NestJS 10 with TypeScript strict mode
- **Database:** PostgreSQL 16 (Docker)
- **ORM:** Prisma 7.9.1 with `prisma.config.ts`, `@prisma/adapter-pg`, and generated client output under `src/generated/prisma`
- **Auth:** JWT with refresh tokens (passport-jwt, bcrypt)
- **Validation:** class-validator + class-transformer (global ValidationPipe)
- **Lint/format:** Biome 1.9.4 (replaced ESLint + Prettier)
- **Testing:** Jest 29.7

### Frontend (vetary-web/)
- **Framework:** React 18 with TypeScript strict mode
- **Build tool:** Vite
- **State (server):** TanStack Query v5 — **State (client):** Zustand
- **Routing:** React Router v6 — **UI/Styles:** Tailwind CSS + shadcn/ui — **Forms:** React Hook Form + Zod
- **Testing:** Vitest (planned — **not bootstrapped**, only `STACK-react.md` exists)
- **Status:** Frontend implementation deferred (Phase 5 per STATUS.md)

### Other
- **vetary-app/:** empty placeholder (only `.gitignore`) — not in pnpm workspace
- **Package manager:** pnpm (monorepo, `packageManager: pnpm@11.5.0` at root)

---

## 2. Testing Capabilities

### Backend Testing Stack (verified)
- **Framework:** Jest 29.7 (ts-jest, `moduleNameMapper` `@/` → `src/`)
- **Current state:** 14 unit suites / 111 tests, 4 integration suites / 27 tests, and 3 E2E suites / 15 tests — ALL PASSING (run on 2026-08-19)
- **Test types:**
  - Unit: business logic, guards (auth/tenant/roles), env validation, BaseRepository, middleware
  - Integration: services with tenant isolation verification
  - E2E: configured via `test/jest-e2e.json` — 3 suites / 15 tests passing
- **Coverage requirements:** auth logic 100% · multi-tenant isolation 100% · business rules 80%
- **Commands:**
  - Unit: `pnpm --filter vetary-api exec jest --no-coverage`
  - Integration: `pnpm --filter vetary-api exec jest --config ./test/jest-integration.json --no-coverage`
  - Test: `pnpm --filter vetary-api test`
  - Watch: `pnpm --filter vetary-api test:watch`
  - Coverage: `pnpm --filter vetary-api test:cov`
  - E2E: `pnpm --filter vetary-api exec jest --config ./test/jest-e2e.json --no-coverage`

### Frontend Testing Stack (planned)
- **Framework:** Vitest — component, hook, and mocked service tests
- **Test location:** `vetary-web/src/**/*.test.tsx`
- **Status:** Not bootstrapped — runner will be configured when the project is scaffolded

---

## 3. Strict TDD Mode: ACTIVE

**Justification — critical security and isolation requirements:**

1. **Authentication logic** — password hashing, JWT, refresh token rotation, RBAC
   - *Risk if untested:* unauthorized access, token leakage, privilege escalation
2. **Multi-tenant data isolation** — every query MUST filter by `tenantId`
   - *Risk if untested:* data leakage between tenants (catastrophic legal/business failure)
3. **Domain state transitions** — booking status flow
   - *Risk if untested:* invalid state transitions, broken business rules

### Strict TDD Modules
`auth` · `tenants` · `repositories` · `bookings` · `services`

### Standard Mode Allowed
DTOs (runtime-validated by class-validator) · Controllers (thin HTTP handlers) · Configuration files · Database migrations

---

## 4. Architecture Context

### 4-Layer Architecture (Layered Architecture)

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│   Controllers · Guards · Interceptors   │
├─────────────────────────────────────────┤
│         APPLICATION LAYER               │
│   Services · Use Cases · DTOs           │
├─────────────────────────────────────────┤
│           DOMAIN LAYER                  │
│   Entities · Business Rules · Events    │
├─────────────────────────────────────────┤
│       INFRASTRUCTURE LAYER              │
│   Repositories · Prisma · External APIs │
└─────────────────────────────────────────┘
```

**Dependency rule (inviolable):** Presentation → Application → Domain; Infrastructure → Domain.

### Multi-Tenant Strategy
- Shared database, shared schema with `tenantId` column
- Flow: HTTP Request → TenantMiddleware (subdomain/JWT) → TenantContext (AsyncLocalStorage) → BaseRepository (`WHERE tenantId = ?`)
- **Golden rule:** No repository can execute a query without the tenantId filter.

---

## 5. Design Patterns

| Pattern | Phase | Where | Status |
|---|---|---|---|
| Repository | 1 | Every module | ✅ Implemented (BaseRepository + User + Tenant + Service repositories) |
| Decorator | 1 | common/decorators | ✅ Implemented (@CurrentUser, @Public, @Roles, @CurrentTenant) |
| Strategy | 2 | availability module | ⏳ Planned |
| Factory | 3 | bookings module | ⏳ Planned |
| Observer | 3 | bookings module | ⏳ Planned |

---

## 6. Conventions Summary

### TypeScript (Universal)
- Strict mode: ON · No `any` (use `unknown` + narrated casts) · Explicit return types
- ⚠️ Never `import type` on classes with NestJS/class-validator decorators (breaks runtime reflection)

### Backend (NestJS)
- Files/folders: kebab-case · Classes: PascalCase
- Module structure: dto/ entities/ repositories/ services/ controllers/ events/ factories/ `[feature].module.ts`
- Controllers: HTTP only · Services: never touch Prisma directly · Repositories: data access only
- DTOs: class-validator + global ValidationPipe (whitelist, forbidNonWhitelisted)

### Project (Vetary-specific)
- **pnpm only** — never npm/yarn; `packageManager` at repo root; `engine-strict=true`
- **Money:** CLP as Int, never Float
- **Imports:** prefer absolute `@/` aliases over deep relative paths
- **Tenant isolation:** golden rule above

### Git
- Conventional Commits · One commit per logical unit · `main` ← `develop` ← `feature/[name]`
- Never commit `.env`, credentials, `node_modules`

---

## 7. Security Baseline

### Backend (main.ts)
Helmet · CORS from env var (never `*`) · global ValidationPipe · env validation at startup (fail fast) · Swagger/OpenAPI · rate limiting on auth endpoints

### Multi-Tenant Isolation
BaseRepository enforces tenantId · TenantMiddleware validates context · integration tests verify cross-tenant queries fail

### Auth
bcrypt (cost ≥10) · JWT secret from env · refresh token rotation · role guards with decorators

---

## 8. Project Progress

### Phase 1 — Auth + Multi-tenancy Foundation ✅ COMPLETED
Tag `fase-1-complete` on `develop`.

### Phase 2 — Clinic Configuration ✅ COMPLETED
Change archived at `openspec/changes/archive/2026-08-16-fase-2-configuracion-clinica/`; tag `fase-2-complete`.

| PR | Status | Scope |
|----|--------|-------|
| Phase 2 | ✅ COMPLETED | Clinic configuration change archived and tagged `fase-2-complete` |

**Business rules documented:** availability weekly recurring / multi-block per day / one timezone per clinic · services soft-disable, price CLP Int, unique name per tenant · vet creation atomic (User + UserTenant + VetProfile) · single-admin per tenant in v1.

Current branch: `develop`.

### Phase 3 — Bookings ⏳ NOT STARTED
No Phase 3 change directory exists yet. Exploration may begin after this documentation refresh.

---

## 9. Next Recommended Actions

1. ✅ Init complete — context refreshed in OpenSpec + Engram
2. **Run Phase 3 SDD exploration** for bookings; do not assume requirements beyond the exploration output.
3. Before implementation, run the separate unit, integration, and E2E commands listed above.
4. Use `.github/workflows/ci.yml` as the CI verification reference.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tenant data leakage | Catastrophic (legal, business) | Strict TDD for all repository methods; integration tests verify isolation |
| Auth vulnerabilities | High (unauthorized access) | Strict TDD for auth flows; manual security review before phase close |
| Missing test coverage | Medium (bugs in production) | Coverage thresholds enforced (auth/isolation 100%, business 80%) |
| Frontend production breaks | Medium (user-facing failures) | `apiClient` convention; auth interceptor tested (when frontend bootstraps) |
| State explosion | Low (complexity creep) | TanStack Query for server state only; Zustand minimal |

---

## 11. Artifacts Created (this refresh)

**OpenSpec:**
- Config: `openspec/config.yaml` (refreshed 2026-08-19 — Prisma 7.9.1, Biome 1.9.4, 14/111 unit, 4/27 integration, 3/15 E2E, CI, Phase 2 complete, Phase 3 not started)
- Report: `openspec/sdd-init-report.md` (this file)

**Engram (obs IDs):**
- Project context: `sdd-init/vetary` — obs #18
- Testing capabilities: `sdd/vetary/testing-capabilities` — obs #32
- Skill registry: `skill-registry` — obs #33

**Skill registry:** `.atl/skill-registry.md` (2026-08-13) — 18 skills, all paths verified on disk

---

## 12. Skill Resolution

**Status:** `paths-injected`

Init phase loaded `sdd-init/SKILL.md` (phase contract) and `_shared/SKILL.md` before detection. No project-specific skill injection needed for read-only init + config refresh; skill registry was verified instead.

---

## Refresh Log (2026-08-19)

Changes applied to the prior init artifacts (approved by user; non-destructive):

1. Linter: ESLint 8.56 → **Biome 1.9.4** (ESLint + Prettier removed, commit `d9280eb`)
2. Formatter: Prettier + Biome → **Biome only** (lint + format unified)
3. Test count: 12 suites / 98 → **14 unit suites / 111 tests; 4 integration suites / 27 tests; 3 E2E suites / 15 tests** (verified by separate Jest commands)
4. Test commands: `cd vetary-api && npm run …` → **`pnpm --filter vetary-api …`** (pnpm-only convention)
5. E2E: previous 8-test state → **3 suites / 15 tests** via `test/jest-e2e.json`
6. PostgreSQL version pinned: **16**
7. Phase 1 status: In progress → **COMPLETED** (tag `fase-1-complete`)
8. Phase 2: in progress → **COMPLETED**, archived and tagged `fase-2-complete`
9. Phase 3: explicitly recorded as **NOT STARTED**; no change directory created
10. Strict TDD modules: added `services`
11. Conventions added: money CLP Int, no `import type` on decorated classes, pnpm-only, `@/` aliases, engine-strict
12. CI workflow verified at `.github/workflows/ci.yml`
13. Engram context cached (obs #18, #32, #33)

---

**Summary:** Vetary is initialized and refreshed for the SDD workflow. Strict TDD is ACTIVE. Testing capabilities verified (14/111 unit, 4/27 integration, 3/15 E2E). Phase 1 and Phase 2 are complete; Phase 3 Bookings is not started. Ready for Phase 3 exploration.

**Test command:** `pnpm --filter vetary-api test`  
**Strict TDD modules:** auth, tenants, repositories, bookings, services  
**Standard Mode:** DTOs, controllers, configuration, migrations
