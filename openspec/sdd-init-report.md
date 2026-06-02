# Vetary — SDD Init Report
**Generated:** 2026-05-31  
**Project:** vetary  
**Phase:** sdd-init  
**Status:** ✅ Complete

---

## Executive Summary

SDD initialization complete for Vetary, a multi-tenant SaaS platform for veterinary clinic management. Project context saved to openspec with strict TDD mode activated due to critical authentication and multi-tenant data isolation requirements.

**Key Findings:**
- **Testing capabilities:** Jest (backend) + Vitest (frontend) detected from stack specifications
- **Strict TDD:** ACTIVE — mandatory for auth and tenant isolation logic
- **Test command:** `cd vetary-api && npm run test`
- **Code status:** Empty directories (documentation complete, implementation Phase 1 ready to start)
- **Architecture:** 4-layer architecture with mandatory Repository pattern for tenant filtering

---

## 1. Stack Detection

### Backend (vetary-api/)
- **Runtime:** Node.js 22
- **Framework:** NestJS with TypeScript strict mode
- **Database:** PostgreSQL (via Docker)
- **ORM:** Prisma
- **Auth:** JWT with refresh tokens
- **Validation:** class-validator + class-transformer
- **Testing:** Jest (standard for NestJS)

### Frontend (vetary-web/)
- **Framework:** React 18 with TypeScript strict mode
- **Build tool:** Vite
- **State (server):** TanStack Query v5
- **State (client):** Zustand
- **Routing:** React Router v6
- **UI/Styles:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest (modern Vite-based test runner)

---

## 2. Testing Capabilities

### Backend Testing Stack
- **Framework:** Jest
- **Test types:**
  - Unit tests for business logic (services, factories, domain entities)
  - Integration tests for repositories (verify tenant isolation)
  - E2E tests for critical auth flows
- **Coverage requirements:**
  - Auth logic: 100%
  - Multi-tenant isolation: 100%
  - Business rules: ≥80%
- **Test location:** `vetary-api/src/**/*.spec.ts`
- **Test command:** `cd vetary-api && npm run test`
- **Watch mode:** `cd vetary-api && npm run test:watch`
- **Coverage:** `cd vetary-api && npm run test:cov`

### Frontend Testing Stack
- **Framework:** Vitest
- **Test types:**
  - Component tests for UI logic
  - Hook tests for state management
  - Service tests for API calls (mocked)
- **Test location:** `vetary-web/src/**/*.test.tsx`
- **Test command:** `cd vetary-web && npm run test`
- **Watch mode:** `cd vetary-web && npm run test:watch`

---

## 3. Strict TDD Mode: ACTIVE

### Why Strict TDD is mandatory for Vetary

**Critical security and isolation requirements:**

1. **Authentication logic** — password hashing, JWT generation, refresh token rotation, role-based access control
   - **Risk if untested:** Unauthorized access, token leakage, privilege escalation
   - **TDD requirement:** Every auth flow MUST have tests BEFORE implementation

2. **Multi-tenant data isolation** — every database query MUST filter by `tenantId`
   - **Risk if untested:** Data leakage between tenants (catastrophic business and legal failure)
   - **TDD requirement:** Every repository method MUST have integration tests verifying tenant isolation BEFORE implementation

3. **Domain state transitions** — booking status flow (Pendiente → Confirmada → En curso → Completada)
   - **Risk if untested:** Invalid state transitions, broken business rules
   - **TDD requirement:** Every state transition MUST have tests BEFORE implementation

### Strict TDD Protocol

1. **Test BEFORE code** — no exceptions for critical modules (auth, tenants, bookings, repositories)
2. **Test runner configured from Phase 1** — Jest setup happens BEFORE first feature
3. **CI integration** — tests run on every commit (configured in Phase 6)
4. **Coverage tracking** — critical modules require 100% coverage (auth, multi-tenant isolation)

### Non-strict modules (Standard Mode allowed)

- UI components without business logic
- Configuration files
- Database migrations
- Documentation

---

## 4. Architecture Context

