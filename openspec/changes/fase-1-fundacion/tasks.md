# Phase 1: Auth + Multi-tenancy Foundation — Implementation Tasks

**Change ID:** fase-1-fundacion  
**Status:** Tasks  
**Created:** 2026-05-31  
**Teaching Level:** Beginner  
**Strict TDD:** ACTIVE  
**Artifact Store:** openspec  

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,800–3,200 lines |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 (Foundation + Tenant) → PR 2 (Auth + Users) → PR 3 (Guards + E2E) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

**Decision needed before apply:** Yes  
**Chained PRs recommended:** Yes  
**Chain strategy:** stacked-to-main  
**400-line budget risk:** High  

---

## Execution Plan

This phase is estimated at **~3,000 lines** (code + tests). To respect the 400-line PR budget:

### PR 1: Foundation + Tenant Registration (T01–T10)
- **Scope:** Docker, NestJS init, Config, Prisma, BaseRepository, Decorators, Exception Filter, TenantMiddleware, TenantsModule
- **Estimated lines:** ~950 lines
- **Deliverable:** Tenant registration working with atomic transaction
- **Verification:** Can register a clinic via POST /api/v1/tenants/register

### PR 2: Auth + Users (T11–T14)
- **Scope:** UsersModule, AuthModule (JWT strategy, login, logout, refresh)
- **Estimated lines:** ~1,050 lines
- **Deliverable:** Full authentication flow (login, token refresh, logout)
- **Verification:** Can log in, refresh tokens, logout

### PR 3: Guards + End-to-End Security (T15–T18)
- **Scope:** AuthGuard, TenantGuard, RolesGuard, AppModule wiring, E2E tests for cross-tenant isolation
- **Estimated lines:** ~950 lines
- **Deliverable:** Complete tenant isolation enforcement with E2E proof
- **Verification:** E2E test proves Clinic A cannot access Clinic B's data

---

## Task List

### **T01: Docker Environment Setup**

**Layer:** Infrastructure  
**Pattern/Principle:** Infrastructure as Code (Docker Compose for reproducible dev environment)  
**Strict TDD?** No (infrastructure setup)

**Description:**
Set up Docker Compose with PostgreSQL 15 + Adminer for local development. This establishes the database foundation for all subsequent work.

**Dependencies:** None (first task)

**Files to create:**
- `vetary-api/docker-compose.yml`
- `vetary-api/.env.example`
- `vetary-api/.env` (gitignored)
- `vetary-api/.gitignore`

**Estimated lines:** ~60 lines

**Acceptance:**
- [ ] `docker-compose up -d` starts PostgreSQL on port 5432 and Adminer on 8080
- [ ] `.env.example` contains all required environment variables with placeholder values
- [ ] `.env` is gitignored
- [ ] PostgreSQL is accessible via connection string `postgresql://postgres:postgres@localhost:5432/vetary_dev`

**Teaching moment:**
> Docker Compose ensures every developer has the exact same database setup. No "works on my machine" — if it works in Docker, it works everywhere.

---

### **T02: NestJS Project Initialization**

**Layer:** Infrastructure  
**Pattern/Principle:** Framework Setup  
**Strict TDD?** No (framework initialization)

**Description:**
Initialize NestJS project with TypeScript strict mode, install core dependencies (Prisma, Passport, bcrypt, class-validator, helmet, throttler).

**Dependencies:** T01 (needs .env for DATABASE_URL)

**Files to create:**
- `vetary-api/package.json` (via `npm init -y` + dependencies)
- `vetary-api/tsconfig.json` (strict mode enabled)
- `vetary-api/nest-cli.json`
- `vetary-api/src/app.module.ts` (empty shell)
- `vetary-api/src/main.ts` (minimal bootstrap)

**Estimated lines:** ~80 lines

