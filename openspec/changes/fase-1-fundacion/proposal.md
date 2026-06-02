# SDD Proposal: Phase 1 — Auth + Multi-tenancy Foundation

**Change ID:** fase-1-fundacion  
**Status:** Proposed  
**Created:** 2026-05-31  
**Teaching Level:** Beginner  
**Strict TDD:** ACTIVE (auth, tenants, repositories)  

---

## 1. Executive Summary

Phase 1 establishes the **security and isolation foundation** for Vetary. Success means:

- A clinic can register with its subdomain (`clinica-veterinaria.vetary.app`)
- The admin can log in and see only their clinic's data
- The system **guarantees complete data isolation** between tenants
- A user can work in multiple clinics with the same email, different roles per clinic

This phase is **high-risk, high-impact**. Every feature after this one depends on tenant isolation being bulletproof. A mistake here propagates through the entire system and can cause GDPR violations.

**What we're building:**
- ✅ Tenant registration with subdomain validation
- ✅ JWT-based authentication (access + refresh tokens)
- ✅ Multi-clinic user model (one email, multiple tenants with different roles)
- ✅ BaseRepository with automatic tenant filtering
- ✅ Middleware + Guards enforcing tenant isolation at every layer

**What we're NOT building:**
- ❌ Password recovery (deferred to v2 — requires email)
- ❌ Super admin impersonation (documented for v2)
- ❌ Email notifications (v2)
- ❌ User profile editing (Phase 2: Users module expansion)

---

## 2. Scope

### ✅ IN SCOPE

1. **Tenant Management**
   - Registration with subdomain + admin user creation (atomic transaction)
   - Subdomain validation (reserved words, format, uniqueness)
   - Auto-activation on registration (status: ACTIVE)
   - Super admin can suspend/delete tenants (CRUD only, no impersonation)

2. **Authentication**
   - Login via email + password (returns access + refresh tokens)
   - Logout (revokes refresh token)
   - Token refresh (rotates tokens, invalidates old refresh token)
   - Password hashing (bcrypt)
   - JWT payload: `{ userId, tenantId, role }`

3. **Multi-Tenancy Model**
   - Subdomain-based tenant resolution (`clinica-a.vetary.app` → Tenant A)
   - `UserTenant` junction table: one user can belong to multiple tenants
   - Each `UserTenant` has one role (VET, ADMIN, STAFF) per clinic
   - Email is globally unique across the User table
   - Login resolves tenant context via subdomain
   - JWT contains single `tenantId` (the one user logged into)

4. **Authorization**
   - `@Public()` decorator for public routes (registration, login)
   - `@Roles(...)` decorator for role-based access control
   - Three guards: `AuthGuard` (JWT valid), `TenantGuard` (subdomain matches JWT), `RolesGuard` (user has required role)
   - Guard execution order: Auth → Tenant → Roles

5. **Multi-Clinic User Workflow**
   - User registers at Clinic A via `clinica-a.vetary.app/auth/register` → creates User + UserTenant(A, ADMIN)
   - Super admin invites same user to Clinic B → creates UserTenant(B, VET) using existing User
   - User visits `clinica-b.vetary.app/auth/login` → JWT has `{ userId: X, tenantId: B, role: VET }`
   - User visits `clinica-a.vetary.app` with Clinic B's token → TenantGuard rejects (403)

6. **Security Baseline**
   - CORS from env var (never `*` in production)
   - Helmet.js security headers
   - Rate limiting on auth endpoints
   - Input validation (class-validator) on all DTOs
   - Secrets in `.env`, validation on startup
   - BaseRepository enforces `tenantId` filtering (throws if missing)

7. **Testing Requirements (Strict TDD)**
   - Unit tests: repositories, services, guards
   - Integration tests: cross-tenant isolation per repository
   - E2E tests: login flow, token refresh, tenant mismatch rejection
   - Critical: test that Tenant A cannot access Tenant B's data

### ❌ OUT OF SCOPE (Explicit)

1. **Password Recovery** — Deferred to v2 (requires email infrastructure)
2. **Super Admin Impersonation** — Super admin manages tenants but cannot log in as a clinic user. Documented in `docs/decisions.md` for v2 consideration.
3. **Email Notifications** — All email (invitations, password resets) deferred to v2
4. **User Profile Editing** — Phase 2 (Users module expansion)
5. **Multi-Factor Authentication** — v2
6. **Session Management UI** — "Logout all devices" deferred to v2
7. **Audit Log** — v2 (will track logins, role changes, tenant switches)
8. **Tenant Approval Workflow** — Tenants are auto-active on registration. Approval workflow (if needed) is v2.

