# Design: Fase 2 — Clinic Configuration

## Approach

This design extends the existing NestJS API to support clinic configuration by adding three new modules (`services`, `availability`, `vet-profiles`) and modifying the existing `users` module. The approach follows established patterns from Phase 1, including layered architecture, DTO-based validation, and strict tenant isolation.

The existing `BaseRepository` at `src/database/base.repository.ts` (built in Phase 1) will be extended by all new repositories in Phase 2 to enforce tenant-scoped data access. All new entities will be added via a non-destructive Prisma migration.

## Architecture Decisions

### Decision: Centralized Tenant Isolation via BaseRepository

*   **Choice**: Extend the existing `BaseRepository` at `src/database/base.repository.ts` (built in Phase 1). All new entity-specific repositories (e.g., `ServiceRepository`, `VetProfileRepository`, `AvailabilityRepository`) will extend this class. The `BaseRepository` handles automatic injection of `tenantId` into all `create` and `find` operations.
*   **Alternatives considered**:
    1.  *Manual `tenantId` in every query*: Each service method would be responsible for adding `.where({ tenantId })`. This is error-prone and violates the DRY principle.
    2.  *Prisma Middleware*: A global Prisma middleware could intercept queries. This is a valid alternative, but a `BaseRepository` is more explicit, easier to test, and aligns better with the documented Repository Pattern in `STACK-nestjs.md`.
*   **Rationale**: Enforces tenant isolation as a non-negotiable, system-level constraint at the data-access layer. It prevents accidental tenant data leakage and makes the developer's job easier and safer.

### Decision: Atomic Vet Creation within UserService

*   **Choice**: The logic for the `POST /users/vets` endpoint, which creates a `User`, `UserTenant`, and `VetProfile`, will reside in the existing `UserService`. It will use Prisma's `$transaction` API to ensure atomicity. The transaction client performs the writes directly; `VetProfileRepository` remains available for tenant-scoped read paths and other modules because repository methods use the outer Prisma client and cannot participate in this transaction without a transaction-scoped delegate.
*   **Alternatives considered**: Creating a new `VetsService` to handle this.
*   **Rationale**: The primary entity being created is a `User` with a specific role and an associated profile. Keeping this logic within `UserService` centralizes user creation lifecycle, leverages existing user-handling logic (e.g., checking for email collisions), and avoids module cross-dependencies at the service layer.

## Data Flow

### Vet Creation (`POST /users/vets`)

```
    UserController ──(DTO)──> UserService ──(uses)──> UserRepository
                                      │
                                      └─(prisma.$transaction client)
                                           ├─ creates User, UserTenant
                                           └─ creates tenant-scoped VetProfile
```

*All database operations are wrapped in a single `prisma.$transaction` inside `UserService`.*

## File Changes

| File | Action | PR | Description |
|---|---|---|---|
| `vetary-api/prisma/schema.prisma` | Modify | 1 | Add `Service`, `VetProfile`, `VetAvailability` models and `timezone` to `Tenant`. |
| `vetary-api/src/modules/services/` | **Create** | 1 | New module for service catalog management (controller, service, repository extending existing BaseRepository, DTOs). |
| `vetary-api/src/modules/users/services/user.service.ts` | Modify | 2 | Add `createVet` transactional method; use the transaction client for atomic writes and the repository for tenant-scoped read paths. |
| `vetary-api/src/modules/users/controllers/user.controller.ts` | Modify | 2 | Add `POST /vets` and `POST /staff` endpoints. |
| `vetary-api/src/modules/vet-profiles/` | **Create** | 2 | New supporting module for vet profiles (repository, DTOs). No controller/service needed. |
| `vetary-api/src/modules/availability/` | **Create** | 3 | New module for vet availability (controller, service, repository, DTOs). |
| `vetary-api/test/` | Modify | 1,2,3 | Add integration and E2E tests for all new capabilities. |

## Interfaces / Contracts

### Database Schema (Prisma)

'''prisma
// In Tenant model
model Tenant {
  // ... existing fields
  timezone String @default("America/Santiago")

  services        Service[]
  vetProfiles     VetProfile[]
  vetAvailabilities VetAvailability[]
}

model Service {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  durationMinutes Int
  priceClp        Int
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
  @@index([tenantId, isActive])
  @@map("services")
}

model VetProfile {
  id                 String   @id @default(cuid())
  userId             String
  tenantId           String
  specialty          String?
  registrationNumber String?
  bio                String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@map("vet_profiles")
}

model VetAvailability {
  id          String   @id @default(cuid())
  vetId       String   // This is a userId with VET role
  tenantId    String
  dayOfWeek   Int // 0=Sunday, 1=Monday, ...
  startTime   String   // "HH:mm" format (e.g., "09:00")
  endTime     String   // "HH:mm" format (e.g., "17:30")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  vet    User   @relation(fields: [vetId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, vetId, dayOfWeek])
  @@map("vet_availabilities")
}
'''

### API DTOs (TypeScript)

'''typescript
// src/modules/services/dto/create-service.dto.ts
export class CreateServiceDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() description?: string;
  @IsInt() @IsPositive() durationMinutes: number;
  @IsInt() @Min(0) priceClp: number;
}

// src/modules/users/dto/create-vet.dto.ts
export class CreateVetDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsString() @IsOptional() specialty?: string;
  @IsString() @IsOptional() registrationNumber?: string;
  @IsString() @IsOptional() bio?: string;
  // password is auto-generated and sent via email in a later phase
}

// src/modules/availability/dto/create-availability.dto.ts
export class CreateAvailabilityDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) startTime: string;
  @IsString() @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) endTime: string;
}
'''

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | **AvailabilityService**: Overlap validation logic with various edge cases (touching, contained, overlapping). | Jest: Pure function tests with mock time-range data. |
| Integration | **UserService**: `createVet` transaction rollback on failure. **BaseRepository**: Automatic tenant scoping on all find/create methods. **Services/Availability**: CRUD operations respect tenant boundaries. | Jest + Test Database: Trigger service methods and assert database state. Verify that an ADMIN from tenant A cannot access tenant B's data. |
| E2E | **`/users/vets`**: Full HTTP flow from request to `201` response, checking all 3 tables (`User`, `UserTenant`, `VetProfile`). **`/availability`**: Create non-overlapping slots, then attempt to create an overlapping slot and assert `409 Conflict`. | Supertest: Simulate HTTP requests as an authenticated ADMIN and verify responses and status codes. |

## Migration / Rollout

This change includes a constraint replacement for `VetProfile`: the global
`userId` unique index is replaced by a composite `(tenantId, userId)` unique
index. The migration must be applied before the new application code is
deployed. Existing rows remain valid because each profile already belongs to a
tenant; only the uniqueness scope changes.

## Open Questions

- None at this time. The spec and proposal are sufficiently detailed for implementation to begin.