**Acceptance:**
- [ ] `npm install` succeeds
- [ ] `npm run start:dev` starts NestJS on port 3000
- [ ] TypeScript strict mode is enabled in `tsconfig.json`
- [ ] All dependencies installed: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@prisma/client`, `prisma`, `@nestjs/passport`, `@nestjs/jwt`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `helmet`, `@nestjs/throttler`

**Teaching moment:**
> TypeScript strict mode (`"strict": true`) catches type errors before runtime. No `any`, no undefined surprises. If it compiles, it's safer.

---

### **T03: Config Module with Environment Validation**

**Layer:** Cross-cutting (Infrastructure)  
**Pattern/Principle:** Fail Fast (validate environment on startup, not at runtime)  
**Strict TDD?** Yes (unit test for validation logic)

**Description:**
Create ConfigModule that validates all required environment variables on startup. If `JWT_SECRET`, `DATABASE_URL`, or other critical vars are missing, the app should crash with a clear error message.

**Dependencies:** T02 (NestJS initialized)

**Files to create:**
- `vetary-api/src/config/config.module.ts`
- `vetary-api/src/config/config.service.ts`
- `vetary-api/src/config/env.validation.ts`
- `vetary-api/test/unit/config/env.validation.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ✅ Valid environment with all required vars → validation passes
2. ❌ Missing `DATABASE_URL` → throws error with message "DATABASE_URL is required"
3. ❌ Missing `JWT_SECRET` → throws error
4. ❌ `JWT_SECRET` too short (< 32 chars) → throws error
5. ❌ `ALLOWED_ORIGINS = '*'` and `NODE_ENV = 'production'` → throws error "CORS wildcard not allowed in production"
6. ✅ `ALLOWED_ORIGINS` is comma-separated list → parses to array correctly

**Estimated lines:** ~150 lines (80 code + 70 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] App crashes on startup with clear error if env var is missing
- [ ] ConfigService is injectable and provides typed access to env vars
- [ ] ConfigModule is marked as global in AppModule

**Teaching moment:**
> **Fail Fast Principle:** If the app can't run without `JWT_SECRET`, it should fail immediately on startup, not when the first user tries to log in. Errors should be loud and early.

---

### **T04: Prisma Schema Definition**

**Layer:** Infrastructure (Data Model)  
**Pattern/Principle:** Schema as Source of Truth (database structure defined in code)  
**Strict TDD?** No (schema definition is declarative, not testable)

**Description:**
Define Prisma schema with Tenant, User, UserTenant, and RefreshToken models. This is the foundation of the multi-tenancy data model.

**Dependencies:** T01 (Docker running), T03 (DATABASE_URL from config)

**Files to create:**
- `vetary-api/prisma/schema.prisma`

**Estimated lines:** ~120 lines

**Acceptance:**
- [ ] Schema matches specification exactly (4 models: Tenant, User, UserTenant, RefreshToken)
- [ ] All enums defined (TenantStatus, Role)
- [ ] All relations defined with `onDelete: Cascade` where appropriate
- [ ] Indexes on `subdomain`, `email`, `token`, `[userId, tenantId]`
- [ ] `@@unique` constraint on `UserTenant.[userId, tenantId]`
- [ ] `npx prisma format` succeeds without errors

**Teaching moment:**
> Prisma schema is the single source of truth. Database migrations are generated FROM this schema, not written by hand. Change the schema, run `prisma migrate`, done.

---

### **T05: Prisma Migration and PrismaService**

**Layer:** Infrastructure (Database Access)  
**Pattern/Principle:** Database Module (centralized DB connection)  
**Strict TDD?** No (infrastructure setup, but integration test in T06 will validate)

**Description:**
Generate initial Prisma migration and create PrismaService + DatabaseModule. PrismaService is the single point of database access, injectable globally.

**Dependencies:** T04 (Prisma schema defined)

**Files to create:**
- `vetary-api/prisma/migrations/` (auto-generated by Prisma)
- `vetary-api/src/database/prisma.service.ts`
- `vetary-api/src/database/database.module.ts`

**Estimated lines:** ~60 lines

**Acceptance:**
- [ ] `npx prisma migrate dev --name init` succeeds
- [ ] Database tables created: `Tenant`, `User`, `UserTenant`, `RefreshToken`
- [ ] PrismaService extends `PrismaClient` and implements `OnModuleInit` + `OnModuleDestroy`
- [ ] DatabaseModule exports PrismaService
- [ ] DatabaseModule is marked as global in AppModule
- [ ] `npx prisma studio` opens and shows all 4 tables

**Teaching moment:**
> `PrismaService` is a singleton — one database connection pool shared across the entire app. No need to create new connections in every repository.

---

### **T06: BaseRepository Abstract Class**

**Layer:** Infrastructure (Data Access Pattern)  
**Pattern/Principle:** Template Method Pattern + Fail-Safe Filtering (enforces tenantId filtering)  
**Strict TDD?** Yes (unit test for fail-safe behavior)

**Description:**
Create abstract `BaseRepository<T>` class with protected methods (`findByTenant`, `createForTenant`, etc.) that enforce `tenantId` filtering. If `tenantId` is null/undefined, methods throw `UnauthorizedException`. This is the security foundation for all future tenant-scoped entities.

**Dependencies:** T05 (PrismaService available)