---

## 3. Architecture Decisions

### 3.1 Multi-Clinic User Model (APPROVED)

**Decision:** Replace `tenantId` on User with a `UserTenant` junction table.

**Rationale:**
- Real-world scenario: A veterinarian works at two clinics. She should use **one email**, not two accounts.
- Each clinic sees her with a different role (VET in Clinic A, ADMIN in Clinic B).
- Email is **globally unique** on the User model.
- Each `UserTenant` record stores: `userId`, `tenantId`, `role`.

**How login works:**
1. User visits `clinica-a.vetary.app/auth/login` with email `maria@vet.com`
2. System finds User by email, then finds UserTenant for `(userId, subdomain-resolved tenantId)`
3. If no UserTenant exists → 403 "You don't have access to this clinic"
4. If UserTenant exists → JWT payload: `{ userId, tenantId: A, role: ADMIN }`
5. User visits `clinica-b.vetary.app` with the same login → new JWT with `tenantId: B, role: VET`

**Impact on BaseRepository:**
- No change. Repositories still filter by `tenantId` from request context.
- The `tenantId` in JWT is single-tenant (the clinic the user is currently logged into).

**Teaching moment (beginner level):**
> Think of UserTenant as a "membership card." One person (User) can have multiple cards (UserTenant) for different clubs (Tenants). When you log into a clinic's subdomain, the system gives you the card for that clinic. If you don't have a card, you can't enter.

---

### 3.2 Tenant Resolution Strategy: Subdomain + JWT Verification

**Decision:** Subdomain-based tenant resolution with JWT as secondary verification.

**How it works:**
1. **TenantMiddleware** extracts subdomain from `request.hostname` (`clinica-a.vetary.app` → `clinica-a`)
2. Looks up Tenant by subdomain in DB
3. If not found → 404 "Tenant not found"
4. If found → attaches `req.tenant` to request context
5. **TenantGuard** (runs after AuthGuard) compares `req.tenant.id` vs `req.user.tenantId` (from JWT)
6. If mismatch → 403 "Your token belongs to a different clinic"

**Why not just use subdomain?**
- Subdomain tells us which clinic's data to show.
- JWT tells us which clinic the user has access to.
- Mismatch means the user manually changed the URL to access a different clinic's subdomain with a token from another clinic → reject.

**Edge case handled:** User logs into Clinic A, copies JWT, changes URL to Clinic B → TenantGuard rejects.

**Local development workaround:**
- `/etc/hosts` entry: `127.0.0.1 clinica-test.localhost`
- Or: env var `DEFAULT_TENANT_SUBDOMAIN=clinica-test` for localhost testing

---

### 3.3 JWT Strategy: Access + Refresh with DB-Backed Refresh Tokens

**Decision:** Use short-lived access tokens (15 minutes) + long-lived refresh tokens (7 days) stored in the database.

**Why not long-lived access tokens?**
- If a token is stolen, it's valid until expiration. A 7-day access token = 7 days of unrevocable access.
- With refresh tokens in the DB, we can revoke them (logout, suspicious activity).

**How refresh works:**
1. Client sends refresh token to `POST /auth/refresh`
2. AuthService checks RefreshToken table (exists, not expired, not revoked)
3. If valid → generates new access + refresh pair, marks old refresh token as revoked
4. Returns new tokens

**How logout works:**
1. Client sends refresh token to `POST /auth/logout`
2. AuthService marks refresh token as `revokedAt = now()`
3. Future attempts to use that token fail

**Why store in DB?**
- Security > convenience. Clinic data is sensitive. Revocable tokens are a best practice.

**Teaching moment (beginner level):**
> Access tokens are like a ticket to a concert. They expire in 15 minutes. Refresh tokens are like a membership card that lets you get new tickets. If you lose the card, we can cancel it. If you lose a ticket, it expires soon anyway.

---

### 3.4 BaseRepository Pattern: Abstract Class Inheritance

**Decision:** Use an abstract `BaseRepository<T>` class. All entity repositories extend it.

**Why inheritance over Prisma middleware?**
- **Explicit > implicit** for security-critical logic.
- Prisma middleware is "magic" — easy to forget it exists, hard to test in isolation.
- Inheritance makes tenant filtering **impossible to forget**. Every repository must call `findByTenant(tenantId, ...)`.

