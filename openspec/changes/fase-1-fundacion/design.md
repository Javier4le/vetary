# Phase 1: Auth + Multi-tenancy Foundation — Technical Design

**Change ID:** fase-1-fundacion  
**Status:** Design  
**Created:** 2026-05-31  
**Teaching Level:** Beginner  

---

## Purpose

This document defines **how** Phase 1 will be built. It bridges the gap between **what** (specification) and **implementation** (code). Every developer working on this phase should read this document first.

**Key outcomes:**
- Understand how tenant isolation flows through every request
- Know the exact order guards execute and why
- See how modules depend on each other (and where circular dependencies would break things)
- Understand the TenantContext mechanism (the most critical design decision)

---

## 1. Module Dependency Graph

### 1.1 NestJS Module Structure

```
AppModule
├── ConfigModule (global)              ← Environment validation
├── PrismaModule (global)              ← Database access
├── CommonModule                       ← Guards, Decorators, Middleware
├── TenantsModule                      ← Tenant management
├── AuthModule                         ← Authentication (JWT)
└── UsersModule                        ← User management
```

### 1.2 Dependency Graph (with inject directions)

```
┌────────────────────────────────────────────────────────────┐
│                        AppModule                           │
│  (imports: Config, Prisma, Common, Tenants, Auth, Users)   │
└───┬────────────────────────────────────────────────────────┘
    │
    ├──► ConfigModule (global)
    │     └── Provides: ConfigService
    │         (validates env vars on startup)
    │
    ├──► PrismaModule (global)
    │     └── Provides: PrismaService
    │         (shared DB connection pool)
    │
    ├──► CommonModule
    │     ├── Exports: Guards (Auth, Tenant, Roles)
    │     ├── Exports: Decorators (@Public, @Roles, @CurrentUser, @CurrentTenant)
    │     └── Exports: TenantMiddleware
    │
    ├──► TenantsModule
    │     ├── Imports: PrismaModule
    │     ├── Provides: TenantService, TenantRepository
    │     ├── Exports: TenantService (needed by AuthModule)
    │     └── Controllers: TenantController
    │
    ├──► AuthModule
    │     ├── Imports: TenantsModule (needs TenantService)
    │     ├── Imports: UsersModule (needs UserService)
    │     ├── Imports: JwtModule
    │     ├── Provides: AuthService, JwtStrategy
    │     └── Controllers: AuthController
    │
    └──► UsersModule
          ├── Imports: PrismaModule
          ├── Provides: UserService, UserRepository
          ├── Exports: UserService (needed by AuthModule)
          └── Controllers: UserController
```

### 1.3 Injection Flow (who injects what into whom)

```
TenantController
    ↓ constructor injects
TenantService
    ↓ constructor injects
TenantRepository
    ↓ constructor injects
PrismaService

AuthController
    ↓ constructor injects
AuthService
    ↓ constructor injects
TenantService + UserService + JwtService
    ↓ those inject
TenantRepository + UserRepository + ConfigService

UserController
    ↓ constructor injects
UserService
    ↓ constructor injects
UserRepository
    ↓ constructor injects
PrismaService
```

### 1.4 Circular Dependency Risks (and how we avoid them)

**⚠️ RISK: AuthModule ↔ TenantsModule circular dependency**

```
AuthModule imports TenantsModule (needs TenantService for login)
TenantsModule imports AuthModule (needs AuthService for... NO WAIT!)
```

**Why this is NOT a problem in our design:**
- `TenantsModule` does NOT import `AuthModule`
- Tenant registration (`POST /tenants/register`) is a public endpoint that does NOT require AuthService
- TenantService creates the User directly via UserRepository (no AuthService needed)
- Password hashing happens in AuthService, but TenantService can use bcrypt directly (or extract to a PasswordService if preferred)

**✅ SOLUTION: TenantService hashes passwords directly**

```typescript
// tenants/tenant.service.ts
import * as bcrypt from 'bcrypt';

async register(dto: RegisterTenantDto) {
  const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
  // ... create tenant, user, userTenant in transaction
}
```

**Alternative (cleaner):** Extract password hashing to a `PasswordService` in `CommonModule`, which both `TenantService` and `AuthService` inject. No circular dependency.

**⚠️ RISK: AuthModule ↔ UsersModule circular dependency**

```
AuthModule imports UsersModule (needs UserService for login)
UsersModule imports AuthModule (needs AuthGuard for protected routes)
```

**Why this IS a problem if misconfigured:**
- UserController uses AuthGuard (from CommonModule)
- AuthGuard uses JwtStrategy (from AuthModule)
- JwtStrategy might try to inject UserService → circular!

**✅ SOLUTION: JwtStrategy does NOT inject UserService**

```typescript
// auth/jwt.strategy.ts
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() { // NO injections here
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    // Just return the payload — no DB call
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };
  }
}
```

**Teaching moment (beginner level):**
> Circular dependencies are like two people waiting for each other to finish talking before they start. It's a deadlock. The solution: one of them starts first without needing the other. JwtStrategy doesn't need to fetch the user from the DB — the JWT payload already contains what we need.

---

## 2. Sequence Diagrams (Critical Flows)

### 2.1 Tenant Registration Flow

