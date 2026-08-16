# Tasks: Fase 2 — Clinic Configuration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~630 actual (PR-1: ~260 code + ~277 tests + schema) |
| 400-line budget risk | High (native ledger measured 974 changed lines for PR-2) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

### PR-3 Functional Budget

PR-3 (T-010 to T-014) has a functional estimate of approximately 220 changed lines.
This budget excludes repository-wide formatting/normalization commits and does not inherit
the PR-2 candidate's 4,999-line quality baseline.

Retrospective: PR-1 measured ~630 lines, PR-2 measured 974 lines, and PR-3 measured
1,210 lines. Future functional estimates MUST include production code, tests, fixtures,
configuration, and OpenSpec artifacts; quality sweeps remain separate changes.
Fase 3 MUST split large work into functional units of at most 400 measured lines.

Decision needed before apply: Yes — maintainer decision required before runtime settle
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain — accumulate in feature/fase-2, merge to develop after PR-3
400-line budget risk: High (native ledger measured 974 changed lines)

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema & services module | PR 1 | Base for clinic configuration, includes tests |
| 2 | Extend users with vets/staff and vet profile | PR 2 | Depends on PR 1, includes atomic creation logic and tests |
| 3 | Availability module and overlap validation | PR 3 | Final module with scheduling and E2E tests |

## Phase 1: Database Schema & Services Module (PR 1) — COMPLETED

- [x] T-001: Add Prisma models for Service, VetProfile, VetAvailability, and add timezone to Tenant model
  - Acceptance: Migration generated and tested locally; schema.prisma updated
  - Est. lines: 60 | Actual: 82 lines changed in schema
  - Dependencies: None
  - Files: `vetary-api/prisma/schema.prisma`
  - Tests required: No
  - Status: ✅ Committed (0889067)