**Implementation:**
```typescript
export abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  protected async findByTenant(tenantId: string, where: any): Promise<T[]> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context missing');
    }
    return this.getDelegate().findMany({
      where: { tenantId, ...where },
    });
  }

  protected abstract getDelegate(): any; // PrismaClient['user'] | PrismaClient['booking']
}

export class UserRepository extends BaseRepository<User> {
  protected getDelegate() { return this.prisma.user; }
  
  // Note: User doesn't have tenantId (it's in UserTenant), so this repo
  // won't use findByTenant directly. But BookingRepository, PetRepository, etc. will.
}
```

**Teaching moment (beginner level):**
> Why do we use an abstract class? Because every repository that touches tenant data MUST filter by tenantId. If we forget, a clinic sees another clinic's data. Inheritance forces us to remember — if you extend BaseRepository, you inherit the filtering rule automatically.

---

### 3.5 Password Recovery Removed from Phase 1

**Decision:** Password recovery is deferred to v2.

**Reason:**
- SPEC requires email notifications for recovery, but email infrastructure is not in Phase 1.
- Options considered:
  1. Manual super admin reset → insecure, not self-service
  2. Token display in UI → terrible UX
  3. Implement email now → breaks phasing
- **Choice:** Defer. Document in `docs/decisions.md`.

**Impact:**
- User forgets password → must contact super admin for manual reset (v1 workaround)
- v2 adds email → password recovery flow becomes self-service

---

### 3.6 Super Admin: No Impersonation in v1

**Decision:** Super admin can manage tenants (activate, suspend, delete) but **cannot log in as a clinic user**.

**Reason:**
- Impersonation requires audit logging, session tracking, and role escalation rules.
- Cleaner isolation in v1: super admin context is entirely separate from tenant context.
- If support needs access to a clinic, they ask the clinic admin to create a support user account.

**Documented in:** `docs/decisions.md` with rationale + v2 consideration.

---

### 3.7 Tenant Activation: Auto-Active on Registration

**Decision:** New tenants are `status: ACTIVE` immediately on registration.

**Reason:**
- Faster MVP. Clinic can start using the system immediately.
- Super admin can suspend later if needed.
- Approval workflow (if required) can be added in v2.

---

## 4. Prisma Schema

```prisma
// ─────────────────────────────────────────────────────────────
// TENANT MODEL
// ─────────────────────────────────────────────────────────────
// 🏗️ ARQUITECTURA: Cada tenant representa una clínica veterinaria.
// Usa subdomain para resolución de tenant en requests (clinica-a.vetary.app).
// Status permite activar/suspender tenants sin borrarlos.

enum TenantStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

model Tenant {
  id        String       @id @default(cuid())
  name      String       // "Clínica Veterinaria San Martín"
  subdomain String       @unique // "clinica-san-martin" → clinica-san-martin.vetary.app
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  // Relations
  userTenants   UserTenant[]
  refreshTokens RefreshToken[]

  @@index([subdomain])
}

// ─────────────────────────────────────────────────────────────
// USER MODEL (MULTI-CLINIC)
// ─────────────────────────────────────────────────────────────
// 🏗️ ARQUITECTURA: Un User puede pertenecer a múltiples Tenants.
// Email es GLOBALMENTE único (un usuario, una cuenta, varios tenants).
// No hay tenantId en User — la relación está en UserTenant.

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  firstName    String
  lastName     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  userTenants   UserTenant[]
  refreshTokens RefreshToken[]

  @@index([email])
}

// ─────────────────────────────────────────────────────────────
// USER-TENANT JUNCTION (MEMBERSHIP + ROLE)
// ─────────────────────────────────────────────────────────────
// 📐 PATRÓN: Many-to-Many con atributos (role).
// Un User puede ser ADMIN en Tenant A y VET en Tenant B.
// JWT payload: { userId, tenantId, role } — resuelto al login vía subdomain.

enum Role {
  ADMIN   // Administrador de la clínica
  VET     // Veterinario
  STAFF   // Personal administrativo
}

model UserTenant {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  role      Role
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId]) // Un usuario no puede tener múltiples roles en el mismo tenant (v1 simplification)
  @@index([userId])
  @@index([tenantId])
}

// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN (DB-BACKED FOR REVOCATION)
// ─────────────────────────────────────────────────────────────
// 🔒 SEGURIDAD: Refresh tokens en DB permiten revocación (logout, logout all devices).
// Rotation: cada refresh genera un nuevo par y revoca el anterior.
// onDelete Cascade: si se borra un User o Tenant, sus tokens se borran automáticamente.

model RefreshToken {
  id        String    @id @default(cuid())
  token     String    @unique
  userId    String
  tenantId  String
  expiresAt DateTime
  revokedAt DateTime? // null = activo, not null = revocado (logout manual o automático)
  createdAt DateTime  @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId, tenantId])
}
```