```
Client                  Controller              Service                 Repository              DB
  |                         |                       |                       |                     |
  |-- POST /tenants/register ->|                   |                       |                     |
  |    (name, subdomain,    |                       |                       |                     |
  |     admin credentials)  |                       |                       |                     |
  |                         |                       |                       |                     |
  |                         |-- register(dto) ----->|                       |                     |
  |                         |                       |                       |                     |
  |                         |                       |-- validateSubdomain() |                     |
  |                         |                       |   (check reserved,    |                     |
  |                         |                       |    format, length)    |                     |
  |                         |                       |<----------------------|                     |
  |                         |                       |                       |                     |
  |                         |                       |-- findBySubdomain() ->|                     |
  |                         |                       |<----------------------|                     |
  |                         |                       |   (check uniqueness)  |                     |
  |                         |                       |                       |                     |
  |                         |                       |-- hashPassword() -----|                     |
  |                         |                       |<----------------------|                     |
  |                         |                       |                       |                     |
  |                         |                       |-- BEGIN TRANSACTION ->|                     |
  |                         |                       |                       |-- INSERT Tenant --->|
  |                         |                       |                       |<--------------------|
  |                         |                       |                       |-- INSERT User ----->|
  |                         |                       |                       |<--------------------|
  |                         |                       |                       |-- INSERT UserTenant |
  |                         |                       |                       |<--------------------|
  |                         |                       |<-- COMMIT TRANSACTION |                     |
  |                         |                       |                       |                     |
  |                         |<-- { tenant, user } --|                       |                     |
  |<-- 201 Created ---------|                       |                       |                     |
  |    { tenant, user }     |                       |                       |                     |
```

**Key decision:** The transaction ensures atomicity. If User creation fails (e.g., duplicate email), the Tenant is NOT created (rollback). No orphaned tenants.

**Teaching moment:**
> Think of a transaction like a bank transfer. Either BOTH accounts update (sender -$100, receiver +$100), or NEITHER does. Partial success is corruption. Here, either we create Tenant + User + UserTenant, or we create nothing.

---

### 2.2 Login Flow (with subdomain resolution)

```
Client                  Middleware           Controller         Service              Repository         DB
  |                         |                    |                  |                    |               |
  |-- POST /auth/login ---->|                    |                  |                    |               |
  |    Host: clinica-a.vetary.app               |                  |                    |               |
  |    { email, password }  |                    |                  |                    |               |
  |                         |                    |                  |                    |               |
  |                         |-- extract subdomain ("clinica-a")     |                    |               |
  |                         |                    |                  |                    |               |
  |                         |-- findBySubdomain("clinica-a") ------>|-- query Tenant --->|-- SELECT ---->|
  |                         |<-- Tenant object ----------------------|<-------------------|<--------------|
  |                         |                    |                  |                    |               |
  |                         |-- attach req.tenant = Tenant          |                    |               |
  |                         |                    |                  |                    |               |
  |                         |------------------- next() ----------->|                    |               |
  |                                              |                  |                    |               |
  |                                              |-- login() ------>|                    |               |
  |                                              |                  |-- findByEmail() -->|-- SELECT ---->|
  |                                              |                  |<-- User -----------|<--------------|
  |                                              |                  |                    |               |
  |                                              |                  |-- comparePassword()|               |
  |                                              |                  |   (bcrypt.compare) |               |
  |                                              |                  |<-------------------|               |
  |                                              |                  |                    |               |
  |                                              |                  |-- findUserTenant(userId, tenantId) >|
  |                                              |                  |<-- UserTenant -----|<-- SELECT ----|
  |                                              |                  |                    |               |
  |                                              |                  |-- generateJWT() ---|               |
  |                                              |                  |   payload: { userId, tenantId, role }
  |                                              |                  |<-- accessToken ----|               |
  |                                              |                  |                    |               |
  |                                              |                  |-- generateRefreshToken() -------->|
  |                                              |                  |<-- refreshToken ---|-- INSERT ---->|
  |                                              |<-- { accessToken, refreshToken } -----|               |
  |<-- 200 OK -----------------------------------------------------------------------------------|               |
  |    { accessToken, refreshToken }            |                  |                    |               |
```

**Key decision:** Tenant resolution happens in middleware BEFORE the controller. The controller doesn't need to know about subdomains — `req.tenant` already exists.

**Teaching moment:**
> Middleware is like a security checkpoint before entering a building. Before you even reach the reception desk (controller), security (middleware) checks your ID (subdomain) and gives you a badge (req.tenant). The receptionist doesn't need to re-check who you are.

---

### 2.3 Authenticated Request Flow (Guard Execution Chain)

```
Client                  Middleware        AuthGuard         TenantGuard        RolesGuard       Controller
  |                         |                 |                 |                   |                |
  |-- GET /users ---------->|                 |                 |                   |                |
  |    Host: clinica-a.vetary.app            |                 |                   |                |
  |    Authorization: Bearer <JWT>           |                 |                   |                |
  |                         |                 |                 |                   |                |
  |                         |-- extract subdomain ("clinica-a") |                   |                |
  |                         |-- query Tenant --|                |                   |                |
  |                         |<-- Tenant -------|                |                   |                |
  |                         |-- req.tenant = Tenant             |                   |                |
  |                         |                 |                 |                   |                |
  |                         |---- next() ----->|                |                   |                |
  |                                            |                 |                   |                |
  |                                            |-- extract JWT --|                   |                |
  |                                            |-- verify signature (JwtStrategy)     |                |
  |                                            |-- req.user = { userId, tenantId, role }              |
  |                                            |<----------------|                   |                |
  |                                            |                 |                   |                |
  |                                            |---- next() ----->|                   |                |
  |                                                               |                   |                |
  |                                                               |-- compare:        |                |
  |                                                               |   req.tenant.id   |                |
  |                                                               |   vs              |                |
  |                                                               |   req.user.tenantId               |
  |                                                               |                   |                |
  |                                                               |   MATCH? -------->|                |
  |                                                               |<-- YES ----------|                |
  |                                                               |                   |                |
  |                                                               |---- next() ------>|                |
  |                                                                                   |                |
  |                                                                                   |-- extract:     |
  |                                                                                   |   req.user.role|
  |                                                                                   |   @Roles metadata
  |                                                                                   |                |
  |                                                                                   |   ADMIN in [ADMIN, VET]?
  |                                                                                   |<-- YES --------|
  |                                                                                   |                |
  |                                                                                   |---- next() --->|
  |                                                                                                    |
  |                                                                                   |-- getUsers() ->|
  |<---------------------------------------------------------------------------------------------------|
  |    200 OK                                                                                          |
  |    [ users ]                                                                                       |
```