- [x] T-002: Implement BaseRepository extension for ServiceRepository
  - Acceptance: Tenant isolation enforced; unit tested repository methods
  - Est. lines: 40 | Actual: ~78 lines
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/services/repositories/service.repository.ts`
  - Tests required: Yes (unit) — 6 tests written and passing
  - Status: ✅ Committed (a97b76c)

- [x] T-003: Create ServicesService with CRUD and validation per spec
  - Acceptance: Positive duration and price; soft-delete logic; tenant scoped
  - Est. lines: 60 | Actual: ~93 lines + bugfix (description ?? null)
  - Dependencies: T-002
  - Files: `vetary-api/src/modules/services/services/service.service.ts`
  - Tests required: Yes (unit, integration) — 6 integration tests passing
  - Status: ✅ Committed (a97b76c + 2e59f4f)

- [x] T-004: Create ServicesController with endpoints: POST, GET, PATCH, DELETE (soft disable)
  - Acceptance: API guards, decorators, input validation, swagger doc
  - Est. lines: 60 | Actual: ~97 lines (controller) + 62 lines (DTOs)
  - Dependencies: T-003
  - Files: `vetary-api/src/modules/services/controllers/service.controller.ts`, `dto/*.ts`
  - Tests required: Yes (integration)
  - Status: ✅ Committed (a97b76c)

- [x] T-005: Write core integration tests for service lifecycle, tenant isolation, and validation
  - Acceptance: Cover create, update, disable, list with tenant isolation verified
  - Est. lines: 40 | Actual: ~140 lines (6 unit + 6 integration tests)
  - Dependencies: T-004
  - Files: `vetary-api/test/unit/services/service.repository.spec.ts`, `test/integration/services/service.service.spec.ts`
  - Tests required: Yes (integration)
  - Status: ✅ Committed (2e59f4f)

**PR-1 Total**: 3 commits, ~630 lines; unit: 12 suites / 98 tests passing; E2E: 2 suites / 8 tests passing
**PR-1 Branch**: `feature/fase-2-pr1-services` created from develop

## Phase 2: Extend Users Module & Vet Profiles (PR 2)

- [x] T-006: Add VetProfileRepository extending BaseRepository
  - Acceptance: Proper tenant scoping and CRUD support
  - Est. lines: 30 | Actual: ~68 lines
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/vet-profiles/repositories/vet-profile.repository.ts`, `vetary-api/src/modules/vet-profiles/vet-profiles.module.ts`
  - Tests required: Yes (unit) — 8 tests passing
  - Status: ✅ Completed (c918510; schema correction 64324b1)

- [x] T-007: Implement createVet atomic transaction with the Prisma transaction client
  - Acceptance: Atomically create User, UserTenant, and VetProfile; rollback on failure. Atomic writes use the Prisma transaction client; VetProfileRepository remains available for tenant-scoped read paths.
  - Est. lines: 50 | Actual: ~95 lines
  - Dependencies: T-006
  - Files: `vetary-api/src/modules/users/services/user.service.ts`, `vetary-api/src/modules/users/dto/create-vet.dto.ts`
  - Tests required: Yes (integration) — 4 createVet tests passing (10 total in user.service.spec.ts)
  - Status: ✅ Completed (3f14c47; schema correction 64324b1)

- [x] T-008: Extend UserController with POST /users/vets and POST /users/staff with role enforcement
  - Acceptance: Admin-only via @Roles, validation, swagger, reuse existing user creation logic
  - Est. lines: 40 | Actual: ~50 lines
  - Dependencies: T-007
  - Files: `vetary-api/src/modules/users/controllers/user.controller.ts`, `vetary-api/src/modules/users/dto/create-staff.dto.ts`
  - Tests required: Yes (integration)
  - Status: ✅ Completed (1cb574d)

- [x] T-009: Write real PostgreSQL integration coverage and controller unit tests for vets/staff creation
  - Acceptance: Real PostgreSQL integration covers successful persistence, rollback on failure, existing email reuse across tenants, and tenant isolation; controller unit tests cover HTTP role enforcement and request handling
  - Est. lines: 40 | Actual: ~78 lines
  - Dependencies: T-008
  - Files: `vetary-api/test/integration/users.integration.spec.ts` (real PostgreSQL integration), `vetary-api/test/unit/users/user.controller.spec.ts` (controller unit tests)
  - Tests required: Yes — integration: 1 suite / 4 tests passing; controller unit: 1 suite / 4 tests passing
  - Status: ✅ Completed (043aa9b)

## Phase 3: Availability Module and Overlap Validation (PR 3)

- [x] T-010: Implement AvailabilityRepository extending BaseRepository
  - Acceptance: Tenant scoped CRUD; basic validation support
  - Est. lines: 30
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/availability/repositories/availability.repository.ts`
  - Tests required: Yes (unit) — 5 tests passing
  - Status: ✅ Completed

- [x] T-011: Create AvailabilityService with weekly recurring schedule support and overlap validation logic
  - Acceptance: Reject overlapping or cross-midnight blocks; tenant isolation
  - Est. lines: 60
  - Dependencies: T-010
  - Files: `vetary-api/src/modules/availability/services/availability.service.ts`
  - Tests required: Yes (unit, integration) — 7 service tests passing
  - Status: ✅ Completed

- [x] T-012: Build AvailabilityController with list, create, delete endpoints and RBAC guards
  - Acceptance: Admin-only for writes; correct validation and swagger docs
  - Est. lines: 50
  - Dependencies: T-011
  - Files: `vetary-api/src/modules/availability/controllers/availability.controller.ts`
  - Tests required: Yes (integration)
  - Status: ✅ Completed

- [x] T-013: Write integration tests for availability module including overlap and tenant isolation
  - Acceptance: Check multiple slots, conflict rejection, unauthorized access
  - Est. lines: 40
  - Dependencies: T-012
  - Files: `vetary-api/test/integration/availability.integration.spec.ts`
  - Tests required: Yes (integration) — 8 real PostgreSQL tests passing
  - Status: ✅ Completed

- [x] T-014: Write E2E tests for /users/vets and /availability workflows
  - Acceptance: End-to-end flows with multi-table transaction and conflict errors
  - Est. lines: 40
  - Dependencies: T-009, T-013
  - Files: `vetary-api/test/e2e/clinic-config.e2e-spec.ts`
  - Tests required: Yes (E2E) — 7 E2E tests passing
  - Status: ✅ Completed

## Summary

- Total tasks: 14 (14 completed, 0 remaining)
- PR-1: COMPLETED (~630 lines; historical unit: 12 suites / 98 tests; E2E: 2 suites / 8 tests; Prisma migration status at completion: 1 migration found and database schema up to date)
- PR-2: COMPLETED (T-006 to T-009; current Jest: 15 suites / 118 tests passing; E2E: 2 suites / 8 tests passing; focused PostgreSQL integration: 1 suite / 4 tests; controller unit: 1 suite / 4 tests; Prisma: 2 migrations found and database schema up to date)
- PR-3: COMPLETED (T-010 to T-014; current Jest: 14 suites / 111 tests passing; integration: 4 suites / 27 tests passing; E2E: 3 suites / 15 tests passing; Prisma 5.22.0; Biome: 0 errors/warnings; TypeScript: 0 errors)
- Chain strategy: feature-branch-chain (accumulate in feature/fase-2, merge to develop after PR-3)

## Recommended Next Action

- Run `sdd-verify` for change `fase-2-configuracion-clinica`
- Prepare PR-3 for review under feature-branch-chain strategy