**Teaching moments in schema:**

1. **Tenant.subdomain is unique** → prevents two clinics from using the same URL
2. **User.email is unique globally** → one person, one account, can access multiple clinics
3. **UserTenant is a junction table** → solves the many-to-many problem (User ↔ Tenant) while storing role
4. **RefreshToken has `revokedAt`** → nullable timestamp. If null, token is active. If not null, token is revoked (logout).
5. **`onDelete: Cascade`** → if we delete a User, all their UserTenant records and RefreshTokens are deleted automatically. Keeps DB clean.

---

## 5. Module Map

### 5.1 Build Order (Dependency Graph)

```
LAYER 0: Foundation
├─ database/BaseRepository (abstract class, tenant filtering)
├─ common/decorators (@Public, @Roles, @CurrentTenant, @CurrentUser)
└─ Prisma schema (Tenant, User, UserTenant, RefreshToken)

LAYER 1: Tenant Context
└─ common/middleware/TenantMiddleware (extracts subdomain, attaches tenant to req)

LAYER 2: Tenant Module
├─ tenants/TenantRepository (extends BaseRepository — wait, Tenant doesn't filter by tenantId)
├─ tenants/TenantService (registration, subdomain validation, transaction)
└─ tenants/TenantController (POST /tenants/register)

LAYER 3: Auth Module
├─ auth/JwtStrategy (validates JWT, extracts userId + tenantId + role)
├─ auth/AuthService (login, logout, refresh, hash, token generation)
└─ auth/AuthController (POST /auth/login, /auth/logout, /auth/refresh)

LAYER 4: Users Module (minimal in Phase 1)
├─ users/UserRepository (findByEmail, create — no tenant filtering on User itself)
├─ users/UserService (user CRUD, scoped to tenant via UserTenant)
└─ users/UserController (GET /users — returns users in current tenant)

LAYER 5: Guards
├─ common/guards/AuthGuard (JWT valid?)
├─ common/guards/TenantGuard (subdomain matches JWT tenantId?)
└─ common/guards/RolesGuard (user has required role?)
```

**Critical build rule:** BaseRepository MUST exist before any module that touches tenant-scoped data (Bookings, Pets, etc. — Phase 2+). But in Phase 1, only Tenant and User tables exist, and neither is scoped by tenantId (User is global, Tenant is the scope itself).

**Wait, clarification needed:** BaseRepository is designed for entities with `tenantId`. But User doesn't have `tenantId` (it's in UserTenant). So UserRepository doesn't extend BaseRepository. BookingRepository (Phase 2) will.

**Revised:** BaseRepository is built in Phase 1 as infrastructure for future modules, but not actively used until Phase 2. TenantRepository and UserRepository are direct Prisma wrappers without BaseRepository inheritance.

---

### 5.2 Module Responsibilities

#### `common/` (Cross-Cutting)

**Decorators:**
- `@Public()` — marks route as public (skips AuthGuard)
- `@Roles(...roles)` — marks route as requiring specific roles
- `@CurrentUser()` — injects `req.user` (JWT payload) into controller method
- `@CurrentTenant()` — injects `req.tenant` (from TenantMiddleware) into controller method

**Middleware:**
- `TenantMiddleware` — runs on every request, extracts subdomain, loads Tenant, attaches to `req.tenant`

**Guards:**
- `AuthGuard` — validates JWT, attaches decoded payload to `req.user`
- `TenantGuard` — ensures `req.tenant.id === req.user.tenantId`
- `RolesGuard` — checks if `req.user.role` is in `@Roles(...)`

**Execution order (CRITICAL):**
1. Middleware runs first (TenantMiddleware)
2. Then guards: `AuthGuard` → `TenantGuard` → `RolesGuard`

---

#### `database/` (Infrastructure)

