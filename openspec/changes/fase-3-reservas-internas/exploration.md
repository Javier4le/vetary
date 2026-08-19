> This exploration covers the complete Phase 3 before it was split into two OpenSpec changes.
> It is retained in full as shared context for both the internal and public booking changes.

# Exploration: Phase 3 — Bookings / Reservations System

> ## Post-review correction (2026-08-19)
> The accepted decisions supersede the "Phase 3a/3b" naming and several recommendations below:
> 1. Change names are `fase-3-reservas-internas` (ADMIN/STAFF bookings) and
>    `fase-3-reservas-publicas` (client registration + public booking), both inside the single
>    product phase `fase-3`. There is no `fase-3a`/`fase-3b`; the phase tag `fase-3-complete`
>    is created only after both close.
> 2. `Booking.petName` is REQUIRED (not nullable). Phase 4 replaces it with a `Pet` relation
>    and migrates existing data.
> 3. The public client booking flow is part of v1 and runs as the second change immediately
>    after the internal change — not deferred indefinitely.
> 4. Double booking is a first-class invariant (interval overlap, any start time) requiring a
>    dedicated test — not a mere `(vetId, date, startTime)` unique constraint.
> 5. State machine = Prisma `BookingStatus` enum + pure transition policy map (Option C).
> 6. Availability deletion is blocked only by future NON-cancelled bookings; cancelled bookings
>    never block; check + delete atomic.

## Current State

### What Exists (Verified)

**Prisma Schema** (`vetary-api/prisma/schema.prisma`, 200 lines):
- `Tenant` — clinic root entity with `timezone` (default `America/Santiago`)
- `User` — global user, no `tenantId` directly; scoped via `UserTenant` junction
- `UserTenant` — membership with `Role` enum (`ADMIN`, `VET`, `STAFF`); unique `(userId, tenantId)`
- `Service` — tenant-scoped catalog: `name`, `durationMinutes` (Int), `priceClp` (Int CLP), `isActive` (soft-disable)
- `VetProfile` — per-vet per-tenant: `specialty`, `registrationNumber`, `bio`; unique `(tenantId, userId)`
- `VetAvailability` — weekly recurring blocks: `dayOfWeek` (0–6), `startTime`/`endTime` ("HH:mm"), indexed on `(tenantId, vetId, dayOfWeek)`

**No `Booking` model exists in the schema.** No `Pet` model exists. No `ClientProfile` model exists. No bookings module directory exists under `src/modules/`.

**Existing Modules** (`src/modules/`): `auth/`, `availability/`, `services/`, `tenants/`, `users/`, `vet-profiles/`

**Architecture Patterns in Use**:
- `BaseRepository<T>` — abstract class enforcing `tenantId` injection on all `find`/`create`/`update`/`delete` operations
- `TenantRepository` and `UserRepository` — do NOT extend `BaseRepository` (root entities without direct `tenantId`)
- Atomic transactions via `prisma.$transaction` — used in `TenantService.register()` and `UserService.createVet()` for multi-table writes
- Thin controllers → services → repositories; no business logic in controllers
- Decorators: `@CurrentTenant()`, `@CurrentUser()`, `@Roles()`, `@Public()`

**Test Infrastructure**:
- Unit: 14 suites / 111 tests (Jest, `pnpm --filter vetary-api exec jest --no-coverage`)
- Integration: 4 suites / 27 tests (real PostgreSQL, `test/jest-integration.json`)
- E2E: 3 suites / 15 tests (supertest, `test/jest-e2e.json`)
- Strict TDD modules: `auth`, `tenants`, `repositories`, `bookings`, `services`
- `bookings` is listed in `strict_tdd_modules` in `openspec/config.yaml` — TDD is mandatory

**SPEC.md Booking Flow** (documented but unimplemented):
```
Pendiente → Confirmada → En curso → Completada
         ↓            ↓
      Cancelada    Cancelada
```

### What Does NOT Exist (Gaps)

