# Design: Internal Bookings (ADMIN/STAFF)

> Outcome: a tenant-scoped `Booking` model with a Prisma enum + pure transition
> policy, timezone-correct interval derivation, and a per-vet/date advisory lock
> that guarantees exactly-one-wins under concurrent overlapping creation. No
> client role, no `Pet` relation (→ Phase 4), no notifications.

## Technical Approach

Four-layer convention preserved. `BookingRepository extends BaseRepository`
(owns Prisma + `tenantId` filter); `BookingService` derives `endTime`,
validates timezone + availability fit + overlap inside a single
`prisma.$transaction` that opens a `pg_advisory_xact_lock` keyed by
tenant+vet+date; controllers stay thin. State transitions live in a pure
`BOOKING_TRANSITIONS` map (Option C from exploration) — no domain entity
classes, matching every existing module. Booking stores its own
`date`/`startTime`/`endTime` + computed `startInstant`/`endInstant` so
deleting an availability block never orphans history (AV13).

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | State machine | Prisma `BookingStatus` enum + pure `BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]>` | Matches repo (no domain entities); trivially unit-testable; clean Observer extraction point later. |
| D2 | Timezone lib | `luxon` (new dep) with `DateTime.fromObject({…}, { zone: tenant.timezone })` | Mature IANA support; detects gap/ambiguous via `isValid` + `offset`. `date-fns-tz` lacks gap detection; Temporal not GA. |
| D3 | Invalid local time (B15) | Reject gap AND fall-back ambiguity with `400` when caller sends no offset | Spec scenario mandates 400; safe default. Future: explicit "earlier offset" policy if product wants disambiguation. |
| D4 | Interval comparison | Half-open instants: overlap iff `a.start < b.end && a.end > b.start` | B16; adjacent = no overlap (matches spec adjacency scenario). |
| D5 | Concurrency strategy | **Per-vet/date advisory lock** (`pg_advisory_xact_lock(hashtext(tenantId||':'||vetId||':'||date))`) inside the create `$transaction` | See concurrency matrix below. |
| D6 | Availability delete | Atomic `countFutureNonCancelledBookings` + `deleteMany` inside one `$transaction` | AV10–AV12; cancelled/past never block. |
| D7 | No-show debt | No new status; unattended CONFIRMED stays CONFIRMED | Matches spec "Deferred Debt". |
| D8 | `notes` (U1) | Optional plain text, `@IsString @MaxLength(1000)`, trimmed, no Markdown/HTML | Product-confirmed v1 cap; sanitization = trim + class-validator; no rich-text rendering in v1. |
| D9 | VET transition rights (U2) | VET may only `CONFIRMED→IN_PROGRESS` and `IN_PROGRESS→COMPLETED` on own bookings; cannot create or cancel. ADMIN/STAFF retains full management. | Product-confirmed (Q1 resolved). VET gets a narrow lifecycle-only scope; create/cancel stay ADMIN/STAFF-gated. |

### Concurrency strategy comparison (B21)

| Strategy | Trade-off | Verdict |
|----------|-----------|---------|
| PG exclusion constraint (`EXCLUDE USING GIST (tenantId,vetId, tstzrange(startInstant,endInstant)) WHERE status<>'CANCELLED'`) | Strongest DB-level guarantee; but Prisma can't declare it in `schema.prisma` → raw SQL migration, schema drift risk, no teaching precedent, needs `btree_gist` extension. | Rejected — operational/teaching cost. |
| SERIALIZABLE isolation | Prisma `isolationLevel: 'Serializable'`; needs retry on `40001`; false aborts; throughput loss. | Rejected — retry complexity, no existing precedent. |
| **Per-vet/date advisory lock** | `pg_advisory_xact_lock` raw SQL in the same `$transaction`; consistent lock key; auto-released at commit/rollback; single lock per tx → no deadlock; scoped to vet+date (not global) → high concurrency. | **Selected**. Matches existing `TenantService.$transaction` pattern; deterministic exactly-one-wins; no schema drift. |