**BaseRepository:**
- Abstract class with `findByTenant(tenantId, where)`, `createForTenant(tenantId, data)`, etc.
- Throws exception if `tenantId` is null/undefined
- Used by repositories in Phase 2+ (Bookings, Pets, Appointments)
- **Not used in Phase 1** (User and Tenant don't have tenantId field)

**PrismaService:**
- Wraps PrismaClient, injectable via DI

---

#### `tenants/` Module

**TenantRepository:**
- `findBySubdomain(subdomain: string): Promise<Tenant | null>`
- `create(data: CreateTenantDto): Promise<Tenant>`
- `updateStatus(id: string, status: TenantStatus): Promise<Tenant>`
- `delete(id: string): Promise<void>`

**TenantService:**
- `register(dto: RegisterTenantDto): Promise<{ tenant: Tenant, user: User }>` — atomic transaction (creates Tenant + User + UserTenant)
- `validateSubdomain(subdomain: string): void` — checks reserved words, format, uniqueness
- `findBySubdomain(subdomain: string): Promise<Tenant>`
- `suspend(id: string): Promise<Tenant>` — super admin only
- `delete(id: string): Promise<void>` — super admin only

**TenantController:**
- `POST /tenants/register` — public, creates tenant + admin user
- `PATCH /tenants/:id/suspend` — super admin only
- `DELETE /tenants/:id` — super admin only

---

#### `auth/` Module

**AuthService:**
- `login(email: string, password: string, tenantId: string): Promise<{ accessToken, refreshToken }>`
  - Validates credentials
  - Checks UserTenant exists for (userId, tenantId)
  - Generates JWT with `{ userId, tenantId, role }`
  - Stores refresh token in DB
- `logout(refreshToken: string): Promise<void>` — revokes refresh token
- `refresh(refreshToken: string): Promise<{ accessToken, refreshToken }>` — rotates tokens
- `hashPassword(password: string): Promise<string>` — bcrypt
- `comparePasswords(password: string, hash: string): Promise<boolean>`

**JwtStrategy:**
- Validates JWT signature
- Extracts payload `{ userId, tenantId, role }`
- Attaches to `req.user`

**AuthController:**
- `POST /auth/login` — public, returns tokens
- `POST /auth/logout` — authenticated, revokes refresh token
- `POST /auth/refresh` — public (but requires valid refresh token)

---

#### `users/` Module (minimal in Phase 1)

**UserRepository:**
- `findByEmail(email: string): Promise<User | null>`
- `findById(id: string): Promise<User | null>`
- `create(data: CreateUserDto): Promise<User>`

**UserService:**
- `findUsersInTenant(tenantId: string): Promise<User[]>` — joins UserTenant
- `findUserTenant(userId: string, tenantId: string): Promise<UserTenant | null>`
- `createUserTenant(userId: string, tenantId: string, role: Role): Promise<UserTenant>`

**UserController:**
- `GET /users` — returns all users in current tenant (authenticated, tenant-scoped)

---

## 6. API Surface

### 6.1 Public Routes (No Auth Required)

| Method | Path                 | Description                          | Request Body                                                                 | Response                                     |
| ------ | -------------------- | ------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------- |
| POST   | `/tenants/register`  | Register new clinic + admin user     | `{ name, subdomain, adminEmail, adminPassword, adminFirstName, adminLastName }` | `{ tenant: { id, subdomain }, user: { id, email } }` |
| POST   | `/auth/login`        | Login to tenant (subdomain-resolved) | `{ email, password }`                                                        | `{ accessToken, refreshToken }`              |
| POST   | `/auth/refresh`      | Refresh access token                 | `{ refreshToken }`                                                           | `{ accessToken, refreshToken }` (new pair)   |

**Teaching moment:** Why is `/auth/login` public? Because the user hasn't authenticated yet. `@Public()` decorator skips AuthGuard.

---

### 6.2 Authenticated Routes (Requires JWT)

| Method | Path            | Roles           | Description                          | Response                      |
| ------ | --------------- | --------------- | ------------------------------------ | ----------------------------- |
| POST   | `/auth/logout`  | Any             | Logout (revokes refresh token)       | `204 No Content`              |
| GET    | `/users`        | ADMIN, VET, STAFF | List users in current tenant         | `User[]`                      |

---

### 6.3 Super Admin Routes (Future — Not in Phase 1)

| Method | Path                    | Description            |
| ------ | ----------------------- | ---------------------- |
| PATCH  | `/tenants/:id/suspend`  | Suspend tenant         |
| DELETE | `/tenants/:id`          | Delete tenant          |

**Note:** Super admin authentication mechanism is NOT defined in Phase 1. Deferred to v2. For now, these endpoints exist but are not callable (no super admin login flow).

---

## 7. Security Model

### 7.1 Tenant Isolation Layers (Defense in Depth)

1. **Layer 1: Subdomain Resolution (TenantMiddleware)**
   - Every request extracts tenant from subdomain
   - Invalid subdomain → 404
   - Attaches `req.tenant`

2. **Layer 2: JWT Verification (AuthGuard)**
   - Validates JWT signature
   - Extracts `{ userId, tenantId, role }`
   - Attaches `req.user`

3. **Layer 3: Tenant Matching (TenantGuard)**
   - Compares `req.tenant.id` vs `req.user.tenantId`
   - Mismatch → 403 "Token does not belong to this clinic"

4. **Layer 4: Role Enforcement (RolesGuard)**
   - Checks `req.user.role` against `@Roles(...)` metadata
   - Missing role → 403 "Insufficient permissions"

5. **Layer 5: Repository Filtering (BaseRepository)**
   - All queries for tenant-scoped entities include `WHERE tenantId = ?`
   - Missing tenantId → throws exception (fail-safe)
   - **Note:** Phase 1 doesn't use this yet (User/Tenant aren't scoped). Phase 2 modules (Bookings, Pets) will.

