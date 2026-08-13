# Delta for Vet Weekly Availability

## ADDED Requirements

### Requirement: Availability Model

The system MUST support recurring weekly availability blocks per vet.

| ID | Requirement |
|---|---|
| A01 | `VetAvailability` includes `vetId`, `tenantId`, `dayOfWeek`, `startTime`, `endTime`, timestamps. |
| A02 | Multiple blocks per day of week are supported. |
| A03 | Availability is weekly recurring with no end date in v1. |
| A04 | `dayOfWeek` uses 0=Sunday through 6=Saturday. |
| A05 | Cross-midnight blocks are not supported in v1. |

#### Scenario: Create availability block

- GIVEN an authenticated ADMIN in tenant A and a VET user in tenant A
- WHEN `POST /api/v1/availability/vets/:vetId/slots` is called with `{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }`
- THEN the system MUST create a VetAvailability record
- AND return HTTP 201

#### Scenario: Reject cross-midnight block

- GIVEN an authenticated ADMIN
- WHEN creating a block with `startTime: "22:00", endTime: "02:00"`
- THEN the system MUST return HTTP 400

### Requirement: Overlap Validation

The system MUST reject overlapping availability blocks for the same vet and day.

| ID | Requirement |
|---|---|
| A06 | New blocks MUST NOT overlap with existing blocks for the same vet and day. |
| A07 | Overlapping blocks return HTTP 409. |

#### Scenario: Reject overlapping block

- GIVEN a vet has Monday block `09:00-13:00`
- WHEN an ADMIN creates a new Monday block `12:00-14:00` for the same vet
- THEN the system MUST return HTTP 409

### Requirement: Availability RBAC and Tenant Isolation

The system MUST enforce RBAC and tenant isolation for availability.

| ID | Requirement |
|---|---|
| A08 | Creating and deleting availability slots is ADMIN-only. |
| A09 | Listing availability is allowed for authenticated users in the tenant. |
| A10 | Availability operations are scoped to the current tenant. |

#### Scenario: Wrong-tenant access denied

- GIVEN a VET user belongs to tenant A
- WHEN an ADMIN from tenant B attempts to create availability for that vet
- THEN the system MUST return HTTP 404 or 403

#### Scenario: Non-admin write denied

- GIVEN an authenticated STAFF user
- WHEN the user calls `POST /api/v1/availability/vets/:vetId/slots`
- THEN the system MUST return HTTP 403