**Guarantee:** two concurrent overlapping requests for the same vet/date → first
acquires lock, overlap check passes, inserts; second waits, acquires lock,
re-runs overlap query, sees the inserted row → `409`. Exactly one `201`, one
deterministic `409` (B20).

## Data Flow

```
POST /bookings ──► BookingController (thin, @Roles ADMIN/STAFF)
                       │  @CurrentTenant tenant, @CurrentUser user, CreateBookingDto
                       ▼
                  BookingService.create()
                       │ 1. tz-derive localStart/localEnd/endInstant (BookingTime)
                       │ 2. $transaction:
                       │    a. pg_advisory_xact_lock(hashtext(tenant:vet:date))
                       │    b. fetch Service (duration), VetProfile (own tenant)
                       │    c. fetch non-cancelled bookings for tenant+vet+date
                       │    d. overlap check (half-open instants)  ──► 409
                       │    e. availability fit (tenant-local weekday + block) ──► 409
                       │    f. insert Booking (date,startTime,endTime,startInstant,endInstant)
                       ▼
                  BookingRepository.createForTenant() ──► prisma.booking
```

## Interfaces / Contracts

```prisma
enum BookingStatus { PENDING CONFIRMED IN_PROGRESS CANCELLED COMPLETED }

model Booking {
  id            String       @id @default(cuid())
  tenantId      String
  serviceId     String
  vetId         String       @map("vet_id")
  petName       String       @map("pet_name")          // REQUIRED (Phase 4 → Pet)
  date          DateTime     @db.Date                   // tenant-local calendar date
  startTime     String       @map("start_time")         // "HH:mm" snapshot
  endTime       String       @map("end_time")           // "HH:mm" derived snapshot
  startInstant  DateTime     @map("start_instant")      // UTC instant for comparison
  endInstant    DateTime     @map("end_instant")
  status        BookingStatus @default(PENDING)
  notes         String?      @db.VarChar(1000)
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  tenant   Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  service  Service @relation(fields: [serviceId], references: [id])
  vet      User    @relation(fields: [vetId], references: [id], onDelete: Cascade)

  @@index([tenantId, vetId, date])
  @@index([tenantId, vetId, startInstant])
  // ⚠️ No partial index here: Prisma `@@index` does NOT support `WHERE` filters
  // (https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes). A
  // `WHERE status <> 'CANCELLED'` partial index on (tenantId, vetId, startInstant)
  // CANNOT be expressed in schema.prisma as executable syntax. It is deferred
  // (Q3 resolved): baseline = the two plain indexes above only. If later added as
  // a measured optimization, it MUST be created via a raw SQL migration
  // (`CREATE INDEX ... WHERE status <> 'CANCELLED'`) owned by the migration file
  // with a drift test. The partial index is NOT part of the selected baseline.
  @@map("bookings")
}
```

```ts
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING:     ["CONFIRMED", "CANCELLED"],
  CONFIRMED:   ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED:    [],
  CANCELLED:    [],
};
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}
```

Transaction boundary: `BookingService.create()` and `AvailabilityService.delete()` each run one
`prisma.$transaction` (lock + check + write). No multi-transaction coordination.

