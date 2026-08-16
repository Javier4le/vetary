# Delta for Clinic Services

## ADDED Requirements

### Requirement: Service Model

The system MUST support a tenant-scoped Service catalog.

| ID | Requirement |
|---|---|
| S01 | `Service` includes `tenantId`, `name`, `description` (optional), `durationMinutes`, `priceClp`, `isActive`, timestamps. |
| S02 | `priceClp` is an integer CLP amount greater than or equal to 0. |
| S03 | `durationMinutes` is a positive integer. |
| S04 | `name` is unique within a tenant. |

#### Scenario: Create a service

- GIVEN an authenticated ADMIN in tenant A
- WHEN `POST /api/v1/services` is called with `{ name: "Consulta", durationMinutes: 30, priceClp: 15000 }`
- THEN the system MUST create a Service with `isActive=true` in tenant A
- AND return HTTP 201

#### Scenario: Reject invalid service input

- GIVEN an authenticated ADMIN
- WHEN `POST /api/v1/services` is called with `{ durationMinutes: 0, priceClp: -100 }`
- THEN the system MUST return HTTP 400

### Requirement: Service Lifecycle

The system MUST provide CRUD and soft-disable lifecycle for services.

| ID | Requirement |
|---|---|
| S05 | `GET /api/v1/services` returns services for the current tenant only. |
| S06 | `PATCH /api/v1/services/:id` supports partial updates within the tenant. |
| S07 | `DELETE /api/v1/services/:id` soft-disables by setting `isActive=false`. |
| S08 | Hard delete of services is NOT allowed. |

#### Scenario: Soft-disable a service

- GIVEN an existing active service in tenant A
- WHEN an ADMIN calls `DELETE /api/v1/services/:id`
- THEN the service `isActive` becomes `false`
- AND the record remains in the database

#### Scenario: Tenant isolation on list

- GIVEN services exist in tenant A and tenant B
- WHEN an ADMIN from tenant A calls `GET /api/v1/services`
- THEN the response MUST include only tenant A services

### Requirement: Service RBAC

The system MUST restrict service management to ADMIN.

| ID | Requirement |
|---|---|
| S09 | `POST /api/v1/services` requires ADMIN role. |
| S10 | `PATCH /api/v1/services/:id` requires ADMIN role. |
| S11 | `DELETE /api/v1/services/:id` requires ADMIN role. |

#### Scenario: Non-admin denied

- GIVEN an authenticated STAFF user
- WHEN the user calls `POST /api/v1/services`
- THEN the system MUST return HTTP 403