**Files to create:**
- `vetary-api/src/database/base.repository.ts`
- `vetary-api/test/unit/database/base.repository.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ❌ `findByTenant(null, {})` → throws `UnauthorizedException("Tenant context is missing")`
2. ❌ `findByTenant(undefined, {})` → throws `UnauthorizedException`
3. ❌ `createForTenant(null, {})` → throws `UnauthorizedException`
4. ✅ `findByTenant("valid-tenant-id", { status: 'active' })` → calls Prisma with `{ tenantId: 'valid-tenant-id', status: 'active' }`
5. ✅ `createForTenant("valid-tenant-id", { name: 'Test' })` → calls Prisma with `{ tenantId: 'valid-tenant-id', name: 'Test' }`

**Estimated lines:** ~180 lines (100 code + 80 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] `BaseRepository` is abstract class with `protected` methods
- [ ] Every method checks `tenantId` is truthy before executing query
- [ ] Abstract method `getDelegate()` must be implemented by subclasses
- [ ] Clear JSDoc comments explaining the security contract

**Teaching moment:**
> **Template Method Pattern:** The base class defines the skeleton (`findByTenant`), and subclasses fill in the details (`getDelegate`). The security check (tenantId validation) is enforced in ONE place, impossible to forget.

---

### **T07: Common Decorators**

**Layer:** Cross-cutting (Presentation/Application)  
**Pattern/Principle:** Decorator Pattern (metadata for guards and dependency injection)  
**Strict TDD?** No (decorators are metadata, tested via integration)

**Description:**
Create custom decorators for route metadata: `@Public()` (skips auth), `@Roles(...)` (required roles), `@CurrentUser()` (extracts user from request), `@CurrentTenant()` (extracts tenant from request).

**Dependencies:** None (pure metadata)

**Files to create:**
- `vetary-api/src/common/decorators/public.decorator.ts`
- `vetary-api/src/common/decorators/roles.decorator.ts`
- `vetary-api/src/common/decorators/current-user.decorator.ts`
- `vetary-api/src/common/decorators/current-tenant.decorator.ts`

**Estimated lines:** ~60 lines

**Acceptance:**
- [ ] `@Public()` sets metadata key `IS_PUBLIC_KEY = true`
- [ ] `@Roles(Role.ADMIN, Role.VET)` sets metadata key `ROLES_KEY = [Role.ADMIN, Role.VET]`
- [ ] `@CurrentUser()` extracts `req.user` from ExecutionContext
- [ ] `@CurrentTenant()` extracts `req.tenant` from ExecutionContext
- [ ] All decorators are exported from `common/decorators/index.ts`

**Teaching moment:**
> Decorators are like sticky notes on a function. `@Roles(Role.ADMIN)` is a note that says "only admins allowed." Guards read these notes and enforce them.

---

### **T08: HTTP Exception Filter**

**Layer:** Cross-cutting (Presentation)  
**Pattern/Principle:** Global Error Handling (consistent error format)  
**Strict TDD?** No (filter is tested via E2E)

**Description:**
Create global exception filter that formats all HTTP errors consistently: `{ statusCode, message, error }`. Catches validation errors, HTTP exceptions, and unexpected errors. Never exposes stack traces in production.

**Dependencies:** T02 (NestJS initialized)

**Files to create:**
- `vetary-api/src/common/filters/http-exception.filter.ts`

**Estimated lines:** ~40 lines

**Acceptance:**
- [ ] All `HttpException` instances are formatted as `{ statusCode, message, error }`
- [ ] Validation errors (from `ValidationPipe`) are formatted as array of messages
- [ ] Stack traces are NOT exposed when `NODE_ENV=production`
- [ ] Filter is registered globally in `main.ts` via `app.useGlobalFilters()`

**Teaching moment:**
> Global exception filters ensure every error response looks the same. Frontend knows exactly what to expect: always `{ statusCode, message, error }`. No surprises.

---

### **T09: TenantMiddleware**

**Layer:** Cross-cutting (Infrastructure/Presentation)  
**Pattern/Principle:** Middleware Pattern (extract tenant context from subdomain)  
**Strict TDD?** Yes (unit test for subdomain extraction logic)

**Description:**
Create middleware that extracts subdomain from `req.hostname`, queries Tenant from database, and attaches to `req.tenant`. If subdomain is invalid or tenant not found, returns 404. This runs BEFORE all guards.

**Dependencies:** T10 (TenantService for DB query — circular, so stub in test)

**Files to create:**
- `vetary-api/src/common/middleware/tenant.middleware.ts`
- `vetary-api/test/unit/common/middleware/tenant.middleware.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ✅ Hostname `clinica-a.vetary.app` → extracts `clinica-a`, queries tenant, attaches `req.tenant`
2. ❌ Hostname `localhost` → returns null subdomain (dev mode uses env var fallback)
3. ❌ Subdomain `nonexistent` → tenant not found → throws `NotFoundException("Tenant not found")`
4. ✅ Subdomain `clinica-norte-veterinaria` → extracts correctly (multi-hyphen)
5. ❌ Hostname with single part (`example.com` → `example`) → returns null