| Gap | Evidence |
|-----|----------|
| `Booking` Prisma model | Not in `schema.prisma` |
| `Pet` / `Owner` model | Not in `schema.prisma`; referenced in `SPEC.md` ("Ficha del paciente") and `ARCHITECTURE.md` (`prisma.booking, prisma.pet` comment in BaseRepository) |
| `bookings/` module | Not in `src/modules/` |
| `BookingStatus` enum | Not defined anywhere |
| Availability slot calculation | `VetAvailability` stores weekly blocks but no logic converts them to bookable time slots for a specific date |
| Client role | `Role` enum has `ADMIN`, `VET`, `STAFF` only — no `CLIENT` role |
| Domain events infrastructure | No event emitter, no observer/subscriber pattern implemented |

## Affected Areas

| Path | Why Affected |
|------|-------------|
| `vetary-api/prisma/schema.prisma` | New models: `Booking`, `BookingStatus` enum, possibly `Pet`, `Client` role |
| `vetary-api/src/modules/bookings/**` | New module (entire directory) |
| `vetary-api/src/modules/services/services.module.ts` | Already exports `ServicesService` for bookings consumption |
| `vetary-api/src/modules/availability/` | Slot calculation logic needed to derive bookable slots from weekly blocks |
| `vetary-api/src/modules/users/` | May need `CLIENT` role support and client registration flow |
| `vetary-api/src/app.module.ts` | Register new `BookingsModule` |
| `vetary-api/test/` | New unit, integration, E2E tests for bookings |
| `openspec/specs/` | New `bookings/` delta spec |

## Verified Business Rules (from code + specs)

1. **Services have duration**: `Service.durationMinutes` (Int, ≥1) — determines booking slot length
2. **Services have price**: `Service.priceClp` (Int CLP, ≥0)
3. **Services can be disabled**: `Service.isActive` soft-disable; Phase 2 proposal notes "no hard delete with bookings"
4. **Availability is weekly recurring**: `VetAvailability` with `dayOfWeek`, `startTime`, `endTime`; no end date in v1
5. **No cross-midnight blocks**: Enforced by `AvailabilityService.isValidTimeRange()`
6. **No overlapping blocks**: Enforced by `AvailabilityService.hasOverlap()`
7. **Tenant timezone**: `Tenant.timezone` field exists (default `America/Santiago`)
8. **One role per user per tenant**: `@@unique([userId, tenantId])` on `UserTenant`
9. **Vets have profiles**: `VetProfile` linked to `User` via `userId`, scoped to tenant

## Open Product Decisions (NOT verified — need user input)

| # | Decision | Options | Impact |
|---|----------|---------|--------|
| D1 | **Pet model scope** | Minimal (name, species) vs full (breed, weight, color, DOB, medical history) | Schema complexity; Phase 4 will extend anyway |
| D2 | **Client registration** | Self-registration vs admin-created vs both | Auth flow; Role enum change |
| D3 | **Booking creation actor** | Client only? Staff? Both? | RBAC; controller design |
| D4 | **Slot granularity** | Fixed 30-min slots? Dynamic based on `Service.durationMinutes`? | Availability calculation complexity |
| D5 | **Concurrent booking protection** | Optimistic locking? Pessimistic? Unique constraint on (vetId, date, startTime)? | Race condition handling |
| D6 | **Cancel rules** | Who can cancel? Time window? Reason required? | State machine complexity |
| D7 | **No-show handling** | Separate status? Auto-expire? | State machine |
| D8 | **Observer scope (v1)** | Which actions trigger on state change? Notifications? Audit log? | Module dependencies |

## Approaches

### Approach A: Minimal Viable Booking (Recommended)

**Description**: Smallest coherent slice — Booking model, basic CRUD, state machine, no Pet/Client yet. Admin/Staff create bookings manually; client self-booking deferred.