Error mapping: `400` invalid local time / invalid transition / `petName` empty / `endTime` supplied;
`404` booking/service/vet/availability not found in tenant; `403` VET accessing other vet's agenda, VET attempting create/cancel, or VET attempting a non-allowed transition;
`409` overlap / availability-fit fail / delete-guard blocked.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `vetary-api/prisma/schema.prisma` | Modify | Add `BookingStatus` enum, `Booking` model; add `bookings` relation to `Tenant`/`User`/`Service`. |
| `vetary-api/prisma/migrations/<ts>_add_bookings/migration.sql` | Create | Additive: `CREATE TYPE`, `CREATE TABLE`, indexes. Revert = drop. |
| `vetary-api/src/modules/bookings/bookings.module.ts` | Create | Imports `DatabaseModule`, `ServicesModule` (for duration), `UsersModule`; exports `BookingService`. |
| `vetary-api/src/modules/bookings/controllers/booking.controller.ts` | Create | `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id/status`. `@Roles(ADMIN,STAFF)` for create/cancel; VET MAY `PATCH` status to `IN_PROGRESS`/`COMPLETED` on own bookings only (D9); VET MAY `GET` agenda. |
| `vetary-api/src/modules/bookings/services/booking.service.ts` | Create | create/list/findOne/updateStatus; tz derivation + transaction + lock + overlap + fit + policy. |
| `vetary-api/src/modules/bookings/services/booking-transitions.ts` | Create | Pure `BOOKING_TRANSITIONS` + `canTransition`. |
| `vetary-api/src/modules/bookings/services/booking-time.ts` | Create | `BookingTime` helper: `fromWallClock(date,startTime,tz)` → `{startInstant,endInstant,isValid}`; gap/ambiguity detection. |
| `vetary-api/src/modules/bookings/repositories/booking.repository.ts` | Create | `extends BaseRepository<Booking>`; `findNonCancelledForVetDate`, `countFutureNonCancelledForBlock` (tx-aware via passed client). |
| `vetary-api/src/modules/bookings/dto/create-booking.dto.ts` | Create | `serviceId`, `vetId`, `petName`, `date`, `startTime`, `notes?`; explicitly NO `endTime`. |
| `vetary-api/src/modules/bookings/dto/update-booking-status.dto.ts` | Create | `status: BookingStatus`. |
| `vetary-api/src/modules/availability/services/availability.service.ts` | Modify | `delete()` → `$transaction`: count future non-cancelled bookings intersecting block (using snapshot `startInstant`/`endInstant` + tenant-local weekday match); `>0` → `409`; else `deleteMany`. |
| `vetary-api/src/modules/availability/repositories/availability.repository.ts` | Modify | Add `countBlockingBookings(tenantId, vetId, dayOfWeek, blockRange, nowInstant)` accepting a tx client. |
| `vetary-api/src/app.module.ts` | Modify | Register `BookingsModule`. |
| `vetary-api/test/unit/bookings/booking-transitions.spec.ts` | Create | Table-driven every `(from,to)` pair; pure, zero deps. |
| `vetary-api/test/unit/bookings/booking-time.spec.ts` | Create | Gap/ambiguity/adjacency/weekday-fit cases incl. `America/Santiago` spring-forward. |
| `vetary-api/test/integration/bookings/concurrent-booking.spec.ts` | Create | Dedicated concurrency proof (below). |
| `vetary-api/test/integration/bookings/booking-crud.spec.ts` | Create | Overlap/adjacency/cancelled-doesn't-block; isolation; transitions. |
| `vetary-api/test/integration/bookings/availability-delete-guard.spec.ts` | Create | AV10–AV13 scenarios. |
| `vetary-api/test/e2e/bookings.e2e-spec.ts` | Create | Full create→confirm→in-progress→completed happy path. |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `BOOKING_TRANSITIONS` | Exhaustive `(from,to)` matrix; no infra deps. |
| Unit | `BookingTime` tz | Gap (spring-forward), ambiguous (fall-back), adjacency, weekday fit. |
| Integration | CRUD + overlap + transitions + isolation | Real PostgreSQL; tenant A vs B; VET own-agenda. |
| Integration | VET RBAC transition rights (D9) | VET can `CONFIRMED→IN_PROGRESS` and `IN_PROGRESS→COMPLETED` on own bookings; VET `create`/`cancel` → `403`; VET touching another vet's booking → `403`; ADMIN/STAFF full management. |
| Integration | **Concurrent overlap guarantee** | Dedicated test (below). |
| Integration | Availability delete-guard | AV10–AV13 scenarios. |
| E2E | Booking lifecycle happy path | supertest through full HTTP stack. |

### Dedicated concurrent integration test (B19–B20)