**Key decision:** Guards execute in strict order. AuthGuard MUST run before TenantGuard (because TenantGuard needs `req.user.tenantId` from the JWT). RolesGuard runs last (because it needs both `req.user.role` and the validated tenant context).

**Guard execution order (CRITICAL):**
1. **TenantMiddleware** (runs first, always)
2. **AuthGuard** (validates JWT, attaches `req.user`)
3. **TenantGuard** (validates `req.tenant.id === req.user.tenantId`)
4. **RolesGuard** (validates `req.user.role` is in `@Roles(...)`)
5. **Controller** (finally!)

**Teaching moment:**
> Think of this like airport security lanes. First, you show your ticket (AuthGuard validates JWT). Then, security checks if your ticket matches the gate you're trying to enter (TenantGuard). Then, they check if you have the right boarding class for the lounge you're entering (RolesGuard). Only THEN do you reach the lounge (Controller).

**How NestJS enforces this order:**

```typescript
// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware) // ← Runs FIRST (middleware always runs before guards)
      .forRoutes('*');
  }
}

// user.controller.ts
@Controller('users')
@UseGuards(AuthGuard, TenantGuard, RolesGuard) // ← Order matters! Left to right.
export class UserController {
  @Get()
  @Roles(Role.ADMIN, Role.VET) // ← RolesGuard reads this metadata
  async getUsers(@CurrentTenant() tenant: Tenant) {
    // ...
  }
}
```

**What happens if we get the order wrong?**

```typescript
@UseGuards(TenantGuard, AuthGuard) // ❌ WRONG ORDER
```

→ **TenantGuard tries to access `req.user.tenantId` but AuthGuard hasn't run yet → `req.user` is undefined → crash!**

**Correct order (ALWAYS):**

```typescript
@UseGuards(AuthGuard, TenantGuard, RolesGuard) // ✅ CORRECT ORDER
```

---

### 2.4 Token Refresh Flow

```
Client              Controller           Service             Repository             DB
  |                     |                    |                   |                  |
  |-- POST /auth/refresh ->|                 |                   |                  |
  |    { refreshToken } |                    |                   |                  |
  |                     |                    |                   |                  |
  |                     |-- refresh() ------>|                   |                  |
  |                     |                    |-- findToken() --->|-- SELECT -------->|
  |                     |                    |<-- RefreshToken --|<-----------------|
  |                     |                    |                   |                  |
  |                     |                    |-- validate:       |                  |
  |                     |                    |   revokedAt === null?                |
  |                     |                    |   expiresAt > now()?                 |
  |                     |                    |                   |                  |
  |                     |                    |-- revokeOldToken()->|-- UPDATE ------>|
  |                     |                    |                   |   SET revokedAt=now()
  |                     |                    |<------------------|<-----------------|
  |                     |                    |                   |                  |
  |                     |                    |-- generateNewAccessToken()           |
  |                     |                    |   (same payload)  |                  |
  |                     |                    |                   |                  |
  |                     |                    |-- generateNewRefreshToken()          |
  |                     |                    |                   |-- INSERT -------->|
  |                     |                    |<------------------|<-----------------|
  |                     |                    |                   |                  |
  |                     |<-- { accessToken, refreshToken } -----|                  |
  |<-- 200 OK ----------|                    |                   |                  |
  |    { accessToken, refreshToken }        |                   |                  |
```

**Key decision:** Token rotation. Every refresh invalidates the old refresh token and issues a new pair. This limits the damage if a refresh token is stolen — it only works ONCE.

**Teaching moment:**
> Think of a refresh token like a concert wristband that lets you get new tickets (access tokens). But every time you get a new ticket, they replace your wristband with a new one. If someone steals your old wristband, it's already been invalidated — useless.

---

### 2.5 Cross-Tenant Rejection Flow (The Security Case)

```
Client                  Middleware         AuthGuard         TenantGuard         Response
  |                         |                 |                 |                   |
  |-- GET /users ---------->|                 |                 |                   |
  |    Host: clinica-b.vetary.app (Tenant B) |                 |                   |
  |    Authorization: Bearer <JWT with tenantId=A>             |                   |
  |                         |                 |                 |                   |
  |                         |-- extract subdomain ("clinica-b")|                   |
  |                         |-- query Tenant B ----------------|                   |
  |                         |<-- Tenant B --------------------|                   |
  |                         |-- req.tenant = Tenant B (id: B) |                   |
  |                         |                 |                 |                   |
  |                         |---- next() ----->|                |                   |
  |                                            |                 |                   |
  |                                            |-- verify JWT ---|                   |
  |                                            |-- req.user = { userId, tenantId: A, role }
  |                                            |<----------------|                   |
  |                                            |                 |                   |
  |                                            |---- next() ----->|                   |
  |                                                               |                   |
  |                                                               |-- compare:        |
  |                                                               |   req.tenant.id (B)
  |                                                               |   vs              |
  |                                                               |   req.user.tenantId (A)
  |                                                               |                   |
  |                                                               |   MISMATCH!       |
  |                                                               |                   |
  |<--------------------------------------------------------------|--- 403 Forbidden --|
  |    { statusCode: 403, message: "Your token belongs to a different clinic" }      |
```

