> **DEPRECATED LAYOUT — superseded by domain delta specs under `specs/`:**
> `clinic-services/spec.md`, `users-vets/spec.md`, `users-staff/spec.md`, `vet-weekly-availability/spec.md`.
> This file is retained for historical reference only.

# Delta for Clinic Configuration (Phase 2)

**Change**: `fase-2-configuracion-clinica`

## Non-Goals
- No audit trail/versioning.
- No staff profile fields.
- No cross-midnight availability.

## ADDED Requirements

### Requirement: Clinic Services (`REQ-S01`..`REQ-S06`)
The system MUST provide tenant-scoped service lifecycle.

| ID | Requirement |
|---|---|
| REQ-S01 | `Service` includes: `name, description?, durationMinutes, priceClp, isActive, tenantId` (+id,timestamps). |
| REQ-S02 | `POST /api/v1/services` is ADMIN-only; `priceClp` is integer CLP `>=0`. |
| REQ-S03 | `GET /api/v1/services` returns active+inactive for current tenant only. |
| REQ-S04 | `PATCH /api/v1/services/:id` supports partial updates. |
| REQ-S05 | Delete is soft-disable only (`isActive=false`), never hard delete. |
| REQ-S06 | `name` unique per tenant; `durationMinutes>0`; `priceClp>=0`. |

#### Scenario: Service lifecycle
- GIVEN tenant A admin and tenant B data exists
- WHEN admin A creates/updates/disables/list services
- THEN only tenant A services are returned

### Requirement: Vet account creation (`REQ-V01`..`REQ-V05`)
The system MUST add admin-only `POST /api/v1/users/vets`.

| ID | Requirement |
|---|---|
| REQ-V01 | Endpoint creates `User + UserTenant + VetProfile` atomically. |
| REQ-V02 | `VetProfile` fields: `specialty?`, `registrationNumber?`, `bio?`. |
| REQ-V03 | Existing email reuses User; creates missing tenant membership. |
| REQ-V04 | ADMIN-only endpoint. |
| REQ-V05 | Role is enforced server-side as `VET`. |

#### Scenario: Existing email
- GIVEN email exists globally but not in current tenant
- WHEN admin calls `POST /users/vets`
- THEN system reuses User and creates membership + `VetProfile`

### Requirement: Staff account creation (`REQ-ST01`..`REQ-ST03`)

| ID | Requirement |
|---|---|
| REQ-ST01 | `POST /api/v1/users/staff` wraps `POST /users` with forced `role=STAFF`. |
| REQ-ST02 | Preserves Phase 1 email-collision behavior. |
| REQ-ST03 | ADMIN-only endpoint. |

#### Scenario: Wrapper
- GIVEN authenticated ADMIN
- WHEN `POST /users/staff` is called
- THEN system creates or links user with `UserTenant(role=STAFF)`

### Requirement: Vet weekly availability (`REQ-A01`..`REQ-A08`)

| ID | Requirement |
|---|---|
| REQ-A01 | Model `VetAvailability(vetId, tenantId, dayOfWeek, startTime, endTime)`. |
| REQ-A02 | Multiple blocks/day supported from v1. |
| REQ-A03 | Weekly recurring; no end-date concept in v1. |
| REQ-A04 | No overlap for same vet/day. |
| REQ-A05 | Cross-midnight blocks not supported in v1. |
| REQ-A06 | `POST /api/v1/availability/vets/:vetId/slots` is ADMIN-only; vet must belong to tenant. |
| REQ-A07 | `GET /api/v1/availability/vets/:vetId/slots` is tenant-scoped. |
| REQ-A08 | `DELETE /api/v1/availability/slots/:slotId` is ADMIN-only. |

#### Scenario: Invalid slot
- GIVEN existing Monday slot `09:00-13:00`
- WHEN creating `12:00-14:00` or `22:00-02:00`
- THEN API returns `409` overlap or `400` invalid range

## MODIFIED Requirements

### Requirement: User Management (Tenant-Scoped)
The system MUST keep Phase 1 `GET /users` and `POST /users` behavior and SHALL add `POST /users/vets` and `POST /users/staff` with same RBAC and tenant isolation.  
(Previously: users module only listed users and created generic users.)

#### Scenario: Isolation preserved
- GIVEN ADMIN from tenant A
- WHEN creating vet/staff users
- THEN memberships are created only within tenant A

## Prisma Schema Delta
- `Tenant`: add `timezone String @default("America/Santiago")`.
- `Service`: `tenantId` FK→Tenant (cascade), `name`, `description?`, `durationMinutes Int`, `priceClp Int`, `isActive Boolean @default(true)`, timestamps, `@@unique([tenantId,name])`, `@@index([tenantId])`, `@@index([tenantId,isActive])`.
- `VetProfile`: `userId` FK→User, `tenantId` FK→Tenant, optional `specialty/registrationNumber/bio`, timestamps, `@@unique([tenantId,userId])`, `@@index([tenantId])`. A user may have one profile per tenant.
- `VetAvailability`: `vetId` FK→User, `tenantId` FK→Tenant, `dayOfWeek Int`, `startTime String`, `endTime String`, timestamps, `@@index([tenantId,vetId,dayOfWeek])`.

## API Contract (Swagger)
- Required decorators: `@ApiTags`, `@ApiOperation`, `@ApiBody`, `@ApiParam`, `@ApiResponse`, `@ApiBearerAuth`.
- Auth: JWT; writes require `@Roles(Role.ADMIN)`.
- Errors: `400`, `401`, `403`, `404`, `409` (validation/auth/conflict cases).
- Response shape: `{ data, meta? }`.

## Test Acceptance Requirements
- **Services**: lifecycle, duplicate name, invalid duration/price, tenant isolation.
- **Vets**: atomic rollback, existing-email reuse, forced VET role, admin-only.
- **Staff**: wrapper behavior, collision handling, admin-only.
- **Availability**: multi-block success, overlap reject, cross-midnight reject, wrong-tenant reject, delete/list isolation.

## Chained PR Mapping (C3, D1)
- **PR-1**: Schema + `clinic-services` + tests (`REQ-S01..S06`).
- **PR-2**: `users/vets`, `users/staff`, `VetProfile` + tests (`REQ-V*`, `REQ-ST*`, modified users requirement).
- **PR-3**: `availability` + overlap validation + tests (`REQ-A01..A08`).