### 4-Layer Architecture (Layered Architecture)

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│   Controllers · Guards · Interceptors   │
│   (HTTP in, HTTP out — nothing else)    │
├─────────────────────────────────────────┤
│         APPLICATION LAYER               │
│   Services · Use Cases · DTOs           │
│   (orchestrates logic, doesn't contain) │
├─────────────────────────────────────────┤
│           DOMAIN LAYER                  │
│   Entities · Business Rules · Events    │
│   (the heart — knows no HTTP or DB)     │
├─────────────────────────────────────────┤
│       INFRASTRUCTURE LAYER              │
│   Repositories · Prisma · External APIs │
│   (everything touching the outside)     │
└─────────────────────────────────────────┘
```

**Dependency rule (inviolable):**
```
Presentation → Application → Domain
Infrastructure → Domain (implements domain interfaces)
```

### Multi-Tenant Strategy

- **Approach:** Shared database, shared schema with `tenantId` column
- **Isolation mechanism:** Every query filtered in BaseRepository
- **Tenant context flow:**
  ```
  HTTP Request
      ↓
  TenantMiddleware (extracts tenantId from subdomain or JWT)
      ↓
  TenantContext (available via AsyncLocalStorage)
      ↓
  BaseRepository (every query includes WHERE tenantId = :tenantId)
      ↓
  Response
  ```

**Golden rule:** No repository can execute a query without the tenantId filter.

---

## 5. Design Patterns (Expected)

These patterns will appear when the problem demands them, not for "best practice":

### Repository Pattern (Phase 1)
- **Problem:** Prisma scattered across services → ORM change touches everything; tenant filter can be forgotten
- **Solution:** One repository per entity encapsulating all data access
- **Where:** Every module from Phase 1
- **Testing:** Integration tests verify tenant isolation

### Factory Pattern (Phase 3)
- **Problem:** Creating bookings differs by service type (routine vs emergency vs surgery)
- **Solution:** BookingFactory returns the correct initialized object
- **Where:** bookings module

### Observer Pattern / Domain Events (Phase 3)
- **Problem:** Booking state change triggers multiple actions (update patient record, notify vet, log history)
- **Solution:** State change emits domain event; other modules listen independently
- **Where:** bookings module, state transition logic

### Strategy Pattern (Phase 2)
- **Problem:** Availability calculation varies by service type
- **Solution:** AvailabilityStrategy interface with implementations per service type
- **Where:** availability module

### Decorator Pattern (Phase 1)
- **Problem:** Auth, roles, and tenant metadata on routes
- **Solution:** Custom decorators @CurrentTenant(), @Roles(), @Public()
- **Where:** common/decorators

---

## 6. Conventions Summary

### TypeScript (Universal)
- Strict mode: ON
- No `any` (use `unknown` and cast with explanation)
- Explicit return types on all functions
- Types defined at origin, imported where used

### Backend (NestJS)
- Files/folders: kebab-case (`create-user.dto.ts`)
- Classes: PascalCase (`BookingService`, `BookingRepository`)
- Module structure: dto/ entities/ repositories/ services/ controllers/ [feature].module.ts
- Controllers: HTTP only, zero business logic
- Services: orchestrate, never touch Prisma directly
- Repositories: data access only, no business logic
- DTOs: class-validator decorators, validated by global ValidationPipe

### Frontend (React)
- Feature-based modules (`features/[feature]/`)
- 3-layer separation: services → hooks → components
- Components: PascalCase (`BookingForm.tsx`)
- Hooks: camelCase with `use` prefix (`useBooking.ts`)
- **Critical:** Never import `axios` directly — always use `shared/lib/apiClient`
- Auth interceptor in `request` (not `response`), token read dynamically
- TanStack Query for server state, Zustand only for UI state
- React Hook Form + Zod for forms

### Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- One commit per logical unit
- Never commit `.env`, credentials, or `node_modules`
- Branch strategy: `main` ← `develop` ← `feature/[name]`

---

## 7. Security Baseline (Pre-Feature)

Before implementing the first feature, the following MUST be configured:

### Backend (`main.ts`)
- ✅ Helmet (HTTP security headers)
- ✅ CORS from env var (never `*` in production)
- ✅ Global ValidationPipe with `whitelist: true`, `forbidNonWhitelisted: true`
- ✅ Environment variable validation at startup (fail fast if secrets missing)
- ✅ Swagger/OpenAPI documentation
- ✅ Rate limiting on auth endpoints

### Multi-Tenant Isolation
- ✅ BaseRepository enforces tenantId filter on all queries
- ✅ Integration tests verify cross-tenant queries fail
- ✅ TenantMiddleware extracts and validates tenant context

### Auth
- ✅ Passwords hashed with bcrypt (cost factor ≥10)
- ✅ JWT secret from environment, never hardcoded
- ✅ Refresh token rotation implemented
- ✅ Role-based guards with decorators

---

## 8. Phase 1 Readiness

### What Phase 1 will build
- Tenant registration and onboarding
- JWT-based authentication (login, logout, refresh, password recovery)
- Role management (SuperAdmin, Admin, Staff, Veterinarian, Client)
- BaseRepository with tenant isolation
- Auth guards and decorators
- Database schema with multi-tenant foundation

### Testing requirements for Phase 1
**Strict TDD applies to:**
- Auth service (login, register, token generation, password hashing)
- Tenant service (creation, subdomain validation)
- BaseRepository (tenant filter enforcement)
- Auth guards (role-based access, tenant isolation)

**Standard Mode allowed for:**
- DTOs (validated by class-validator at runtime)
- Controllers (thin HTTP handlers)
- Module wiring

### Acceptance Criteria (from SPEC.md)
- ✅ A tenant can register and receive their subdomain
- ✅ An admin can log in to their tenant
- ✅ The system rejects tokens from one tenant accessing another tenant's data
- ✅ Role-protected routes work correctly

---

## 9. Next Recommended Actions

### Immediate (orchestrator)
1. ✅ Init complete — context saved to openspec/config.yaml
2. Await user confirmation to proceed with Phase 1

### Phase 1 Setup (when authorized)
1. Initialize NestJS project (`nest new vetary-api`)
2. Configure Jest with strict coverage requirements
3. Install dependencies (Prisma, class-validator, passport-jwt, bcrypt, helmet)
4. Create Prisma schema with Tenant and User models
5. Implement BaseRepository with tenant isolation
6. Write integration tests for BaseRepository (verify cross-tenant queries fail)
7. Implement auth module (TDD: tests before implementation)

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Tenant data leakage** | Catastrophic (legal, business) | Strict TDD for all repository methods; integration tests verify isolation |
| **Auth vulnerabilities** | High (unauthorized access) | Strict TDD for auth flows; manual security review before Phase 1 close |
| **Missing test coverage** | Medium (bugs in production) | Coverage tracking enforced; CI blocks merges below thresholds |
| **Frontend breaks in production** | Medium (user-facing failures) | `apiClient` configuration enforced; auth interceptor tested |
| **State explosion** | Low (complexity creep) | TanStack Query for server state only; Zustand minimal |

---

## 11. Artifacts Created

**OpenSpec:**
- Config: `openspec/config.yaml`
- Report: `openspec/sdd-init-report.md`
- Artifact store: openspec (engram unavailable in this session)

**Files read:**
- `/home/j4v0/DEV/projects/vetary/SPEC.md`
- `/home/j4v0/DEV/projects/vetary/ARCHITECTURE.md`
- `/home/j4v0/DEV/projects/vetary/vetary-api/STACK-nestjs.md`
- `/home/j4v0/DEV/projects/vetary/vetary-web/STACK-react.md`

---

## 12. Skill Resolution

**Status:** `none`

**Reason:** Init phase does not require project-specific skills beyond stack conventions. Skills are loaded from:
- Stack conventions: `STACK-nestjs.md` and `STACK-react.md` (read directly)
- Universal principles: `AGENTS.md` (project instructions)

**Skill registry:** Not required for init phase (no code reading/writing/review).

---

## Summary

Vetary is **fully initialized** for SDD workflow. Strict TDD mode is **ACTIVE** for critical modules (auth, multi-tenant isolation, domain state transitions). Testing capabilities detected and saved to openspec configuration. Phase 1 is **ready to start** upon user authorization.

**Test command for backend:** `cd vetary-api && npm run test`  
**Strict TDD modules:** auth, tenants, repositories, bookings  
**Standard Mode allowed:** DTOs, controllers, configuration, UI components  

All project context (stack, architecture, conventions, security baseline) has been saved to `openspec/config.yaml`.

---

**Next step:** Await orchestrator confirmation to proceed with Phase 1 (Auth + Multi-tenancy foundation).