**Key decision:** TenantGuard is the **last line of defense** against cross-tenant access. Even if all other checks pass, this guard ensures the JWT's tenant matches the subdomain.

**Teaching moment:**
> Imagine you have a key to Building A. You walk over to Building B and try to use that key. The guard at Building B checks your key and says "Sorry, that key is for Building A, not here." That's TenantGuard. It doesn't matter if your key is valid — it's not valid FOR THIS BUILDING.

**Why this is critical:**
- User could manually change the URL in the browser: `clinica-a.vetary.app` → `clinica-b.vetary.app`
- Without TenantGuard, the AuthGuard would say "JWT is valid" and let them in
- TenantGuard catches this and rejects the request

---

## 3. TenantContext Design (The Most Critical Decision)

### 3.1 The Problem

Every repository query needs `tenantId`. But how does `tenantId` get from the HTTP request all the way down to the repository **without** being passed explicitly in every method call?

**Bad solution (explicit passing):**

```typescript
// ❌ This gets ugly FAST
service.findUsers(tenantId)
  ↓
repository.findAll(tenantId)
  ↓
prisma.user.findMany({ where: { tenantId } })
```

Every method signature needs `tenantId` as the first parameter. Ugly, error-prone (easy to forget), and verbose.

**Good solution:** TenantContext that flows **implicitly** through the request lifecycle.

### 3.2 Three Options (Evaluated)

#### Option 1: AsyncLocalStorage (Node.js native)

**How it works:**

```typescript
// common/tenant-context.service.ts
import { AsyncLocalStorage } from 'async_hooks';

export class TenantContextService {
  private als = new AsyncLocalStorage<string>();

  setTenantId(tenantId: string, callback: () => void) {
    this.als.run(tenantId, callback);
  }

  getTenantId(): string {
    return this.als.getStore();
  }
}

// common/middleware/tenant.middleware.ts
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantContext: TenantContextService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const subdomain = extractSubdomain(req.hostname);
    const tenant = await this.tenantService.findBySubdomain(subdomain);
    
    // Store tenantId in AsyncLocalStorage for this request
    this.tenantContext.setTenantId(tenant.id, () => {
      next();
    });
  }
}

// repositories/base.repository.ts
export abstract class BaseRepository<T> {
  constructor(
    protected prisma: PrismaService,
    private tenantContext: TenantContextService, // ← Inject context
  ) {}

  protected async findByTenant(where: any): Promise<T[]> {
    const tenantId = this.tenantContext.getTenantId(); // ← Get tenantId implicitly
    if (!tenantId) throw new UnauthorizedException('Tenant context missing');
    
    return this.getDelegate().findMany({
      where: { tenantId, ...where },
    });
  }
}
```

**Pros:**
- ✅ Truly implicit — tenantId flows through the entire async call stack
- ✅ No need to attach to `req` object
- ✅ Works in any context (HTTP, WebSocket, CRON jobs)

**Cons:**
- ⚠️ Slightly harder to debug (context is "invisible" in the call stack)
- ⚠️ Requires understanding of async_hooks (advanced Node.js feature)

---

#### Option 2: Request Object Attachment (NestJS standard)

**How it works:**

```typescript
// common/middleware/tenant.middleware.ts
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const subdomain = extractSubdomain(req.hostname);
    const tenant = await this.tenantService.findBySubdomain(subdomain);
    
    req['tenant'] = tenant; // ← Attach to request object
    next();
  }
}

// common/decorators/current-tenant.decorator.ts
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Tenant => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);

// user.controller.ts
@Get()
async getUsers(@CurrentTenant() tenant: Tenant) {
  return this.userService.findAll(tenant.id); // ← Explicit passing from controller
}

// user.service.ts
async findAll(tenantId: string) {
  return this.userRepository.findByTenant(tenantId); // ← Still need to pass
}
```

**Pros:**
- ✅ Simple, standard NestJS pattern
- ✅ Easy to debug (tenant is visible in request object)
- ✅ TypeScript-friendly (can extend Request interface)

**Cons:**
- ❌ Not truly implicit — still need to pass `tenant.id` from controller → service → repository
- ❌ Only works in HTTP context (not WebSocket, CRON, etc.)

---

#### Option 3: NestJS REQUEST Scope (Injection-based)

**How it works:**

```typescript
// common/tenant-context.service.ts
import { Scope, Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST }) // ← REQUEST scope (new instance per request)
export class TenantContextService {
  private tenantId: string;

  constructor(@Inject(REQUEST) private request: Request) {
    this.tenantId = this.request['tenant']?.id;
  }

  getTenantId(): string {
    return this.tenantId;
  }
}

// repositories/base.repository.ts
@Injectable({ scope: Scope.REQUEST }) // ← Must match REQUEST scope
export abstract class BaseRepository<T> {
  constructor(
    protected prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  protected async findByTenant(where: any): Promise<T[]> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context missing');
    
    return this.getDelegate().findMany({
      where: { tenantId, ...where },
    });
  }
}
```