**Estimated lines:** ~120 lines (70 code + 50 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] Middleware extracts subdomain correctly from multi-level domains
- [ ] Middleware attaches `req.tenant` object with `{ id, name, subdomain, status }`
- [ ] Middleware is registered globally in AppModule via `MiddlewareConsumer`

**Teaching moment:**
> Middleware is like a checkpoint at the entrance. Before you even reach the controller (the building), the checkpoint (middleware) checks your badge (subdomain) and gives you your tenant context.

---

### **T10: TenantsModule — Repository, Service, Controller**

**Layer:** Application + Infrastructure (Tenant Management)  
**Pattern/Principle:** Repository Pattern + Transaction Pattern (atomic registration)  
**Strict TDD?** Yes (unit tests for service, integration test for transaction)

**Description:**
Create TenantRepository (Prisma wrapper), TenantService (business logic: subdomain validation, registration transaction), and TenantController (POST /api/v1/tenants/register). Registration creates Tenant + User + UserTenant atomically.

**Dependencies:** T05 (PrismaService), T07 (decorators)

**Files to create:**
- `vetary-api/src/modules/tenants/dto/register-tenant.dto.ts`
- `vetary-api/src/modules/tenants/repositories/tenant.repository.ts`
- `vetary-api/src/modules/tenants/services/tenant.service.ts`
- `vetary-api/src/modules/tenants/controllers/tenant.controller.ts`
- `vetary-api/src/modules/tenants/tenants.module.ts`
- `vetary-api/test/unit/modules/tenants/tenant.service.spec.ts` (TEST FIRST)
- `vetary-api/test/integration/modules/tenants/tenant-registration.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**

**Unit tests (TenantService):**
1. ❌ `validateSubdomain("admin")` → throws `BadRequestException("Subdomain 'admin' is reserved")`
2. ❌ `validateSubdomain("Clinica-Norte")` → throws (uppercase not allowed)
3. ❌ `validateSubdomain("clinica_norte")` → throws (underscore not allowed)
4. ❌ `validateSubdomain("ab")` → throws (too short, min 3 chars)
5. ✅ `validateSubdomain("clinica-norte-veterinaria")` → passes

**Integration tests (Registration transaction):**
1. ✅ Valid registration → creates Tenant + User + UserTenant, returns both
2. ❌ Duplicate subdomain → throws 409 Conflict
3. ❌ Duplicate email → transaction rolls back, Tenant NOT created
4. ❌ Reserved subdomain → throws 400 Bad Request

**Estimated lines:** ~380 lines (200 code + 180 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] POST /api/v1/tenants/register accepts `RegisterTenantDto`
- [ ] DTO validates: name (3-100 chars), subdomain (regex), email (valid), password (min 8, alpha+num), firstName, lastName
- [ ] TenantService.register wraps in Prisma transaction (`prisma.$transaction`)
- [ ] Password is hashed with bcrypt (cost factor 10)
- [ ] Transaction rollback test: if User creation fails, Tenant is NOT created
- [ ] Reserved words list: `['admin', 'api', 'www', 'app', 'auth', 'super', 'root', 'mail', 'smtp']`

**Teaching moment:**
> **Transaction Pattern:** Creating a tenant is an all-or-nothing operation. Either we create Tenant + User + UserTenant, or we create nothing. Prisma's `$transaction` ensures atomicity — if any step fails, the database rolls back.

---

### **T11: UsersModule — Repository, Service, Controller**

**Layer:** Application + Infrastructure (User Management)  
**Pattern/Principle:** Repository Pattern + Junction Table Handling (UserTenant)  
**Strict TDD?** Yes (unit tests for service, integration test for multi-tenant user)

**Description:**
Create UserRepository (Prisma wrapper), UserService (user CRUD scoped to tenant via UserTenant), and UserController (GET /api/v1/users, POST /api/v1/users). When creating a user, if email already exists, reuse User and create new UserTenant.

**Dependencies:** T05 (PrismaService), T07 (decorators)

**Files to create:**
- `vetary-api/src/modules/users/dto/create-user.dto.ts`
- `vetary-api/src/modules/users/dto/update-user.dto.ts`
- `vetary-api/src/modules/users/repositories/user.repository.ts`
- `vetary-api/src/modules/users/services/user.service.ts`
- `vetary-api/src/modules/users/controllers/user.controller.ts`
- `vetary-api/src/modules/users/users.module.ts`
- `vetary-api/test/unit/modules/users/user.service.spec.ts` (TEST FIRST)
- `vetary-api/test/integration/modules/users/multi-tenant-user.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**

