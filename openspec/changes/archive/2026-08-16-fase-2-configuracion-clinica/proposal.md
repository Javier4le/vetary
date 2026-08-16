# Proposal: Fase 2 — Clinic Configuration

## Intent
Enable clinic setup before Phase 3 bookings.

## Scope
### In Scope
- Service CRUD with `isActive`, CLP integer price.
- Single-step STAFF/VET account creation + role assignment.
- Per-vet weekly recurring availability with multiple blocks/day.
- One clinic timezone shared by all vets.
- RBAC, tenant isolation, Swagger, core tests.

### Out of Scope
- Audit trail/versioning, staff profile fields, per-vet timezone, exports, frontend UI.

## Capabilities
### New Capabilities
- `clinic-services`: service lifecycle and CLP pricing.
- `users/vets`: extend `users/` module with `POST /users/vets` — single-step creation of VET account + VetProfile (atomic transaction).
- `users/staff`: convenience wrapper `POST /users/staff` (role=STAFF fixed) over existing `POST /users`.
- `vet-weekly-availability`: recurring multi-block schedule per vet.

### Modified Capabilities
- `users/` module: extended with sub-resource endpoints for vet and staff creation.

## Approach
- Prisma: add `Service`, `VetAvailability`, `VetProfile`, tenant timezone (if absent); reuse `User` + `UserTenant` roles.
- NestJS modules:
  - `services`: new module for clinic service catalog.
  - **Extend `users/` module**: add `POST /users/vets` (creates User + UserTenant + VetProfile atomically via Prisma $transaction) and `POST /users/staff` (convenience wrapper).
  - `availability`: new module for weekly recurring schedules.
- DTO validation via class-validator; `BaseRepository` for tenant isolation; admin-only endpoints via `@Roles(Role.ADMIN)`.
- Service rules: positive duration, CLP integer price, non-overlap blocks, same-tenant vet binding, soft-disable only.

## Business Rules
- Staff scope is access-only.
- Multiple daily blocks are required from day 1.
- Single timezone per clinic.
- Services are soft-disabled (`isActive`); no hard delete with bookings.
- DoD: CRUD + validation + RBAC + tenant isolation + Swagger + core tests.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `vetary-api/prisma/schema.prisma` | Modified | New Phase 2 models/relations (`Service`, `VetProfile`, `VetAvailability`) |
| `vetary-api/src/modules/services/**` | New | Service CRUD module |
| `vetary-api/src/modules/users/` | Modified | Extended with `POST /users/vets` (atomic) and `POST /users/staff` endpoints |
| `vetary-api/src/modules/availability/**` | New | Weekly schedules module |
| `vetary-api/test/**` | Modified | Core integration/E2E coverage for all new endpoints |

## Edge Cases
- Overlap or cross-midnight availability blocks.
- Duplicate weekday ranges.
- Existing email collisions and role reassignment conflicts.
- Disabled services referenced by future booking creation.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Availability rule bugs | Med | overlap validation + unit/E2E tests |
| Tenant leakage | Low | BaseRepository + isolation integration tests |
| `isActive` semantics confusion | Med | explicit Swagger examples |

## Rollback Plan
Revert Phase 2 modules/controllers, rollback Prisma migration, keep Phase 1 foundation unchanged.

## Success Criteria
- [ ] Service CRUD works with CLP integer price and soft-disable.
- [ ] STAFF/VET access creation works in one step with RBAC.
- [ ] Weekly recurring multi-block schedules work per vet under clinic timezone.
- [ ] Unit/integration/E2E core tests pass, including tenant isolation.
- [ ] Swagger covers all Phase 2 endpoints and constraints.

## First Slice / PR Boundaries (C3 + D1)
1. **PR-1 (Schema + Service catalog)**: Prisma schema changes + `services` module + tests.
2. **PR-2 (Extend users/ + VetProfile)**: Extend `users/` module with `POST /users/vets` (atomic: User + UserTenant + VetProfile) + `POST /users/staff` + RBAC tests.
3. **PR-3 (Availability)**: `availability` module + weekly recurring multi-block scheduling + overlap validation + E2E flow.
