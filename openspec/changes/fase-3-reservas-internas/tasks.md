# Tasks: Internal Bookings (ADMIN/STAFF)

## Review Workload Forecast

Estimated changed lines: ~1,170
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Test | Harness | Rollback |
|---|---|---|---|---|---|
| 1 T-001..T-003 | schema+dep+migration | PR1 | prisma migrate status | migrate dev local PG | revert schema+migration |
| 2 T-004..T-007 | transitions+tz | PR2 | unit jest | N/A pure fns | delete 4 files |
| 3 T-008..T-011 | repo+create+lock | PR3 | integration concurrent | real PG race N=8 | revert repo+service |
| 4 T-012..T-016 | status+DTOs+ctrl+wiring | PR4 | integration crud | real PG RBAC | revert ctrl+DTOs |
| 5 T-017..T-018 | availability guard | PR5 | integration guard | real PG guard cases | revert availability |
| 6 T-019..T-020 | E2E+gates | PR6 | e2e+full suites | HTTP happy path | N/A verify only |

Delivery strategy: six independent PRs, each using its own branch and targeting `develop` in
order. Merge each slice before creating the next branch; no branch accumulates multiple slices.

Branches:
- PR1 / T-001..T-003: `feature/fase-3-internas-pr1-foundation`
- PR2 / T-004..T-007: `feature/fase-3-internas-pr2-rules`
- PR3 / T-008..T-011: `feature/fase-3-internas-pr3-concurrency`
- PR4 / T-012..T-016: `feature/fase-3-internas-pr4-http`
- PR5 / T-017..T-018: `feature/fase-3-internas-pr5-availability`
- PR6 / T-019..T-020: `feature/fase-3-internas-pr6-e2e`

After PR6 merges, start `feature/fase-3-publicas-pr1-foundation` for the next OpenSpec change.

## Phase 1: Foundation

- [x] T-001 — vetary-api/package.json — add luxon + @types/luxon; ⇒ pnpm list luxon; ~2
- [x] T-002 — vetary-api/prisma/schema.prisma — BookingStatus+Booking: req petName, snapshots, UTC instants, notes 1000, 2 indexes; ⇒ generate+format; ~55
- [x] T-003 (T-002) — vetary-api/prisma/migrations/<ts>_add_bookings — migrate dev add_bookings, additive; ⇒ migrate status; ~45

## Phase 2: Pure Rules

- [x] T-004 — vetary-api/test/unit/bookings/booking-transitions.spec.ts — RED (from,to) matrix + no-auto (D7); ⇒ fails; ~55
- [x] T-005 (T-004) — vetary-api/src/modules/bookings/services/booking-transitions.ts — GREEN map+canTransition; ⇒ green; ~15
- [x] T-006 — vetary-api/test/unit/bookings/booking-time.spec.ts — RED gap/ambiguity Santiago, adjacency, fit, bad HH:mm; ⇒ fails; ~90
- [x] T-007 (T-006) — vetary-api/src/modules/bookings/services/booking-time.ts — GREEN fromWallClock luxon (D2); ⇒ green; ~60

## Phase 3: Repository + Service

- [ ] T-008 (T-003) — vetary-api/test/integration/bookings/booking-crud.spec.ts — RED repo isolation B10; ⇒ fails; ~80
- [ ] T-009 (T-008) — vetary-api/src/modules/bookings/repositories/booking.repository.ts — GREEN BaseRepository+tx-aware; ⇒ green; ~50
- [ ] T-010 (T-003) — vetary-api/test/integration/bookings/concurrent-booking.spec.ts — RED N=8 one 201/seven 409/count 1; ⇒ fails; ~85
- [ ] T-011 (T-007,T-009) — vetary-api/src/modules/bookings/services/booking.service.ts — GREEN create(): endTime derived, $transaction+advisory lock, half-open overlap, fit (D4); ⇒ green; ~130
- [ ] T-012 (T-011) — vetary-api/src/modules/bookings/services/booking.service.ts — GREEN list/findOne/updateStatus+policy+400/403/404/409; ⇒ green; ~90

## Phase 4: HTTP + Wiring

- [ ] T-013 — vetary-api/src/modules/bookings/dto/create-booking.dto.ts + update-booking-status.dto.ts — no endTime, petName req, notes max1000 trim; ⇒ e2e; ~40
- [ ] T-014 (T-013) — vetary-api/test/integration/bookings/booking-crud.spec.ts — RED VET own-agenda/narrow transitions, create/cancel 403, cross-tenant 403; ⇒ fails; ~60
- [ ] T-015 (T-012,T-014) — vetary-api/src/modules/bookings/controllers/booking.controller.ts — GREEN routes+@Roles(ADMIN,STAFF)+VET scope; ⇒ green; ~70
- [ ] T-016 (T-015) — vetary-api/src/modules/bookings/bookings.module.ts + app.module.ts — register module; ⇒ app boots; ~25

## Phase 5: Guard + E2E + Gates

- [ ] T-017 (T-003) — vetary-api/test/integration/bookings/availability-delete-guard.spec.ts — RED AV10 409, AV11 cancelled/past ok, AV12 atomic; ⇒ fails; ~70
- [ ] T-018 (T-017) — vetary-api/src/modules/availability/repositories/availability.repository.ts + services/availability.service.ts — GREEN countBlockingBookings + delete $transaction; ⇒ green; ~55
- [ ] T-019 (T-016) — vetary-api/test/e2e/bookings.e2e-spec.ts — happy path create→confirm→in-progress→completed; ⇒ e2e green; ~80
- [ ] T-020 (T-019) — CI gates: lint+tsc+unit+integration+e2e+migrate status; ⇒ all exit 0; ~0