**Unit tests (UserService):**
1. ✅ `findUsersInTenant(tenantId)` → queries UserTenant for tenantId, joins User, returns users
2. ✅ `createUser(tenantId, dto)` with new email → creates User + UserTenant
3. ✅ `createUser(tenantId, dto)` with existing email → reuses User, creates new UserTenant
4. ❌ `createUser(tenantId, dto)` with existing email + existing UserTenant → throws 409 Conflict

**Integration tests (Multi-tenant user):**
1. ✅ User exists in Tenant A → calling `findUsersInTenant(tenantB.id)` does NOT return that user
2. ✅ Create user with existing email in different tenant → User is reused, new UserTenant created
3. ✅ Same user in two tenants has different roles (ADMIN in A, VET in B)

**Estimated lines:** ~320 lines (180 code + 140 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] GET /api/v1/users returns only users in current tenant (via UserTenant join)
- [ ] POST /api/v1/users with new email → creates User + UserTenant
- [ ] POST /api/v1/users with existing email → finds User by email, creates only UserTenant
- [ ] Trying to create duplicate UserTenant (same userId + tenantId) → throws 409
- [ ] DTO validates: email, password (min 8), firstName (2-50), lastName (2-50), role (enum)

**Teaching moment:**
> **Junction Table Pattern:** UserTenant is the bridge between User and Tenant. One user can belong to multiple tenants with different roles. This is a many-to-many relationship with attributes (role).

---

### **T12: AuthModule — JWT Strategy**

**Layer:** Infrastructure (Authentication)  
**Pattern/Principle:** Strategy Pattern (Passport JWT Strategy for token validation)  
**Strict TDD?** No (JWT strategy is Passport infrastructure, tested via E2E)

**Description:**
Create JwtStrategy that validates JWT signature and extracts payload. Strategy does NOT query database — it trusts the JWT payload. Registers with Passport as 'jwt' strategy.

**Dependencies:** T03 (ConfigService for JWT_SECRET)

**Files to create:**
- `vetary-api/src/modules/auth/strategies/jwt.strategy.ts`
- `vetary-api/src/modules/auth/interfaces/jwt-payload.interface.ts`
- `vetary-api/src/modules/auth/auth.module.ts` (partial — just JwtModule + Passport setup)

**Estimated lines:** ~80 lines

**Acceptance:**
- [ ] JwtStrategy extends PassportStrategy(Strategy, 'jwt')
- [ ] Strategy uses `ExtractJwt.fromAuthHeaderAsBearerToken()`
- [ ] Strategy uses `JWT_SECRET` from ConfigService
- [ ] `validate(payload)` method returns `{ userId: payload.sub, tenantId: payload.tenantId, role: payload.role, email: payload.email }`
- [ ] AuthModule imports JwtModule.register with secret and expiresIn from config
- [ ] AuthModule imports PassportModule

**Teaching moment:**
> **Strategy Pattern:** Passport uses the Strategy pattern. JwtStrategy is one strategy for authentication. We could add GoogleStrategy, LocalStrategy, etc. — Passport handles the wiring, we just define how to validate.

---

### **T13: AuthModule — Service (Login, Logout, Refresh)**

**Layer:** Application (Authentication Logic)  
**Pattern/Principle:** Service Layer + Token Rotation (security best practice)  
**Strict TDD?** Yes (unit tests for login, refresh, password hashing)

**Description:**
Create AuthService with login (validates credentials, generates tokens), logout (revokes refresh token), refresh (rotates tokens), and password utilities (hash, compare). Login resolves UserTenant via tenantId from request context.

**Dependencies:** T10 (TenantService), T11 (UserService), T12 (JwtModule)