- **Setup**: seed tenant (tz `America/Santiago`), vet with `UserTenant(VET)`, `VetAvailability` Monday 09:00–13:00, `Service` duration 60. Truncate `bookings` before. Use the existing integration harness (real PG, `test/jest-integration.json`).
- **Synchronization/barrier**: build `N=8` request promises; release them simultaneously via `Promise.all([…])` so they contend on the same vet+date+09:00 slot. Each calls `BookingService.create()` (or HTTP `POST /bookings`) with identical overlapping interval 09:00–10:00.
- **Assertions**: exactly one resolves with `201`/created booking; the other 7 reject with `409` Conflict; after `Promise.allSettled`, `SELECT count(*) FROM bookings WHERE tenantId AND vetId AND date` returns `1`; the surviving row's interval equals 09:00–10:00.
- **Failure modes** (test FAILS if): ≥2 `201`s (lock or overlap query broken); all `409` (lock not released / first request never inserted); DB row count ≠ 1 (partial insert).
- **Cleanup**: `DELETE FROM bookings …` + tear down tenant in `finally` regardless of outcome.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. Bookings are pure application
+ infrastructure code.

## Migration / Rollout

Additive migration: new `bookings` table + `BookingStatus` enum + the two
plain indexes declared in `schema.prisma`. No existing column altered; no
data backfill.

> ⚠️ **Rollback is not a Prisma command.** Once a migration is published
> (applied in any shared environment), `prisma migrate dev --name drop_bookings`
> is NOT a rollback: it creates a *new* forward migration that drops the table,
> leaving the original migration record in `_prisma_migrations` and offering no
> revert path for the dropped schema. Per the project's migration policy,
> rollback = (a) revert the application via `git revert`/ redeploy to the
> previous build, AND (b) ship a deliberate **follow-up migration** (e.g.
> `<ts>_drop_bookings/migration.sql` with `DROP TABLE bookings; DROP TYPE
> "BookingStatus";`) reviewed like any forward migration; or restore from a
> pre-migration DB snapshot for destructive in-place recovery. Never invoke
> `prisma migrate dev` against a published environment — use
> `prisma migrate deploy` for the follow-up migration only.

Availability delete-guard is additive (service logic only). No feature flag
needed; the module is gated by RBAC (`ADMIN`/`STAFF`) and Phase 2 deps are
complete.

## Resolved Decisions

All design questions are product-confirmed. **No user-blocking design questions remain.**
Items below are non-binding implementation notes carried into `sdd-tasks`.

- [x] **Q1 — VET transition rights (D9).** Product confirmed: VET may transition own
  bookings `CONFIRMED→IN_PROGRESS` and `IN_PROGRESS→COMPLETED`; VET cannot create or
  cancel. ADMIN/STAFF retains full management. RBAC matrix and the dedicated VET RBAC
  integration test (above) are frozen against this answer.
- [x] **Q2 — `notes` field (D8).** Product confirmed: optional plain text, trimmed,
  max 1000 chars, no Markdown/HTML rendering in v1. D8 reflects this verbatim.
- [x] **Q3 — Partial overlap index.** Decision: **defer**. The baseline uses the two
  plain Prisma indexes (`@@index([tenantId, vetId, date])` and
  `@@index([tenantId, vetId, startInstant])`) only. The partial
  `WHERE status <> 'CANCELLED'` index is a future measured optimization: if load data
  shows the overlap hot path needs it, it MUST be added via a raw SQL migration
  (`CREATE INDEX ... WHERE status <> 'CANCELLED'`) owned outside `schema.prisma`,
  accompanied by a drift test asserting the migration and schema stay reconciled.
  Prisma `@@index` cannot declare `WHERE` filters, so retaining it is never a silent
  Prisma assumption — it is an explicit raw-SQL + drift-test cost.

### Implementation notes (non-blocking, carried to sdd-tasks)

- The `PATCH /bookings/:id/status` handler must enforce the D9 matrix at the
  controller/guard layer: VET scope = own booking + `IN_PROGRESS`/`COMPLETED` targets
  only; ADMIN/STAFF = any target allowed by `BOOKING_TRANSITIONS`.
- The `notes` sanitizer is `trim()` + `@MaxLength(1000)` + `@IsString`; no HTML
  stripping library is introduced in v1 (plain-text contract).
- If the partial index is later added, the drift test must run in CI alongside
  `prisma migrate diff` to catch schema/migration divergence.
