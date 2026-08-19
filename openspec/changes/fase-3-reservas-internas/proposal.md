# Proposal: Internal Bookings (ADMIN/STAFF)

## Intent

Let ADMIN/STAFF create and manage bookings against a vet's weekly availability. Introduces the
`Booking` model, status state machine, and double-booking protection that
`fase-3-reservas-publicas` will reuse.

## Branch / PR Boundary

- PR-1 branch `feat/fase-3-internas-pr1-foundation`; PR targets `develop`. Each later slice uses
  its own `feat/fase-3-internas-prN-*` branch and also targets `develop`.
- Independent artifacts; tasks start at T-001.
- Phase tag `fase-3-complete` is created only after BOTH changes close (see ADR-004).

## Scope

### In Scope

- `BookingStatus` enum + `Booking` model + one migration.
- `endTime` derived from `Service.durationMinutes`; caller never supplies it.
- Overlap protection: reject non-cancelled bookings for the same vet/tenant whose intervals
  overlap (any start time); cancelled bookings never block.
- Availability fit: derived interval must fit the vet's block (day-of-week, tenant timezone).
- State machine: Prisma `BookingStatus` enum + pure transition policy map (no domain entity).
- Availability deletion blocked only by future NON-cancelled bookings; atomic check + delete.
- RBAC: ADMIN/STAFF create/manage; VET reads own agenda; isolation via `BaseRepository`.
- Strict TDD (`bookings` is a `strict_tdd_modules` entry).

### Out of Scope

- `CLIENT` role, client registration, public booking (→ `fase-3-reservas-publicas`).
- `Pet` model (→ Phase 4); `petName` is a required string placeholder.
- Observer/Factory patterns, notifications, calendar/dashboard UI.

## Capabilities

### New Capabilities

- `bookings`: model + enum, interval derivation, overlap invariant, availability fit, policy,
  RBAC, isolation.

### Modified Capabilities

- `vet-weekly-availability`: deletion 409 on future non-cancelled bookings; cancelled don't
  block; atomic check + delete.

## Approach

Four-layer convention. `BookingRepository` extends `BaseRepository`; `BookingService` derives
`endTime`, validates overlap + availability fit inside `prisma.$transaction`, applies the
transition policy (`Record<BookingStatus, BookingStatus[]>`). Pure, unit-testable policy; future
Observer extraction point. No domain entity classes (matches repo).

## Affected Areas

| Area | Impact |
|------|--------|
| `vetary-api/prisma/schema.prisma` | New (`BookingStatus`, `Booking`) |
| `vetary-api/src/modules/bookings/**` | New module |
| `vetary-api/src/modules/availability/**` | Modified (delete-guard) |
| `vetary-api/src/app.module.ts` | Modified (register module) |
| `vetary-api/test/**` | New (unit/integration/E2E) |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Concurrent overlap race | Med | atomic transaction + dedicated test |
| Timezone/DST slot mapping | High | edge-case unit tests; `Tenant.timezone` |
| `petName` → `Pet` debt | Low | documented; Phase 4 migrates |
| Scope creep | Med | strict slice |

## Rollback Plan

Additive migration (new table + enum). Revert = `git revert` + drop `bookings`/`BookingStatus`.
Availability delete-guard is additive; no existing schema altered destructively.

## Dependencies

- Phase 2 complete (`Service`, `VetAvailability`, `VetProfile`, RBAC decorators).

## Success Criteria

- [ ] Booking created with derived `endTime` (201).
- [ ] Overlapping non-cancelled bookings (different start times) rejected — dedicated test.
- [ ] Cancelled booking blocks neither new booking nor availability deletion.
- [ ] Availability delete returns 409 when future non-cancelled bookings exist.
- [ ] State machine allows only valid transitions.
- [ ] VET sees own agenda only; cross-tenant isolation verified.
- [ ] Strict TDD green; Biome + `tsc` clean.