**Teaching moment (beginner level):**
> Think of security layers like airport security. First checkpoint (TenantMiddleware): "Which airline?" Second (AuthGuard): "Show me your boarding pass." Third (TenantGuard): "Does your boarding pass match this airline?" Fourth (RolesGuard): "Are you allowed in first class?" Fifth (BaseRepository): "Even if you pass all checks, we still verify your seat number before letting you sit."

---

### 7.2 JWT Payload Structure

```json
{
  "userId": "clxxx123",
  "tenantId": "clyyy456",
  "role": "ADMIN",
  "iat": 1622505600,
  "exp": 1622506500
}
```

**Fields:**
- `userId` — which user (global)
- `tenantId` — which clinic they logged into (from subdomain context)
- `role` — their role in THIS clinic (from UserTenant)
- `iat` — issued at (Unix timestamp)
- `exp` — expires at (Unix timestamp)

**Access token expiry:** 15 minutes  
**Refresh token expiry:** 7 days (stored in DB, revocable)

---

### 7.3 Password Security

- **Hashing:** bcrypt with cost factor 10
- **Storage:** Only `passwordHash` stored, never plaintext
- **Validation:** Timing-safe comparison via bcrypt's `compare()`

---

### 7.4 CORS & Headers

- **CORS:** Allowed origins from `ALLOWED_ORIGINS` env var (comma-separated)
  - NEVER `*` in production
  - Example: `https://vetary.app,https://*.vetary.app`
- **Security headers (Helmet.js):**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

### 7.5 Rate Limiting

**Endpoints requiring rate limiting:**
- `POST /auth/login` — 5 attempts per IP per 15 minutes
- `POST /tenants/register` — 3 attempts per IP per hour

**Mechanism:** `@nestjs/throttler` with Redis backend (or in-memory for dev)

---

## 8. Risks & Mitigations

### 🔴 CRITICAL: Tenant Isolation Leakage

**Risk:** Bug in BaseRepository or TenantMiddleware allows queries without `tenantId` filter → one clinic sees another's data.

**Consequence:** GDPR violation, legal liability, complete trust loss.

**Mitigation:**
- BaseRepository throws exception if `tenantId` is null/undefined
- Integration test per repository (Phase 2+): create data for Tenant A, query as Tenant B, assert empty result
- E2E test: login as Clinic A admin, attempt to access Clinic B's booking via direct ID, assert 404 or 403
- Code review checklist: "Does this query filter by tenantId?"

**Detection:** Automated tests in CI + manual security audit before Phase 2.

---

### 🟠 HIGH: JWT/Subdomain Mismatch Exploitation

**Risk:** User logs into Clinic A, gets JWT with `tenantId: A`, manually changes URL to `clinica-b.vetary.app`. If TenantGuard is missing or misconfigured, they might access Clinic B's data.

**Consequence:** Authorization bypass.