**Files to create:**
- `vetary-api/src/modules/auth/dto/login.dto.ts`
- `vetary-api/src/modules/auth/dto/refresh-token.dto.ts`
- `vetary-api/src/modules/auth/services/auth.service.ts`
- `vetary-api/test/unit/modules/auth/auth.service.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ✅ `hashPassword("SecurePass123!")` → returns bcrypt hash starting with `$2b$10$`
2. ✅ `comparePasswords("SecurePass123!", hash)` → returns true
3. ❌ `comparePasswords("WrongPass", hash)` → returns false
4. ✅ `login(email, password, tenantId)` with valid credentials → returns `{ accessToken, refreshToken }`
5. ❌ `login(email, password, tenantId)` with wrong password → throws 401
6. ❌ `login(email, password, tenantId)` where user has no UserTenant for tenantId → throws 403
7. ✅ `refresh(refreshToken)` with valid token → revokes old, returns new pair
8. ❌ `refresh(refreshToken)` with revoked token → throws 401
9. ❌ `refresh(refreshToken)` with expired token → throws 401
10. ✅ `logout(refreshToken)` → marks token as revoked

**Estimated lines:** ~380 lines (220 code + 160 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] `hashPassword` uses bcrypt with cost factor 10 (from config)
- [ ] `comparePasswords` uses bcrypt.compare (timing-safe)
- [ ] `login` generates JWT with payload `{ sub: userId, tenantId, role, email, iat, exp }`
- [ ] Access token expiry: 15 minutes (from config)
- [ ] Refresh token: random UUID stored in RefreshToken table with 7-day expiry
- [ ] `refresh` uses Prisma transaction: revoke old + create new
- [ ] `logout` sets `revokedAt = now()` on RefreshToken record

**Teaching moment:**
> **Token Rotation:** Every time you refresh, we give you a new pair and invalidate the old one. If someone steals your refresh token, they can use it ONCE. After that, it's dead.

---

### **T14: AuthModule — Controller**

**Layer:** Presentation (HTTP Endpoints)  
**Pattern/Principle:** Thin Controller (delegate to service, no business logic)  
**Strict TDD?** No (controller is tested via E2E)

**Description:**
Create AuthController with POST /api/v1/auth/login, POST /api/v1/auth/logout, POST /api/v1/auth/refresh, GET /api/v1/auth/me. All routes except /me are public.

**Dependencies:** T13 (AuthService)

**Files to create:**
- `vetary-api/src/modules/auth/controllers/auth.controller.ts`

**Estimated lines:** ~100 lines

**Acceptance:**
- [ ] POST /api/v1/auth/login decorated with `@Public()`, accepts `LoginDto`, returns `{ accessToken, refreshToken }`
- [ ] POST /api/v1/auth/logout requires auth, accepts `RefreshTokenDto`, returns 204 No Content
- [ ] POST /api/v1/auth/refresh decorated with `@Public()`, accepts `RefreshTokenDto`, returns new token pair
- [ ] GET /api/v1/auth/me requires auth, uses `@CurrentUser()` and `@CurrentTenant()`, returns user + tenant info
- [ ] All endpoints have Swagger decorators (`@ApiOperation`, `@ApiResponse`)

**Teaching moment:**
> **Thin Controller Principle:** Controllers receive, validate, delegate to service, and respond. Zero business logic. If you see `if` statements or calculations in a controller, something's wrong.

---

### **T15: Guards — AuthGuard, TenantGuard, RolesGuard**

**Layer:** Cross-cutting (Security/Authorization)  
**Pattern/Principle:** Guard Chain (layered security checks)  
**Strict TDD?** Yes (unit tests for guard logic)

**Description:**
Create three guards: AuthGuard (validates JWT, skips if @Public()), TenantGuard (compares req.tenant.id vs req.user.tenantId), RolesGuard (checks req.user.role vs @Roles()). Execution order is CRITICAL.

**Dependencies:** T07 (decorators), T12 (JwtStrategy)

**Files to create:**
- `vetary-api/src/common/guards/auth.guard.ts`
- `vetary-api/src/common/guards/tenant.guard.ts`
- `vetary-api/src/common/guards/roles.guard.ts`
- `vetary-api/test/unit/common/guards/auth.guard.spec.ts` (TEST FIRST)
- `vetary-api/test/unit/common/guards/tenant.guard.spec.ts` (TEST FIRST)
- `vetary-api/test/unit/common/guards/roles.guard.spec.ts` (TEST FIRST)

**Test cases (write FIRST):**

**AuthGuard:**
1. ✅ Route with `@Public()` → returns true without checking JWT
2. ✅ Valid JWT → calls Passport JWT strategy, returns true
3. ❌ Invalid JWT → throws 401 Unauthorized

**TenantGuard:**
1. ✅ Route with `@Public()` → returns true (skips check)
2. ✅ `req.tenant.id === req.user.tenantId` → returns true
3. ❌ `req.tenant.id !== req.user.tenantId` → throws 403 "Your token belongs to a different clinic"
4. ❌ `req.tenant` or `req.user` missing → throws 403

**RolesGuard:**
1. ✅ No `@Roles()` decorator → returns true (no role requirement)
2. ✅ User role in required roles → returns true
3. ❌ User role NOT in required roles → throws 403 "Insufficient permissions"

**Estimated lines:** ~280 lines (140 code + 140 tests)

**Acceptance:**
- [ ] All test cases pass (RED → GREEN → REFACTOR)
- [ ] AuthGuard extends `AuthGuard('jwt')` from Passport
- [ ] AuthGuard checks `IS_PUBLIC_KEY` metadata before validating JWT
- [ ] TenantGuard checks `IS_PUBLIC_KEY`, then compares tenant IDs
- [ ] RolesGuard checks `ROLES_KEY` metadata and `req.user.role`
- [ ] All guards are exported from `common/guards/index.ts`

**Teaching moment:**
> **Guard Chain:** Think of security like airport checkpoints. First, show your ticket (AuthGuard). Then, verify your ticket matches this terminal (TenantGuard). Finally, check if you have lounge access (RolesGuard). Order matters — can't check lounge access before verifying the ticket!

---

### **T16: AppModule Wiring**

**Layer:** Cross-cutting (Application Configuration)  
**Pattern/Principle:** Module Composition (dependency injection wiring)  
**Strict TDD?** No (module wiring tested via E2E)

**Description:**
Wire all modules together in AppModule. Register TenantMiddleware globally, configure global guards (optional), import all feature modules.

**Dependencies:** T03–T15 (all modules created)

**Files to create/modify:**
- `vetary-api/src/app.module.ts` (update)
- `vetary-api/src/main.ts` (update with security baseline)

**Estimated lines:** ~120 lines

**Acceptance:**
- [ ] AppModule imports: ConfigModule (global), PrismaModule (global), CommonModule, TenantsModule, AuthModule, UsersModule
- [ ] ThrottlerModule configured: 5 req/15min for /auth/login, 3 req/hour for /tenants/register
- [ ] TenantMiddleware registered globally via `MiddlewareConsumer.apply().forRoutes('*')`
- [ ] main.ts applies: Helmet, CORS (from config), ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- [ ] main.ts sets global prefix `/api/v1`
- [ ] main.ts configures Swagger at `/docs`
- [ ] main.ts applies HttpExceptionFilter globally

**Teaching moment:**
> **Dependency Injection Wiring:** NestJS automatically injects dependencies when modules import/export correctly. If AuthModule imports UsersModule and UsersModule exports UserService, AuthService can inject UserService. This is the "magic" of DI.

---

### **T17: E2E Test — Registration and Login Flow**

**Layer:** Cross-cutting (End-to-End Verification)  
**Pattern/Principle:** E2E Testing (happy path verification)  
**Strict TDD?** Yes (E2E tests are part of Strict TDD — verify system behavior)

**Description:**
Create E2E test that proves the complete registration → login → authenticated request flow works. Uses supertest to call actual HTTP endpoints.

**Dependencies:** T16 (AppModule wired)

**Files to create:**
- `vetary-api/test/e2e/auth/registration-login.e2e-spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ✅ POST /api/v1/tenants/register → 201, returns tenant + user
2. ✅ POST /api/v1/auth/login with registered user → 200, returns access + refresh tokens
3. ✅ GET /api/v1/auth/me with access token → 200, returns user + tenant
4. ✅ POST /api/v1/auth/refresh with refresh token → 200, returns new token pair
5. ✅ POST /api/v1/auth/logout with refresh token → 204
6. ❌ POST /api/v1/auth/refresh with revoked token → 401