**Pros:**
- ✅ Clean injection-based pattern (very NestJS-idiomatic)
- ✅ Truly implicit once set up

**Cons:**
- ❌ REQUEST scope means new instance per request → performance overhead (more memory, more instantiation)
- ❌ Everything in the injection chain must be REQUEST scope (services, repositories) → forces architecture decision
- ❌ Only works in HTTP context

---

### 3.3 Recommended Approach: **Option 2 (Request Object Attachment)** for Phase 1

**Why:**
- ✅ Simplest to understand for beginners
- ✅ Standard NestJS pattern (widely documented)
- ✅ Easy to debug (req.tenant is visible)
- ✅ No performance overhead (unlike REQUEST scope)
- ✅ No advanced Node.js features required (unlike AsyncLocalStorage)

**Tradeoff accepted:**
- We pass `tenant.id` from controller → service → repository
- This is **explicit over implicit** — we can see where tenantId comes from

**Future migration path:**
- Phase 2+: if implicit context becomes critical (e.g., WebSocket support, CRON jobs), migrate to AsyncLocalStorage
- Migration is isolated to `TenantContextService` — no controller changes needed

**Implementation:**

```typescript
// common/middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const subdomain = this.extractSubdomain(req.hostname);
    
    if (!subdomain) {
      throw new NotFoundException('Subdomain is required');
    }

    const tenant = await this.tenantService.findBySubdomain(subdomain);
    
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    req['tenant'] = tenant; // ← Attach tenant to request
    next();
  }

  private extractSubdomain(hostname: string): string | null {
    // clinica-a.vetary.app → "clinica-a"
    // localhost → null (dev mode uses DEFAULT_TENANT_SUBDOMAIN env var)
    const parts = hostname.split('.');
    if (parts.length < 2) return null;
    return parts[0];
  }
}

// common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Tenant } from '@prisma/client';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Tenant => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);

// user.controller.ts
@Controller('users')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VET)
  async getUsers(@CurrentTenant() tenant: Tenant) {
    return this.userService.findAll(tenant.id);
  }
}
```

**Teaching moment:**
> Think of `req.tenant` like a backpack you pick up at the entrance (middleware) and carry through the entire building (request lifecycle). Every room (controller, service, repository) can look in the backpack without you having to hand it to them explicitly. The `@CurrentTenant()` decorator is like reaching into the backpack.

---

## 4. BaseRepository Design

### 4.1 The Contract

```typescript
// database/base.repository.ts
import { PrismaService } from './prisma.service';
import { UnauthorizedException } from '@nestjs/common';

export abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * 🔒 SECURITY: Enforces tenant filtering
   * All queries MUST include tenantId
   * Throws if tenantId is missing (fail-safe)
   */
  protected async findByTenant(
    tenantId: string,
    where: any = {},
  ): Promise<T[]> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    return this.getDelegate().findMany({
      where: { tenantId, ...where },
    });
  }

  protected async findOneByTenant(
    tenantId: string,
    where: any,
  ): Promise<T | null> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    return this.getDelegate().findFirst({
      where: { tenantId, ...where },
    });
  }

  protected async createForTenant(
    tenantId: string,
    data: any,
  ): Promise<T> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    return this.getDelegate().create({
      data: { tenantId, ...data },
    });
  }

  protected async updateForTenant(
    tenantId: string,
    id: string,
    data: any,
  ): Promise<T> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    return this.getDelegate().updateMany({
      where: { id, tenantId }, // ← Double filter: id AND tenantId
      data,
    });
  }

  protected async deleteForTenant(
    tenantId: string,
    id: string,
  ): Promise<void> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    await this.getDelegate().deleteMany({
      where: { id, tenantId }, // ← Double filter: id AND tenantId
    });
  }

  /**
   * Each repository must implement this to return the Prisma delegate
   * Example: return this.prisma.booking
   */
  protected abstract getDelegate(): any;
}
```

### 4.2 Example: Extending BaseRepository (Phase 2 — for reference)

```typescript
// modules/bookings/repositories/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { Booking } from '@prisma/client';
import { BaseRepository } from '../../../database/base.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class BookingRepository extends BaseRepository<Booking> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.booking; // ← Prisma delegate for Booking model
  }

  // Custom queries can still use the protected methods
  async findUpcomingForTenant(tenantId: string): Promise<Booking[]> {
    return this.findByTenant(tenantId, {
      scheduledAt: { gte: new Date() },
      status: 'CONFIRMED',
    });
  }
}
```

### 4.3 Phase 1 Exception: User and Tenant Repositories

**IMPORTANT:** In Phase 1, `UserRepository` and `TenantRepository` do **NOT** extend `BaseRepository`.