**Mitigation:**
- TenantGuard is MANDATORY on all authenticated routes
- TenantGuard compares `req.tenant.id` (from subdomain) vs `req.user.tenantId` (from JWT)
- Mismatch → 403 with clear error message
- Test: login to Clinic A, call API with `Host: clinica-b.vetary.app` header, assert 403

**Detection:** E2E test, manual penetration test.

---

### 🟠 HIGH: Refresh Token Theft Without Revocation

**Risk:** If refresh tokens are stateless (no DB), a stolen token = permanent access until expiry (7 days).

**Consequence:** Compromised account cannot be locked out.

**Mitigation:**
- Store refresh tokens in DB with `revokedAt` field
- Logout revokes token immediately
- Token rotation: every refresh invalidates old token, issues new one
- Future (v2): "Logout all devices" endpoint

**Detection:** Manual security test (steal refresh token, logout, attempt refresh → should fail).

---

### 🟡 MEDIUM: Subdomain Validation Bypass

**Risk:** User registers tenant with subdomain `admin`, `api`, `www` → conflicts with system routes.

**Consequence:** Routing errors, potential security issues.

**Mitigation:**
- Reserved subdomains list: `['admin', 'api', 'www', 'app', 'auth', 'super', 'root', 'mail', 'smtp']`
- Subdomain regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase alphanumeric + hyphens, no underscores/special chars)
- Min length 3, max 63 (DNS limit)
- Validation in TenantService before DB insert, return 400 with clear error

**Detection:** Unit test with reserved subdomains, assert rejection.

---

### 🟡 MEDIUM: Tenant Registration Transaction Failure

**Risk:** Tenant is created, but admin User creation fails (DB error, validation error) → orphaned Tenant with no admin.

**Consequence:** Data inconsistency, tenant cannot be accessed.

**Mitigation:**
- Wrap in Prisma transaction:
  ```typescript
  await prisma.$transaction([
    prisma.tenant.create({ data: tenantData }),
    prisma.user.create({ data: userData }),
    prisma.userTenant.create({ data: userTenantData }),
  ]);
  ```
- If any fails, entire transaction rolls back
- Test: mock DB error on User creation, assert Tenant not created

**Detection:** Integration test, transaction rollback test.

---

### 🟢 LOW: Local Development Subdomain Workaround

**Risk:** Subdomain-based tenant resolution requires DNS setup. On localhost, `clinica-a.localhost` may not resolve without `/etc/hosts` edits.

**Consequence:** Developer cannot test multi-tenancy locally.

**Mitigation:**
- Document `/etc/hosts` setup in `docs/development.md`
- Optional: env var `DEFAULT_TENANT_SUBDOMAIN=clinica-test` for localhost (dev only, disabled in production)
- Alternative: use `ngrok` or `localhost.run` for temporary subdomains

**Detection:** Developer onboarding feedback.

---

## 9. Acceptance Criteria (From SPEC.md)

### ✅ Must Have (Phase 1 Complete)

1. **Tenant Registration**
   - [ ] Clinic can register with name + subdomain + admin credentials
   - [ ] Subdomain is validated (format, reserved words, uniqueness)
   - [ ] Registration creates Tenant + User + UserTenant in atomic transaction
   - [ ] Duplicate subdomain returns 409 Conflict
   - [ ] Reserved subdomain returns 400 Bad Request with clear error

2. **Authentication**
   - [ ] User can log in with email + password
   - [ ] Login returns access token (15min expiry) + refresh token (7 days)
   - [ ] Invalid credentials return 401 Unauthorized
   - [ ] User without access to tenant (no UserTenant) returns 403 Forbidden
   - [ ] Token refresh works (rotates tokens, invalidates old refresh token)
   - [ ] Logout revokes refresh token
   - [ ] Revoked refresh token cannot be used

3. **Multi-Clinic User Flow**
   - [ ] User can be member of multiple tenants (via UserTenant)
   - [ ] Each UserTenant has one role per clinic
   - [ ] Login via subdomain resolves correct tenant context
   - [ ] JWT contains single `tenantId` (the clinic logged into)
   - [ ] User with Clinic A token cannot access Clinic B's subdomain (TenantGuard rejects)

4. **Tenant Isolation**
   - [ ] TenantMiddleware extracts tenant from subdomain on every request
   - [ ] Invalid subdomain returns 404
   - [ ] TenantGuard compares subdomain vs JWT tenantId
   - [ ] Mismatch returns 403 with clear error
   - [ ] BaseRepository enforces tenantId filtering (Phase 2 modules will use it)