**Estimated lines:** ~180 lines

**Acceptance:**
- [ ] All test cases pass (E2E against real database)
- [ ] Tests use separate test database (DATABASE_URL with `_test` suffix)
- [ ] Tests clean up database after each run (`beforeEach` truncates tables)
- [ ] JWT payload contains `{ sub, tenantId, role, email }`

**Teaching moment:**
> **E2E Tests:** Unit tests verify pieces in isolation. E2E tests verify the ENTIRE SYSTEM works together. If E2E passes, we're confident users can actually register, log in, and use the app.

---

### **T18: E2E Test — Cross-Tenant Isolation (CRITICAL)**

**Layer:** Cross-cutting (Security Verification)  
**Pattern/Principle:** Security Testing (prove isolation works)  
**Strict TDD?** Yes (THIS IS THE MOST CRITICAL TEST IN PHASE 1)

**Description:**
Create E2E test that proves Clinic A cannot access Clinic B's data. This test is the ultimate verification of tenant isolation — if it passes, the system is secure.

**Dependencies:** T16 (AppModule wired), T17 (basic flow works)

**Files to create:**
- `vetary-api/test/e2e/security/cross-tenant-isolation.e2e-spec.ts` (TEST FIRST)

**Test cases (write FIRST):**
1. ❌ Clinic A user with valid JWT tries to access Clinic B's subdomain → 403 "Your token belongs to a different clinic"
2. ❌ Clinic A user tries to access Clinic B's user by ID → 404 or 403 (user not in tenant)
3. ✅ Clinic A user accesses Clinic A's subdomain → 200 success
4. ✅ User belongs to both Clinic A and B → logging into A gives token for A, logging into B gives token for B, both work in their respective subdomains

