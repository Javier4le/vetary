# Tasks: Fase 2 — Clinic Configuration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350 - 390 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema & services module | PR 1 | Base for clinic configuration, includes tests |
| 2 | Extend users with vets/staff and vet profile | PR 2 | Depends on PR 1, includes atomic creation logic and tests |
| 3 | Availability module and overlap validation | PR 3 | Final module with scheduling and E2E tests |

## Phase 1: Database Schema & Services Module (PR 1)

- [ ] T-001: Add Prisma models for Service, VetProfile, VetAvailability, and add timezone to Tenant model
  - Acceptance: Migration generated and tested locally; schema.prisma updated
  - Est. lines: 60
  - Dependencies: None
  - Files: `vetary-api/prisma/schema.prisma`
  - Tests required: No

- [ ] T-002: Implement BaseRepository extension for ServiceRepository
  - Acceptance: Tenant isolation enforced; unit tested repository methods
  - Est. lines: 40
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/services/service.repository.ts`
  - Tests required: Yes (unit)

- [ ] T-003: Create ServicesService with CRUD and validation per spec
  - Acceptance: Positive duration and price; soft-delete logic; tenant scoped
  - Est. lines: 60
  - Dependencies: T-002
  - Files: `vetary-api/src/modules/services/service.service.ts`
  - Tests required: Yes (unit, integration)

- [ ] T-004: Create ServicesController with endpoints: POST, GET, PATCH, DELETE (soft disable)
  - Acceptance: API guards, decorators, input validation, swagger doc
  - Est. lines: 60
  - Dependencies: T-003
  - Files: `vetary-api/src/modules/services/service.controller.ts`
  - Tests required: Yes (integration)

- [ ] T-005: Write core integration tests for service lifecycle, tenant isolation, and validation
  - Acceptance: Cover create, update, disable, list with tenant isolation verified
  - Est. lines: 40
  - Dependencies: T-004
  - Files: `vetary-api/test/integration/services.integration.spec.ts`
  - Tests required: Yes (integration)

## Phase 2: Extend Users Module & Vet Profiles (PR 2)

- [ ] T-006: Add VetProfileRepository extending BaseRepository
  - Acceptance: Proper tenant scoping and CRUD support
  - Est. lines: 30
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/vet-profiles/vet-profile.repository.ts`
  - Tests required: Yes (unit)

- [ ] T-007: Modify UserService to inject VetProfileRepository and implement createVet atomic transaction
  - Acceptance: Atomically create User, UserTenant, and VetProfile; rollback on failure
  - Est. lines: 50
  - Dependencies: T-006
  - Files: `vetary-api/src/modules/users/services/user.service.ts`
  - Tests required: Yes (integration)

- [ ] T-008: Extend UserController with POST /users/vets and POST /users/staff with role enforcement
  - Acceptance: Admin-only via @Roles, validation, swagger, reuse existing user creation logic
  - Est. lines: 40
  - Dependencies: T-007
  - Files: `vetary-api/src/modules/users/controllers/user.controller.ts`
  - Tests required: Yes (integration)

- [ ] T-009: Write integration tests for vets/staff creation, existing email reuse, role enforcement, tenant isolation
  - Acceptance: Test rollback on failure, valid data paths, and error cases
  - Est. lines: 40
  - Dependencies: T-008
  - Files: `vetary-api/test/integration/users.integration.spec.ts`
  - Tests required: Yes (integration)

## Phase 3: Availability Module and Overlap Validation (PR 3)

- [ ] T-010: Implement AvailabilityRepository extending BaseRepository
  - Acceptance: Tenant scoped CRUD; basic validation support
  - Est. lines: 30
  - Dependencies: T-001
  - Files: `vetary-api/src/modules/availability/availability.repository.ts`
  - Tests required: Yes (unit)

- [ ] T-011: Create AvailabilityService with weekly recurring schedule support and overlap validation logic
  - Acceptance: Reject overlapping or cross-midnight blocks; tenant isolation
  - Est. lines: 60
  - Dependencies: T-010
  - Files: `vetary-api/src/modules/availability/availability.service.ts`
  - Tests required: Yes (unit, integration)

- [ ] T-012: Build AvailabilityController with list, create, delete endpoints and RBAC guards
  - Acceptance: Admin-only for writes; correct validation and swagger docs
  - Est. lines: 50
  - Dependencies: T-011
  - Files: `vetary-api/src/modules/availability/availability.controller.ts`
  - Tests required: Yes (integration)

- [ ] T-013: Write integration tests for availability module including overlap and tenant isolation
  - Acceptance: Check multiple slots, conflict rejection, unauthorized access
  - Est. lines: 40
  - Dependencies: T-012
  - Files: `vetary-api/test/integration/availability.integration.spec.ts`
  - Tests required: Yes (integration)

- [ ] T-014: Write E2E tests for /users/vets and /availability workflows
  - Acceptance: End-to-end flows with multi-table transaction and conflict errors
  - Est. lines: 40
  - Dependencies: T-009, T-013
  - Files: `vetary-api/test/e2e/clinic-config.e2e-spec.ts`
  - Tests required: Yes (E2E)

## Summary

- Total tasks: 14
- Estimated total lines changed: ~490 (allowing overlap with tests)
- PR sizes respect 400-line per PR budget
- Delivery strategy requires user decision on chain strategy (stacked vs feature branch)

## Recommended Next Action

- Present tasks and forecast to the user for review and chain strategy decision before implementation starts.