**Why?**
- `User` table does NOT have `tenantId` (it's global — scoped via `UserTenant` junction table)
- `Tenant` table IS the tenant — filtering by tenantId makes no sense

**What BaseRepository is for:**
- Phase 2+ entities: `Booking`, `Pet`, `Veterinarian`, `Appointment`, etc.
- All of those have `tenantId` column

**Teaching moment:**
> BaseRepository is like a template for "data that belongs to a clinic." Not all data belongs to a clinic. Users are global (one person can work in multiple clinics). Tenants ARE the clinics. BaseRepository is for things OWNED by a clinic: bookings, pets, appointments.

---

## 5. Guard Execution Order (CRITICAL)

### 5.1 The Chain

```
Request
  ↓
TenantMiddleware (extracts tenant from subdomain)
  ↓
AuthGuard (validates JWT, attaches req.user)
  ↓
TenantGuard (validates req.tenant.id === req.user.tenantId)
  ↓
RolesGuard (validates req.user.role is in @Roles(...))
  ↓
Controller
```

### 5.2 Why This Order?

**TenantMiddleware runs first** (middleware always runs before guards)
- Extracts subdomain from `req.hostname`
- Queries database for Tenant
- Attaches `req.tenant` to request object

**AuthGuard runs second**
- Validates JWT signature
- Extracts payload `{ sub, tenantId, role, email }`
- Attaches `req.user` to request object
- **Depends on:** JWT secret (no dependencies on previous layers)

**TenantGuard runs third**
- Compares `req.tenant.id` (from middleware) vs `req.user.tenantId` (from JWT)
- **Depends on:** Both `req.tenant` AND `req.user` existing
- **Why after AuthGuard?** Needs `req.user.tenantId` to compare

**RolesGuard runs fourth (last)**
- Checks if `req.user.role` is in the required roles (from `@Roles(...)` metadata)
- **Depends on:** `req.user` existing
- **Why after TenantGuard?** No point checking roles if tenant mismatch already failed

### 5.3 Implementation

```typescript
// common/guards/auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true; // Skip authentication for @Public() routes
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token');
    }
    return user;
  }
}

// common/guards/tenant.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant; // From TenantMiddleware
    const user = request.user; // From AuthGuard

    if (!tenant || !user) {
      throw new ForbiddenException('Tenant or user context missing');
    }

    if (tenant.id !== user.tenantId) {
      throw new ForbiddenException('Your token belongs to a different clinic');
    }

    return true;
  }
}

// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No role requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

// Usage in controller:
@Controller('users')
@UseGuards(AuthGuard, TenantGuard, RolesGuard) // ← ORDER MATTERS!
export class UserController {
  @Get()
  @Roles(Role.ADMIN, Role.VET)
  async getUsers() {
    // ...
  }
}
```

---

## 6. JWT Payload Design

### 6.1 Access Token Payload

```typescript
{
  "sub": "clxxx123",           // User ID (standard JWT claim)
  "tenantId": "clyyy456",      // Tenant ID (which clinic the user logged into)
  "role": "ADMIN",             // User's role IN THIS TENANT
  "email": "admin@clinica.com",// User's email (for display purposes)
  "iat": 1622505600,           // Issued at (Unix timestamp)
  "exp": 1622506500            // Expires at (iat + 15 minutes)
}
```

**Why these fields?**

- `sub` (subject) — Standard JWT claim for user ID. Used to identify WHO.
- `tenantId` — Which clinic the user is currently logged into. Used by TenantGuard.
- `role` — The user's role IN THIS TENANT (from UserTenant). Used by RolesGuard.
- `email` — Convenient for displaying "Logged in as..." without fetching from DB.
- `iat` / `exp` — Standard JWT timestamps for validation.

**Why NOT include more user data?**
- JWT should be small (sent on every request)
- Sensitive data (like full profile) should be fetched on-demand, not in the token
- If user data changes (e.g., role), we don't want stale data in the token for 15 minutes

**Teaching moment:**
> Think of the JWT like an ID badge. It shows your name (email), which building you're allowed in (tenantId), and your clearance level (role). It doesn't show your full resume — that's overkill for an ID badge.

### 6.2 Refresh Token Payload

**Refresh tokens are OPAQUE** (random secure strings), NOT JWTs.

**Why?**
- Refresh tokens are stored in the database (RefreshToken table)
- They are validated by DB lookup, not by signature verification
- No payload needed — the DB row contains userId, tenantId, expiresAt, revokedAt

**Structure in DB:**

```typescript
{
  id: "clzzz789",
  token: "a3f5b7c9-1234-5678-90ab-cdef12345678", // Secure random string (UUID or similar)
  userId: "clxxx123",
  tenantId: "clyyy456",
  expiresAt: "2026-06-07T10:00:00Z", // 7 days from creation
  revokedAt: null, // null = active, not null = revoked
  createdAt: "2026-05-31T10:00:00Z"
}
```

**Teaching moment:**
> Access tokens are like temporary visitor passes (short-lived, self-contained). Refresh tokens are like membership cards stored in a database (long-lived, revocable). If your membership card is stolen, we can cancel it immediately. If a visitor pass is stolen, it expires soon anyway.

---

## 7. Complete File Structure

```
vetary-api/
├── prisma/
│   ├── schema.prisma              ← Prisma schema (Tenant, User, UserTenant, RefreshToken)
│   └── migrations/                ← Database migrations (auto-generated)
│
├── src/
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── current-tenant.decorator.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── middleware/
│   │   │   └── tenant.middleware.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── common.module.ts
│   │
│   ├── config/
│   │   ├── config.module.ts
│   │   ├── config.service.ts
│   │   └── env.validation.ts       ← Validates env vars on startup
│   │
│   ├── database/
│   │   ├── prisma.service.ts
│   │   ├── base.repository.ts      ← Abstract base for tenant-scoped repos
│   │   └── database.module.ts
│   │
│   ├── modules/
│   │   ├── tenants/
│   │   │   ├── dto/
│   │   │   │   ├── register-tenant.dto.ts
│   │   │   │   └── update-tenant-status.dto.ts
│   │   │   ├── repositories/
│   │   │   │   └── tenant.repository.ts
│   │   │   ├── services/
│   │   │   │   └── tenant.service.ts
│   │   │   ├── controllers/
│   │   │   │   └── tenant.controller.ts
│   │   │   └── tenants.module.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── refresh-token.dto.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   ├── interfaces/
│   │   │   │   └── jwt-payload.interface.ts
│   │   │   ├── services/
│   │   │   │   └── auth.service.ts
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   └── users/
│   │       ├── dto/
│   │       │   ├── create-user.dto.ts
│   │       │   └── update-user.dto.ts
│   │       ├── repositories/
│   │       │   └── user.repository.ts
│   │       ├── services/
│   │       │   └── user.service.ts
│   │       ├── controllers/
│   │       │   └── user.controller.ts
│   │       └── users.module.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── test/
│   ├── unit/                      ← Unit tests (services, repositories)
│   ├── integration/               ← Integration tests (DB queries, transactions)
│   └── e2e/                       ← End-to-end tests (full request flows)
│
├── .env.example
├── .env                           ← Gitignored
├── docker-compose.yml             ← PostgreSQL + Adminer for local dev
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 8. NestJS Module Wiring

### 8.1 Module Import/Export Table

| Module            | Imports                                      | Exports                     | Provides                              |
|-------------------|----------------------------------------------|-----------------------------|---------------------------------------|
| **ConfigModule**  | —                                            | ConfigService               | ConfigService (env validation)        |
| **PrismaModule**  | —                                            | PrismaService               | PrismaService (DB connection)         |
| **CommonModule**  | —                                            | All guards, decorators, middleware | AuthGuard, TenantGuard, RolesGuard, TenantMiddleware |
| **TenantsModule** | PrismaModule                                 | TenantService               | TenantService, TenantRepository, TenantController |
| **AuthModule**    | TenantsModule, UsersModule, JwtModule, PassportModule | —                      | AuthService, JwtStrategy, AuthController |
| **UsersModule**   | PrismaModule                                 | UserService                 | UserService, UserRepository, UserController |
| **AppModule**     | ConfigModule, PrismaModule, CommonModule, TenantsModule, AuthModule, UsersModule | — | —                                     |

### 8.2 AppModule Configuration

```typescript
// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    // Global config with env validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    // Rate limiting (global)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute (default)
      },
    ]),

    // Database
    PrismaModule,

    // Common (guards, decorators, middleware)
    CommonModule,

    // Feature modules
    TenantsModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