5. **Authorization**
   - [ ] AuthGuard validates JWT on protected routes
   - [ ] Public routes (`@Public()`) skip AuthGuard
   - [ ] RolesGuard enforces `@Roles(...)` decorator
   - [ ] User without required role returns 403

6. **Security Baseline**
   - [ ] Passwords hashed with bcrypt (cost factor 10)
   - [ ] CORS configured from env var (not hardcoded)
   - [ ] Helmet.js security headers enabled
   - [ ] Rate limiting on login (5 per IP per 15min) and registration (3 per IP per hour)
   - [ ] All DTOs validated with class-validator
   - [ ] Secrets loaded from `.env`, validation on startup

7. **Testing (Strict TDD)**
   - [ ] Unit tests for TenantService, AuthService, UserService
   - [ ] Integration tests for repositories (tenant isolation)
   - [ ] E2E tests for login flow, token refresh, logout
   - [ ] E2E test: Clinic A user cannot access Clinic B's data

### ❌ Explicitly Out of Scope (Phase 1)

- [ ] Password recovery (deferred to v2)
- [ ] Super admin impersonation (deferred to v2)
- [ ] Email notifications (v2)
- [ ] User profile editing (Phase 2)
- [ ] Audit log (v2)
- [ ] "Logout all devices" (v2)
- [ ] Tenant approval workflow (v2, if needed)

---

## 10. Dependencies & External Integrations

**Phase 1 has NO external integrations.** All functionality is self-contained.

**Future (v2+):**
- Email service (SendGrid, AWS SES) for password recovery, invitations
- Audit log storage (optional external analytics)

---

## 11. Rollback Plan

**Phase 1 is the foundation.** Rollback is all-or-nothing:
- If Phase 1 fails acceptance criteria → do NOT proceed to Phase 2
- No incremental rollback (multi-tenancy cannot be "partially enabled")

**Safety:**
- Use feature branch (`feature/fase-1-fundacion`)
- Do NOT merge to `develop` until all tests pass
- Keep `main` untouched until Phase 1 is production-ready

---

## 12. Success Criteria

Phase 1 is successful when:

1. ✅ A clinic can register via public API
2. ✅ Admin can log in and receives valid JWT
3. ✅ Same user can log into two different clinics with different roles
4. ✅ Clinic A admin CANNOT access Clinic B's data (tested via E2E)
5. ✅ Refresh token rotation works
6. ✅ Logout revokes tokens
7. ✅ All tests pass (unit, integration, E2E)
8. ✅ Security baseline met (CORS, Helmet, rate limiting, password hashing)
9. ✅ BaseRepository is implemented (ready for Phase 2 modules to use)

**Definition of "bulletproof tenant isolation":**
- No query can return data from a different tenant without explicit cross-tenant permission (Phase 1 has none)
- If `tenantId` is missing from a scoped query, the system throws an exception (fail-safe)
- E2E test proves Clinic A cannot access Clinic B

---

## 13. Open Questions (RESOLVED)

All ambiguities from exploration phase have been resolved:

1. ✅ **Password recovery** → Removed from Phase 1 (documented in Out of Scope)
2. ✅ **Super admin impersonation** → Not in v1 (documented for v2)
3. ✅ **Multi-clinic user accounts** → Approved (UserTenant junction table)
4. ✅ **Tenant activation** → Auto-active on registration

No blocking questions remain. Ready to proceed to **Spec phase**.

---

## 14. Next Steps

1. **Spec phase:** Define detailed API contracts (OpenAPI), DTOs, validation rules
2. **Design phase:** Sequence diagrams for critical flows (registration, login, multi-clinic login, token refresh)
3. **Tasks phase:** Break into TDD-driven work units
4. **Apply phase:** Implement modules in dependency order (BaseRepository → Tenant → Auth → Users → Guards)
5. **Verify phase:** Validate implementation against this proposal + acceptance criteria

---

## Metadata

**Estimated complexity:** High (5 modules, strict TDD, security-critical)  
**Estimated effort:** 3-4 work sessions (with TDD)  
**Risk level:** High (foundation phase, isolation bugs are catastrophic)  
**Teaching opportunities:** BaseRepository pattern, JWT strategy, many-to-many with attributes, transaction handling, guard execution order

---

**Proposal status:** Ready for review → Spec phase