**Includes**:
1. `Booking` Prisma model + `BookingStatus` enum + migration
2. `BookingsModule` with repository, service, controller
3. State machine: `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED` + `CANCELLED` from PENDING/CONFIRMED
4. Basic slot availability check (is the vet available at this time?)
5. RBAC: ADMIN/STAFF can create/manage; VET can view own agenda
6. Unit + integration + E2E tests (strict TDD)

**Excludes** (deferred to later slices):
- Pet model (use placeholder or nullable `petName` string)
- Client self-registration and self-booking
- Observer/Domain Events (state changes are synchronous side-effects in the service)
- Factory pattern (only one booking creation path in v1)
- Dashboard/calendar views

**Pros**:
- Delivers core booking flow end-to-end
- Tests the state machine, which is the highest-risk business logic
- Follows existing patterns exactly (BaseRepository, thin controller, service orchestration)
- Small PR footprint (~300–400 lines estimated)
- Validates slot availability calculation early

**Cons**:
- No client-facing booking yet (admin/staff only)
- Pet data is minimal (will need migration later)
- No domain events (Observer deferred)

**Effort**: Medium

### Approach B: Full Client-Facing Booking

**Description**: Complete flow including client registration, pet model, self-booking, and basic notifications.

**Includes everything in A plus**:
- `CLIENT` role in `Role` enum
- Client self-registration endpoint
- `Pet` model + repository
- Client-facing booking creation endpoint
- Basic Observer pattern for state changes

**Pros**:
- Matches SPEC.md flow end-to-end
- Client can book without staff intervention

**Cons**:
- Significantly larger scope (600+ lines)
- Requires auth flow changes (client registration)
- Pet model design is a dependency
- Higher review risk (exceeds 400-line budget)

**Effort**: High

### Approach C: Schema-First + Factory/Observer

**Description**: Start with full schema design including Pet, implement Factory for booking creation by service type, and Observer for state transitions.

**Pros**:
- Future-proof schema
- Patterns are pre-built for extension

**Cons**:
- Over-engineering for current needs
- Factory is questionable: `Service.durationMinutes` already captures the difference; creating "different types" of bookings is not clearly needed yet
- Observer adds complexity without clear v1 consumers (no notification system, no audit log requirement)
- Violates YAGNI — patterns should emerge from problems, not precede them

**Effort**: High

## Recommendation

**Approach A: Minimal Viable Booking** is the clear winner.

### Why Factory and Observer Are NOT Warranted Yet

**Factory Pattern**: The documented rationale is "creating bookings differs by service type." But examining the actual `Service` model, the only differentiator is `durationMinutes`. A routine consultation (30 min) and a surgery (120 min) create the same `Booking` record — just with different `serviceId` that resolves to different duration. There is no evidence of type-specific validation, initialization, or behavior. **If** different service types need different creation logic later, a Factory can be introduced then. Premature abstraction is worse than a simple `if` that doesn't exist yet.

**Observer Pattern**: The documented rationale is "booking state changes trigger multiple actions." In v1, those actions are: (1) nothing async, (2) no notifications (deferred to v2 per SPEC.md), (3) no audit log requirement. A synchronous call inside `BookingsService.updateStatus()` is sufficient. When notifications or audit logging are actually needed, the Observer pattern can be extracted from those concrete consumers. Building the event infrastructure now means maintaining empty listeners.

### Recommended First Slice

1. **Prisma**: `BookingStatus` enum + `Booking` model with `tenantId`, `clientId` (nullable — admin-created bookings may not have a client account), `petName` (string, minimal), `serviceId`, `vetId`, `date` (DateTime), `startTime` (String "HH:mm"), `endTime` (String "HH:mm"), `status`, `notes` (optional), timestamps.
2. **Module**: `bookings/` — `BookingRepository` extending `BaseRepository`, `BookingService` with state machine + slot validation, `BookingController` with CRUD + status transitions.
3. **RBAC**: ADMIN/STAFF create/manage; VET reads own agenda; no CLIENT role yet.
4. **Tests**: Unit (state machine transitions, slot validation), integration (tenant isolation, CRUD), E2E (full booking flow).
5. **No migration to Pet/Client roles** — use existing `User` with VET role for vets, and admin/staff create bookings on behalf of clients.