**Estimated lines:** ~200 lines

**Acceptance:**
- [ ] All test cases pass (E2E against real database)
- [ ] TenantGuard successfully rejects cross-tenant access (403)
- [ ] UserService.findUsersInTenant does NOT return users from other tenants
- [ ] Manual test: login to Clinic A, change URL to Clinic B, attempt API call → 403

**Teaching moment:**
> **Security Testing:** This test is not optional. It proves the system's most critical promise: "Clinic A cannot see Clinic B's data." If this test fails, the entire multi-tenancy model is broken. This is why we test it explicitly.

---

## Summary

**Total tasks:** 18  
**Estimated total lines:** ~3,000 lines (1,600 code + 1,400 tests)  
**Strict TDD tasks:** 12 of 18 (67%)  
**Critical path:** T01 → T02 → T03 → T04 → T05 → T06 → ... → T18 (sequential)  
**Recommended PR split:** PR 1 (T01–T10), PR 2 (T11–T14), PR 3 (T15–T18)  

---

## Execution Guidelines

### For Each Task:

1. **If Strict TDD = Yes:**
   - Write test cases FIRST (RED phase)
   - Run tests, confirm they fail (RED confirmation)
   - Write minimal code to make tests pass (GREEN phase)
   - Refactor for clarity and patterns (REFACTOR phase)
   - Re-run tests, confirm still passing

2. **If Strict TDD = No:**
   - Implement the feature
   - Verify manually via acceptance criteria
   - (E2E tests will verify integration later)

3. **After Task Completion:**
   - Run all tests (`npm run test` + `npm run test:e2e`)
   - Commit with conventional commit message (`feat(tenants): add registration endpoint`)
   - Update this file with ✅ checkmarks

### Verification at PR Boundaries:

**After PR 1 (T01–T10):**
- [ ] Can register a clinic via POST /api/v1/tenants/register
- [ ] Subdomain validation works (rejects reserved words, invalid formats)
- [ ] Transaction rollback works (duplicate email does not create orphaned tenant)

**After PR 2 (T11–T14):**
- [ ] Can log in with registered user
- [ ] JWT contains correct payload
- [ ] Token refresh works (rotates tokens)
- [ ] Logout revokes refresh token

**After PR 3 (T15–T18):**
- [ ] Cross-tenant isolation is enforced (E2E test proves it)
- [ ] Guards execute in correct order (Auth → Tenant → Roles)
- [ ] All E2E tests pass

---

## Risk Mitigation

### High-Risk Areas (Extra Attention Required):

1. **BaseRepository (T06):** If tenantId validation fails, ALL future queries are vulnerable. Test exhaustively.
2. **TenantMiddleware (T09):** Subdomain extraction is the entry point for tenant context. Bugs here break everything.
3. **TenantGuard (T15):** This is the last line of defense. If it fails, cross-tenant access is possible.
4. **E2E Cross-Tenant Test (T18):** If this test doesn't exist or doesn't fail when isolation is broken, we have no proof of security.

### What to Do If a Task Takes Too Long:

- **Expected:** T10 (TenantsModule) and T13 (AuthService) are the largest tasks (~4-5 hours each)
- **If stuck:** Break the task into smaller commits (e.g., T10a: Repository, T10b: Service, T10c: Controller)
- **If blocked:** Document the blocker, commit what's done, and flag for review

---

## Teaching Opportunities

Each task includes a "Teaching moment" callout. These are beginner-friendly explanations of:
- **Why** we use a pattern (not just "this is how NestJS does it")
- **What problem** the pattern solves (with real-world analogy)
- **What happens if we skip it** (consequence-driven learning)

These comments should appear in the code as well (e.g., in BaseRepository, TenantGuard, etc.).

---

## Phase 1 Complete When:

- [ ] All 18 tasks completed with ✅ checkmarks
- [ ] All unit tests pass (`npm run test`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Cross-tenant isolation E2E test proves Clinic A cannot access Clinic B
- [ ] Manual smoke test: register clinic → login → GET /users → logout → refresh fails

---

**Tasks Status:** Ready for Review  
**Next Phase:** Apply (implementation via sdd-apply with batched execution)
