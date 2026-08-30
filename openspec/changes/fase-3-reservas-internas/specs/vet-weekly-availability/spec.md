# Delta for Vet Weekly Availability

## ADDED Requirements

### Requirement: Availability Deletion Guard

Block hard deletion of `VetAvailability` when future non-cancelled bookings depend on it.

| ID | Rule |
|---|---|
| AV10 | Block only when a non-cancelled booking for the same tenant/vet/day intersects the block and its `bookingStartInstant` is after `nowInstant` derived from the tenant timezone. |
| AV11 | Future CANCELLED bookings and past bookings do not block. |
| AV12 | Check and delete MUST be atomic. |
| AV13 | Existing bookings keep time snapshots. |

#### Scenario: Block delete with future non-cancelled booking

- GIVEN vet Monday 09:00-13:00 and future non-cancelled 09:00-10:00
- WHEN ADMIN deletes block
- THEN returns 409

#### Scenario: Allow delete with only cancelled future bookings

- GIVEN vet Monday 09:00-13:00 and future CANCELLED 09:00-10:00
- WHEN ADMIN deletes block
- THEN deleted, returns 200/204

#### Scenario: Allow delete with only past bookings

- GIVEN vet Monday 09:00-13:00 and past 09:00-10:00
- WHEN ADMIN deletes block
- THEN deleted, returns 200/204

## Traceability

AV10-AV13 → modified capability: availability deletion guard.