```

### 8.3 AuthModule Configuration

```typescript
// modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION'),
        },
      }),
    }),
    TenantsModule, // Need TenantService for login
    UsersModule,   // Need UserService for login
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

---

## 9. Docker Setup (Local Development)

### 9.1 docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: vetary-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: vetary
      POSTGRES_PASSWORD: vetary_dev_password
      POSTGRES_DB: vetary_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - vetary-network

  adminer:
    image: adminer:latest
    container_name: vetary-adminer
    restart: unless-stopped
    ports:
      - '8080:8080'
    depends_on:
      - postgres
    networks:
      - vetary-network
    environment:
      ADMINER_DEFAULT_SERVER: postgres

volumes:
  postgres_data:

networks:
  vetary-network:
    driver: bridge
```

**How to use:**

```bash
# Start PostgreSQL + Adminer
docker-compose up -d

# Access Adminer at http://localhost:8080
# Server: postgres
# Username: vetary
# Password: vetary_dev_password
# Database: vetary_dev

# Stop services
docker-compose down

# Stop and remove volumes (delete all data)
docker-compose down -v
```

**Teaching moment:**
> Adminer is a web-based database viewer. Think of it like phpMyAdmin but lighter. It lets you see your tables, run queries, and debug data without installing extra tools.

### 9.2 .env.example

```bash
# Database
DATABASE_URL="postgresql://vetary:vetary_dev_password@localhost:5432/vetary_dev"

# JWT
JWT_SECRET="super-secret-key-change-in-production-at-least-32-characters"
JWT_EXPIRATION="15m"
REFRESH_TOKEN_EXPIRATION="7d"

# Security
BCRYPT_ROUNDS="10"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"

# Server
PORT="3000"
NODE_ENV="development"

# Multi-tenancy (dev only — subdomain resolution on localhost)
DEFAULT_TENANT_SUBDOMAIN="clinica-test"

# Rate Limiting
RATE_LIMIT_ENABLED="true"
```

**Teaching moment:**
> `.env.example` is a template. Developers copy it to `.env` and fill in real secrets. `.env` is gitignored (never committed). This way, we share the structure without sharing secrets.

---

## 10. Testing Strategy (Strict TDD Active)

### 10.1 Testing Pyramid

```
       /\
      /  \
     / E2E \          ← End-to-end (full request flows)
    /______\          
   /        \
  /  INTEG.  \        ← Integration (DB queries, transactions, tenant isolation)
 /____________\
