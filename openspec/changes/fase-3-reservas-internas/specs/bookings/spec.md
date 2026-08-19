# Bookings Specification

## Purpose

Internal bookings created by ADMIN/STAFF against vet availability. Excludes client self-booking (`fase-3-reservas-publicas`) and `Pet` relation (Phase 4).

## Data Contract

`Booking`: id, tenantId, serviceId, vetId, petName (REQUIRED), date (tenant-local), startTime, endTime (derived), status, notes. Instants normalized to UTC for storage/comparison.

## Requirements

### Requirement: Timezone and Instant Model

Booking date/time uses tenant IANA timezone.

| ID | Rule |
|---|---|
| B13 | Construct `localStart` from `date` + `startTime` in tenant timezone. |
| B14 | Derive `localEnd = localStart + Service.durationMinutes`. |
| B15 | Reject nonexistent or ambiguous local times unless the design defines explicit disambiguation. |
| B16 | Compare booking intervals as half-open `[startInstant, endInstant)`. |
| B17 | Check availability fit using tenant-local weekday and wall-clock block. |
| B18 | "Future" means `bookingStartInstant > nowInstant` in tenant timezone. |

#### Scenario: Reject invalid local time

- GIVEN tenant `America/Santiago` on a spring-forward gap or fall-back duplicate
- WHEN creating a booking at the affected local time without offset
- THEN returns 400

### Requirement: Booking Creation

| ID | Rule |
|---|---|
| B01 | `endTime` derives from `Service.durationMinutes`. |
| B02 | Caller MUST NOT supply `endTime`. |
| B03 | Interval MUST fit the vet availability block. |
| B04 | Interval MUST NOT overlap a non-cancelled booking for the same tenant/vet/date. |
| B05 | Validation MUST be transactional. |
| B11 | `petName` MUST be present and non-empty. |

#### Scenario: Create valid booking

- GIVEN ADMIN, 30-min service, vet available 09:00-13:00
- WHEN `POST /bookings` at 2026-08-24 09:00 with petName "Luna"
- THEN returns 201, endTime "09:30"

#### Scenario: Overlap, adjacency, and cancellation semantics

- GIVEN vet Monday 09:00-10:00, non-cancelled booking 09:00-10:00, and CANCELLED booking 10:00-11:00
- WHEN creating 09:30 for 60 min, 10:00-11:00, or 09:30-10:00
- THEN outside/overlap returns 409 and adjacent/cancelled return 201

### Requirement: Booking Concurrency

Concurrent creation attempts for the same tenant/vet/overlapping interval MUST be serialized.

| ID | Rule |
|---|---|
| B19 | Pre-insert overlap checking alone is insufficient. |
| B20 | Concurrent overlapping attempts MUST result in exactly one success and one conflict or deterministic retry/failure. |
| B21 | The design MUST compare PostgreSQL exclusion constraints, SERIALIZABLE isolation, and a per-vet/date lock, then select and justify one. |

#### Scenario: Concurrent overlapping bookings

- GIVEN two parallel requests for the same overlapping slot
- WHEN processed
- THEN exactly one succeeds and the other returns 409

### Requirement: State Machine

Allow only valid `BookingStatus` transitions.

| ID | Rule |
|---|---|
| B06 | Valid: PENDING→{CONFIRMED,CANCELLED}; CONFIRMED→{IN_PROGRESS,CANCELLED}; IN_PROGRESS→{COMPLETED}; COMPLETED→{}; CANCELLED→{}. |
| B07 | Invalid transitions return 400. |

#### Scenario: Valid PENDING→CONFIRMED

- GIVEN PENDING booking
- WHEN ADMIN sets status CONFIRMED
- THEN returns 200, status CONFIRMED

#### Scenario: Invalid cancellation from terminal or in-progress state

- GIVEN COMPLETED or IN_PROGRESS booking
- WHEN ADMIN sets status CANCELLED
- THEN returns 400

### Requirement: RBAC and Tenant Isolation

Enforce roles and tenant isolation.

| ID | Rule |
|---|---|
| B08 | ADMIN/STAFF create and manage bookings. |
| B09 | VET reads own agenda only. |
| B10 | Every query filters by current tenant. |

#### Scenario: Isolation and own-agenda enforcement

- GIVEN VET has 2 bookings, another vet has 3, and ADMIN in tenant A queries tenant B
- WHEN listing bookings
- THEN VET sees only 2 and cross-tenant request returns empty/403/404

## Out of Scope

CLIENT role, public booking → `fase-3-reservas-publicas`. Pet relation → Phase 4. Notifications, audit, calendar UI.

## Deferred Debt

No-show/aborted booking handling is intentionally excluded. A confirmed booking where the client does not arrive remains CONFIRMED indefinitely and MUST be addressed in a later change.

## Traceability

B01-B21 → booking creation, timezone, overlap, concurrency. B06-B07 → state machine. B08-B10 → RBAC.

## Unresolved Decisions

U1: `notes` max length/sanitization. U2: VET status transition rights.