### Estimated Scope
- ~350–400 lines of new code (model + module + tests)
- 1 Prisma migration
- 0 modifications to existing modules (ServicesModule already exports what's needed)

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Slot availability calculation bugs (timezone, DST, date mapping from weekly blocks) | High | Unit tests with edge cases; use `Tenant.timezone` consistently |
| Race condition on concurrent bookings for same vet+slot | Medium | Unique constraint `(vetId, date, startTime)` or optimistic locking |
| Pet placeholder needs migration when full Pet model arrives | Low | Nullable fields; migration is additive |
| State machine allows invalid transitions | Medium | Explicit transition map; unit test every valid and invalid transition |
| 400-line budget exceeded if scope creeps | Medium | Strict first-slice boundary; no Pet, no Client role, no Observer |

## Command Evidence

| Command | Result |
|---------|--------|
| `pnpm --filter vetary-api exec jest --no-coverage` | 14 suites / 111 tests PASS (exit 0) |
| `git status --short` | Modified: `biome.json`, `openspec/config.yaml`, `openspec/sdd-init-report.md` (init refresh artifacts only) |
| `git log --oneline -5` | Latest: `8bcced4 build!: upgrade Prisma to 7.9.1` |

---

## Focused Scope & Design Clarification (Verified Evidence)

### Q1. Pet Scope — Is a Pet Model Required for Phase 3 Bookings?

**Verified Facts:**
- SPEC.md § "Reserva por parte de un cliente" (lines 70–78): the booking selection flow is **servicio → veterinario → fecha → horario disponible**. Pet selection is NOT in the booking creation flow.
- SPEC.md § "Ficha del paciente" (lines 87–93): Pet data (name, species, breed, DOB, weight, color) is documented under a separate section, linked to clinical history — not to booking creation.
- SPEC.md § "Fase 4 — Ficha clínica" (lines 167–170): "The vet can open a pet file before the consultation" and "add clinical notes." This is Phase 4, not Phase 3.
- Prisma schema: No `Pet` model exists. No `petId` foreign key anywhere.
- `Booking` model in `ARCHITECTURE.md` (line 247): shows `tenantId` + timestamps only — no pet reference.

**Conclusion:** A Pet model is NOT a domain necessity for a valid booking in Phase 3. The booking selects a **service + vet + time slot**. The patient (pet) is associated at check-in or consultation time (Phase 4 flow). A `petName` string on the Booking model is a reasonable placeholder for "who is this appointment for" without requiring a full Pet entity.

**Smallest Coherent Model (if included):**
```prisma
model Pet {
  id        String   @id @default(cuid())
  tenantId  String
  ownerId   String   @map("owner_id")     // FK to User (the client)
  name      String
  species   String                          // "dog", "cat", etc.
  breed     String?
  birthDate DateTime? @map("birth_date")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner  User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, ownerId])
  @@map("pets")
}
```

**Migration implications:** Adding Pet later as an FK on Booking requires a migration that adds the column as nullable, then backfills. This is a standard additive migration — no data loss, no downtime. **Verdict: defer Pet to Phase 4. Use nullable `petName: String?` on Booking.**

---

### Q2. Client Self-Booking — Deliberate Slice Boundary or Accidental Omission?

**Verified Facts:**
- SPEC.md § "Reserva por parte de un cliente" (line 70): "El cliente entra a `laspalmeras.vetary.app`... Si no tiene cuenta, se registra... Confirma la reserva." This is the PRIMARY documented v1 booking flow.
- SPEC.md § "Lo que SÍ entra en v1" (line 125): "Sistema de reservas completo con flujo de estados" and (line 127): "Panel del cliente (mis mascotas, mis reservas)" and (line 133): "Landing pública por tenant con formulario de reserva."
- `Role` enum (`schema.prisma` line 80): Only `ADMIN`, `VET`, `STAFF`. No `CLIENT` role exists.
- `CreateUserDto` (line 42): `@IsEnum(["ADMIN", "VET", "STAFF"])` — CLIENT is explicitly excluded.
- Auth controller: No `POST /auth/register` endpoint for clients. Only `POST /tenants/register` (creates a clinic + admin).
- `TenantMiddleware` (`tenant.middleware.ts` line 34): Login is tenant-agnostic (`/api/v1/auth/login` skips tenant resolution) and requires `tenantId` in body.

**Conclusion:** Excluding client self-booking from the first exploration approach was a **deliberate slice boundary**, not an omission. However, it is a scope REDUCTION from SPEC.md's documented v1 flow. The SPEC explicitly describes client self-booking as the primary booking path.

**Consequences of including it now:**
1. Must add `CLIENT` to `Role` enum (Prisma migration + `CreateUserDto` change)
2. Must build `POST /auth/register` public endpoint (client self-registration within a tenant context)
3. Must handle tenant resolution for unauthenticated clients (subdomain-based, already supported by `TenantMiddleware`)
4. Must build client-facing booking endpoint (different RBAC than admin/staff)
5. Scope grows from ~350 lines to ~600+ lines; exceeds 400-line review budget

**Consequences of splitting it:**
1. Phase 3a (this change): admin/staff booking management — validates state machine, slot logic, tenant isolation
2. Phase 3b (next change): client registration + self-booking — reuses validated booking infrastructure
3. Each slice stays within 400-line budget
4. Risk: Phase 3b may require refactoring Booking model if client-specific fields are missed

**Recommendation:** Split. Phase 3a = admin/staff bookings. Phase 3b = client self-booking. This matches the "ask-on-risk" delivery strategy and keeps review workload manageable.

---

### Q3. Client Registration — Does Phase 1 Already Implement It?

**Verified Evidence (exact files inspected):**

| Component | File | Finding |
|-----------|------|---------|
| `Role` enum | `prisma/schema.prisma:80` | `ADMIN`, `VET`, `STAFF` only — no `CLIENT` |
| `CreateUserDto` | `src/modules/users/dto/create-user.dto.ts:42` | `@IsEnum(["ADMIN", "VET", "STAFF"])` — CLIENT excluded |
| Auth controller | `src/modules/auth/controllers/auth.controller.ts` | `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me` — no `POST /auth/register` |
| Tenant controller | `src/modules/tenants/controllers/tenant.controller.ts` | `POST /tenants/register` — creates clinic + admin, NOT a client registration |
| User controller | `src/modules/users/controllers/user.controller.ts` | `POST /users` (ADMIN-only), `POST /users/vets` (ADMIN-only), `POST /users/staff` (ADMIN-only) — no public client endpoint |
| Tenant middleware | `src/common/middleware/tenant.middleware.ts:34` | Tenant-agnostic paths: `/tenants/register`, `/auth/login`, `/auth/refresh` — no client registration path |
| Login DTO | `src/modules/auth/dto/login.dto.ts:24` | Requires `tenantId: string` (UUID) — client must know their tenant ID |

**Conclusion:** Phase 1 does NOT implement client registration. The only public registration is `POST /tenants/register` which creates a new clinic (tenant + admin). There is no endpoint for a pet owner to create an account within an existing tenant.

**What must be built for client registration:**
1. Add `CLIENT` to `Role` enum in Prisma schema + migration
2. Create `POST /auth/register` (or `POST /clients/register`) public endpoint
3. Create `RegisterClientDto` (email, password, firstName, lastName)
4. Tenant resolution: client registers via subdomain (already handled by `TenantMiddleware` for non-tenant-agnostic paths)
5. Create `User` + `UserTenant(role: CLIENT)` atomically (same pattern as `createVet`)
6. Add `/auth/register` to `isTenantAgnosticPath` in `TenantMiddleware` — OR require subdomain access (client enters via `clinica.vetary.app`)
7. Update `CreateUserDto` role enum to include `CLIENT`

---

### Q4. State Machine Placement — Domain Entity vs Application Service

**Current codebase conventions:**
- Business logic lives in **NestJS application services** (`*Service` classes in `src/modules/*/services/`)
- No domain entity classes exist — Prisma-generated types are used directly
- No value objects, no domain events infrastructure
- State transitions are not modeled anywhere yet (this is the first stateful entity)
- Prisma 7 generated client provides plain TypeScript types, not behavior-rich models

**Trade-off Matrix:**

| Criterion | Option A: Service-Only | Option B: Domain Entity | Option C: Prisma Enum + Policy Object |
|-----------|----------------------|------------------------|---------------------------------------|
| **Correctness / Testability** | Transition logic in service; testable via service unit tests but coupled to service dependencies | Pure domain class; testable in isolation with zero infrastructure deps | Policy object is pure function; testable in isolation. Enum constrains DB. |
| **Mapping / Boilerplate** | Zero mapping — service reads/writes Prisma types directly | Requires mapping Prisma type ↔ domain entity at repository boundary; doubles boilerplate | Minimal — policy is a standalone `Record<BookingStatus, BookingStatus[]>` map. No entity mapping. |
| **Persistence Coupling** | Tightly coupled — service calls `prisma.booking.update({ data: { status } })` directly | Decoupled — domain entity doesn't know about Prisma; repository maps | Enum is Prisma-native; policy object is decoupled. Moderate coupling. |
| **Future Events** | Hard to extract — transition logic is buried in service methods | Natural — domain entity can emit events after transition | Policy object can be wrapped by event emitter later; clean extraction point |
| **Fit with Existing Conventions** | **Perfect match** — every existing module follows this pattern | **No precedent** — would be the first domain entity in the codebase | **Partial match** — no precedent for policy objects, but enums already exist |

**Analysis:**

Option A (Service-Only) is the path of least resistance and matches every existing module. The risk is that when Observer/events are needed later, extracting transition logic from 5+ service methods is tedious but not impossible.

Option B (Domain Entity) is architecturally superior for a stateful entity with transition rules. But introducing it now means being the FIRST module to break the established convention. The teaching level is "principiante" — adding a domain entity layer before the developer has internalized the service-layer pattern may confuse rather than teach.

Option C (Prisma Enum + Policy Object) is a middle ground. A `BookingTransitions` constant map is trivially testable, trivially extractable later, and adds zero mapping overhead. The Prisma enum constrains the database. This is the lightest-weight option that preserves future optionality.

**Unresolved:** The user should decide based on their learning goals (principiante level favors Option A) vs architectural purity (Option C preserves future optionality at near-zero cost).

---

### Q5. Availability Deletion/Editing with Bookings

**Verified Current Behavior:**
- `AvailabilityService.delete()` (`availability.service.ts:70`): calls `deleteAvailability()` which calls `BaseRepository.deleteForTenant()` — a **hard delete** via `prisma.vetAvailability.deleteMany()`.
- `AvailabilityRepository` has NO update method — only `createAvailability`, `deleteAvailability`, `findByVetAndDay`.
- `VetAvailability` has no `isActive` field, no soft-delete mechanism.
- `VetAvailability` has no FK relation to any booking table (because Booking doesn't exist yet).
- Phase 2 proposal (`proposal.md:40`): "Services are soft-disabled (`isActive`); no hard delete with bookings" — this rule was applied to Services but NOT to Availability.
- Availability spec (`vet-weekly-availability/spec.md`): Documents create and delete. No mention of edit, no mention of booking constraints.

**The Invariant Once Bookings Exist:**
A booking records: `vetId`, `date` (specific calendar date), `startTime`, `endTime`. The booking was created because the vet had an availability block matching that day-of-week and time range. If the admin deletes or edits that availability block:
- **Hard delete**: The booking's referential integrity is lost. The vet appears to have never been available. Historical bookings become orphaned — no way to verify they were valid.
- **Edit time range**: Future slot calculations change, but existing bookings may now fall outside the new range. Silent data inconsistency.

**Policy Comparison:**

| Policy | Behavior | Integrity | Complexity | User Experience |
|--------|----------|-----------|------------|-----------------|
| **P1: Block deletion if active bookings exist** | `DELETE` returns 409 if any booking references this vet+day+time range | Strong — no orphaned bookings | Low — check query before delete | Admin must cancel bookings first, then delete slot. Clear but friction. |
| **P2: Soft-retire (add `isActive` flag)** | Set `isActive=false`; slot stops appearing for new bookings; existing bookings remain valid | Strong — bookings retain reference | Low — add field + filter | Admin can "turn off" a slot without losing history. Best UX. |
| **P3: Allow edits for future only** | Edit/delete applies to future bookings only; past bookings retain snapshot data | Moderate — booking stores `startTime`/`endTime` directly, so past is safe; future bookings may conflict | Medium — date comparison logic | Most flexible but most complex. |
| **P4: Snapshot availability at booking time** | Booking stores the slot reference but also copies `startTime`/`endTime`. Availability can be freely deleted. | Strong — booking is self-contained | Low — already the natural approach since Booking stores times | No admin friction. Historical data preserved. |

**Analysis of P4 (Snapshot):** The Booking model already stores `date`, `startTime`, `endTime` as direct fields (not just a reference to the availability block). This means deleting an availability block does NOT corrupt existing booking records — the times are preserved. The only thing lost is the ability to answer "what were this vet's available hours on Mondays?" from the availability table alone.

**Minimal v1 Policy: P4 (Snapshot) + P1 (Block delete if future bookings exist).**

Rationale:
- Booking already stores its own `date`/`startTime`/`endTime` — this IS the snapshot.
- Block hard-delete of availability blocks that have **future** bookings (not past) to prevent admin confusion: "I deleted the slot but there's still a booking there."
- Past bookings are inherently safe because their data is self-contained.
- No need for `isActive` on availability in v1 — adds complexity without clear benefit when the admin can just delete and recreate.

**Race/Transaction implications:**
- Checking for future bookings + deleting the slot must be atomic (Prisma `$transaction`).
- Concurrent booking creation while availability is being deleted: the booking's slot validation should check availability AT CREATION TIME inside the same transaction. If the slot is deleted between the check and the create, the unique constraint on `(vetId, date, startTime)` or the availability check catches it.

---

## Updated Recommendation

The original Approach A recommendation stands with these refinements:

1. **Pet**: Use nullable `petName: String?` on Booking. Defer `Pet` model to Phase 4. No migration needed later (additive column change).
2. **Client self-booking**: Split into Phase 3b. Phase 3a = admin/staff bookings only. Document this as an explicit scope decision.
3. **Client registration**: Not built in Phase 1. Must be built in Phase 3b (not Phase 3a).
4. **State machine**: Use Option C (Prisma `BookingStatus` enum + standalone transition policy map). Lightest weight, trivially testable, preserves future event extraction.
5. **Availability deletion**: Snapshot approach — Booking stores its own times. Block hard-delete of availability blocks with future bookings (409 Conflict). Atomic check+delete in `$transaction`.

## Ready for Proposal

**Yes.** All five questions are resolved with verified evidence. The orchestrator should tell the user:

1. Phase 3a scope: admin/staff bookings with state machine, slot validation, availability protection. ~350–400 lines.
2. Phase 3b scope (separate change): CLIENT role, client registration, client self-booking.
3. Pet model deferred to Phase 4; `petName` string placeholder on Booking.
4. State machine: Prisma enum + policy constant (Option C).
5. Availability protection: snapshot + block-delete-if-future-bookings.
6. Strict TDD applies — tests first.