/              \
/     UNIT      \     ← Unit (services, guards, pure functions)
/________________\
```

### 10.2 Test-First Rules (Strict TDD)

**Critical modules that REQUIRE tests BEFORE implementation:**
- ✅ TenantService (subdomain validation, transaction rollback)
- ✅ AuthService (login, token generation, refresh rotation)
- ✅ UserService (multi-tenant user creation)
- ✅ AuthGuard (JWT validation, public route handling)
- ✅ TenantGuard (tenant mismatch detection)
- ✅ RolesGuard (role enforcement)
- ✅ BaseRepository (tenantId enforcement)

**Test categories:**

| Test Type    | What to Test                              | Example                                      |
|--------------|-------------------------------------------|----------------------------------------------|
| **Unit**     | Services, guards, pure functions          | `TenantService.validateSubdomain()` rejects "admin" |
| **Integration** | Repositories, DB queries, transactions | Create UserTenant for Tenant A, query as Tenant B → empty |
| **E2E**      | Full request flows, guard chains          | Login to Tenant A, call Tenant B endpoint → 403 |

### 10.3 Critical Tests (Must Pass Before Merge)

#### Tenant Isolation Tests

```typescript
// test/integration/tenant-isolation.spec.ts
describe('Tenant Isolation', () => {
  it('should prevent Tenant A from accessing Tenant B data', async () => {
    // Create Tenant A and Booking for Tenant A
    const tenantA = await createTenant({ subdomain: 'tenant-a' });
    const bookingA = await createBooking({ tenantId: tenantA.id });

    // Create Tenant B
    const tenantB = await createTenant({ subdomain: 'tenant-b' });

    // Query bookings as Tenant B
    const repository = new BookingRepository(prisma);
    const bookings = await repository.findByTenant(tenantB.id, {});

    // Assert: Tenant B should NOT see Tenant A's booking
    expect(bookings).toHaveLength(0);
    expect(bookings).not.toContainEqual(bookingA);
  });
});
```

#### Cross-Tenant Request Rejection (E2E)

```typescript
// test/e2e/cross-tenant-rejection.spec.ts
describe('Cross-Tenant Request Rejection', () => {
  it('should reject request with Tenant A token on Tenant B subdomain', async () => {
    // Register Tenant A and login
    const { tenant: tenantA, accessToken: tokenA } = await registerAndLogin({
      subdomain: 'tenant-a',
      email: 'admin@tenant-a.com',
    });

    // Register Tenant B
    const tenantB = await registerTenant({ subdomain: 'tenant-b' });

    // Attempt to access Tenant B endpoint with Tenant A token
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Host', 'tenant-b.vetary.app')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    expect(response.body.message).toBe('Your token belongs to a different clinic');
  });
});
```

---

## 11. Key Design Decisions Summary

### 11.1 TenantContext Decision: **Request Object Attachment**

**Chosen:** Option 2 (attach to `req` object)  
**Rationale:** Simplest for beginners, standard NestJS pattern, easy to debug  
**Tradeoff:** Explicit passing from controller → service → repository (not fully implicit)  
**Future:** Can migrate to AsyncLocalStorage in Phase 2+ if implicit context becomes critical  

---

### 11.2 Guard Chain Summary

**Order (CRITICAL):**
1. TenantMiddleware (extracts tenant from subdomain)
2. AuthGuard (validates JWT)
3. TenantGuard (validates tenant match)
4. RolesGuard (validates role)
5. Controller

**Why this order:**
- Each guard depends on previous guards' side effects (`req.tenant`, `req.user`)
- Middleware runs before all guards (NestJS lifecycle)
- Guards run left-to-right in `@UseGuards(...)` array

---

### 11.3 File Structure Highlights

```
src/
├── common/                    ← Cross-cutting (guards, decorators, middleware)
├── config/                    ← Env validation
├── database/                  ← Prisma + BaseRepository
└── modules/                   ← Feature modules (tenants, auth, users)
    └── [feature]/
        ├── dto/               ← Input validation
        ├── repositories/      ← Data access (only place Prisma lives)
        ├── services/          ← Business logic
        └── controllers/       ← HTTP handlers
```

---

### 11.4 Module Wiring Highlights

**Exports (for reuse):**
- `TenantsModule` exports `TenantService` (needed by AuthModule)
- `UsersModule` exports `UserService` (needed by AuthModule)
- `CommonModule` exports guards, decorators, middleware (needed everywhere)

**Circular Dependency Avoidance:**
- JwtStrategy does NOT inject UserService (no DB call in `validate()`)
- TenantService hashes passwords directly (does NOT inject AuthService)

---

## 12. Teaching Checkpoints (Beginner Level)

Throughout implementation, the agent should explain:

### Before TenantMiddleware:
> **🏗️ ARQUITECTURA:** Middleware runs BEFORE guards. Think of it like airport security — middleware is the first checkpoint (checking your ticket), guards are deeper checkpoints (checking your passport, boarding class).

### Before AuthGuard:
> **📐 PATRÓN Decorator:** `@Public()` is a decorator. It attaches metadata to a route. AuthGuard reads that metadata and decides "should I skip this route?" Decorators are like sticky notes on functions.

### Before TenantGuard:
> **🔒 SEGURIDAD:** This is the LAST LINE OF DEFENSE against cross-tenant leakage. Even if JWT is valid, even if user is authenticated, even if role is correct — if the tenant doesn't match, we reject. Security in layers.

### Before BaseRepository:
> **⚡ PRINCIPIO Single Responsibility:** BaseRepository does ONE thing: enforce tenant filtering. It doesn't know about business logic, HTTP, or JWT. It just says "every query MUST include tenantId."

### Before Prisma Transaction:
> **🧪 TEST:** We test the rollback. Create a tenant with a duplicate email. Assert the tenant is NOT in the database. Transactions protect data integrity — we test that protection works.

---

## Metadata

**Estimated implementation time:** 3-4 work sessions (with Strict TDD)  
**Risk level:** High (foundation phase, isolation bugs are catastrophic)  
**Critical path:** TenantMiddleware → Guards → BaseRepository → Testing tenant isolation  
**Teaching opportunities:** 8 key moments (middleware, guards, decorators, repositories, transactions, JWT, testing, docker)

---

**Design Status:** Ready for Tasks Phase
