# Phase 1: Auth + Multi-tenancy Foundation — Specification

**Change ID:** fase-1-fundacion  
**Status:** Specification  
**Created:** 2026-05-31  
**Teaching Level:** Beginner  
**Artifact Store:** openspec  

---

## Purpose

This specification defines the **security and isolation foundation** for Vetary. It establishes the data model, authentication system, and multi-tenancy infrastructure that all subsequent features will depend on.

**Success means:**
- Complete tenant isolation (Clinic A cannot access Clinic B's data under any circumstances)
- A user can work in multiple clinics with different roles using one email
- JWT-based authentication with revocable refresh tokens
- Foundation ready for Phase 2 features (Pets, Bookings, Veterinarians)

---

## Requirements

### Requirement: Prisma Schema — Complete Data Model

The system MUST implement the following Prisma schema with all models, fields, relations, and constraints defined.

#### Models

**Tenant Model:**
```prisma
enum TenantStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

model Tenant {
  id        String       @id @default(cuid())
  name      String
  subdomain String       @unique
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  userTenants   UserTenant[]
  refreshTokens RefreshToken[]

  @@index([subdomain])
}
```

**User Model:**
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  firstName    String
  lastName     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  userTenants   UserTenant[]
  refreshTokens RefreshToken[]

  @@index([email])
}
```

**UserTenant Junction Model:**
```prisma
enum Role {
  ADMIN
  VET
  STAFF
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

  @@unique([userId, tenantId])
  @@index([userId])
  @@index([tenantId])
}
```

**RefreshToken Model:**
```prisma
model RefreshToken {
  id        String    @id @default(cuid())
  token     String    @unique
  userId    String
  tenantId  String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId, tenantId])
}
```

#### Scenario: User belongs to multiple tenants with different roles

- GIVEN a User with email "maria@vet.com" exists
- AND a UserTenant exists for (User, TenantA, Role.ADMIN)
- AND a UserTenant exists for (User, TenantB, Role.VET)
- WHEN the user logs into TenantA via subdomain "clinica-a.vetary.app"
- THEN the JWT payload MUST contain `{ userId, tenantId: TenantA.id, role: ADMIN }`
- WHEN the same user logs into TenantB via subdomain "clinica-b.vetary.app"
- THEN the JWT payload MUST contain `{ userId, tenantId: TenantB.id, role: VET }`

#### Scenario: Email uniqueness is global across all tenants

- GIVEN a User with email "juan@vet.com" exists
- WHEN attempting to register a new tenant with admin email "juan@vet.com"
- THEN the system MUST reject the registration with error "Email already registered"

#### Scenario: Cascade deletion of UserTenant when User is deleted

- GIVEN a User exists
- AND the User has UserTenant records for TenantA and TenantB
- WHEN the User is deleted
- THEN all associated UserTenant records MUST be automatically deleted
- AND all associated RefreshToken records MUST be automatically deleted

#### Scenario: Subdomain uniqueness across all tenants

- GIVEN a Tenant with subdomain "clinica-norte" exists
- WHEN attempting to register a new tenant with subdomain "clinica-norte"
- THEN the system MUST reject the registration with status 409 and error "Subdomain already taken"

---

### Requirement: Tenant Registration — Atomic Transaction

The system MUST provide a tenant registration endpoint that creates a Tenant, admin User, and UserTenant in a single atomic transaction.

#### Scenario: Successful tenant registration

- GIVEN the subdomain "clinica-nueva" does not exist
- AND the email "admin@clinica.com" does not exist
- WHEN a POST request is made to `/api/v1/tenants/register` with:
  ```json
  {
    "name": "Clínica Veterinaria Nueva",
    "subdomain": "clinica-nueva",
    "adminEmail": "admin@clinica.com",
    "adminPassword": "SecurePass123!",
    "adminFirstName": "Juan",
    "adminLastName": "Pérez"
  }
  ```
- THEN the system MUST create a Tenant with `subdomain = "clinica-nueva"`, `status = ACTIVE`
- AND create a User with `email = "admin@clinica.com"`, `passwordHash = bcrypt(adminPassword)`
- AND create a UserTenant with `role = ADMIN` linking the User to the Tenant
- AND return HTTP 201 with:
  ```json
  {
    "tenant": {
      "id": "clxxx123",
      "name": "Clínica Veterinaria Nueva",
      "subdomain": "clinica-nueva",
      "status": "ACTIVE"
    },
    "user": {
      "id": "clyyy456",
      "email": "admin@clinica.com",
      "firstName": "Juan",
      "lastName": "Pérez"
    }
  }
  ```

#### Scenario: Registration rollback on User creation failure

- GIVEN the subdomain "clinica-test" does not exist
- AND the email "existing@user.com" ALREADY exists (duplicate email)
- WHEN a POST request is made to `/api/v1/tenants/register` with:
  ```json
  {
    "name": "Test Clinic",
    "subdomain": "clinica-test",
    "adminEmail": "existing@user.com",
    "adminPassword": "Pass123!",
    "adminFirstName": "Test",
    "adminLastName": "User"
  }
  ```
- THEN the system MUST rollback the entire transaction
- AND the Tenant with subdomain "clinica-test" MUST NOT be created
- AND return HTTP 409 with error "Email already registered"

#### Scenario: Subdomain validation rejects reserved words

- WHEN a POST request is made to `/api/v1/tenants/register` with subdomain "admin"
- THEN the system MUST reject with HTTP 400 and error "Subdomain 'admin' is reserved"
- WHEN subdomain is "api", "www", "app", "auth", "super", "root", "mail", or "smtp"
- THEN the system MUST reject with HTTP 400 and error "Subdomain '{subdomain}' is reserved"

#### Scenario: Subdomain validation enforces format

- WHEN subdomain is "Clinica-Norte" (contains uppercase)
- THEN the system MUST reject with HTTP 400 and error "Subdomain must be lowercase alphanumeric with hyphens only"
- WHEN subdomain is "clinica_norte" (contains underscore)
- THEN the system MUST reject with HTTP 400
- WHEN subdomain is "a" (too short, min 3 chars)
- THEN the system MUST reject with HTTP 400 and error "Subdomain must be between 3 and 63 characters"
- WHEN subdomain is a 64-character string (exceeds DNS limit)
- THEN the system MUST reject with HTTP 400
- WHEN subdomain is "clinica-norte-veterinaria" (valid lowercase with hyphens)
- THEN the system MUST accept it

---

### Requirement: Authentication — JWT-Based Login

The system MUST provide login, logout, and token refresh endpoints with JWT access tokens and database-backed refresh tokens.

#### Scenario: Successful login returns access and refresh tokens

- GIVEN a User with email "maria@vet.com" exists
- AND the User has a UserTenant for TenantA with role VET
- WHEN a POST request is made to `/api/v1/auth/login` with subdomain "clinica-a.vetary.app" and:
  ```json
  {
    "email": "maria@vet.com",
    "password": "ValidPass123!"
  }
  ```
- THEN the system MUST validate the password using bcrypt comparison
- AND resolve the tenantId from the subdomain "clinica-a"
- AND verify that a UserTenant exists for (userId, tenantId)
- AND generate a JWT access token with payload:
  ```json
  {
    "sub": "userId",
    "tenantId": "TenantA.id",
    "role": "VET",
    "email": "maria@vet.com",
    "iat": 1622505600,
    "exp": 1622506500
  }
  ```
- AND generate a refresh token (random secure string)
- AND store the refresh token in the RefreshToken table with `expiresAt = now() + 7 days`
- AND return HTTP 200 with:
  ```json
  {
    "accessToken": "eyJhbGc...",
    "refreshToken": "secure-random-string"
  }
  ```

#### Scenario: Login fails when user has no access to tenant

- GIVEN a User with email "juan@vet.com" exists
- AND the User has NO UserTenant for TenantB
- WHEN a POST request is made to `/api/v1/auth/login` with subdomain "clinica-b.vetary.app" and correct password
- THEN the system MUST return HTTP 403 with error "You don't have access to this clinic"

#### Scenario: Login fails with invalid credentials

- GIVEN a User with email "maria@vet.com" exists with password hash for "CorrectPass123!"
- WHEN a POST request is made to `/api/v1/auth/login` with:
  ```json
  {
    "email": "maria@vet.com",
    "password": "WrongPassword"
  }
  ```
- THEN the system MUST return HTTP 401 with error "Invalid credentials"

#### Scenario: Login fails when tenant subdomain does not exist

- WHEN a POST request is made to `/api/v1/auth/login` with subdomain "nonexistent.vetary.app"
- THEN the system MUST return HTTP 404 with error "Tenant not found"

---

### Requirement: Token Refresh — Rotation and Revocation

The system MUST support refresh token rotation (invalidate old, issue new pair) and revocation (logout).

#### Scenario: Successful token refresh rotates tokens

- GIVEN a valid refresh token exists in the RefreshToken table with `revokedAt = null` and `expiresAt > now()`
- WHEN a POST request is made to `/api/v1/auth/refresh` with:
  ```json
  {
    "refreshToken": "valid-refresh-token"
  }
  ```
- THEN the system MUST mark the old refresh token as revoked (`revokedAt = now()`)
- AND generate a new access token with the same payload (userId, tenantId, role)
- AND generate a new refresh token
- AND store the new refresh token in the RefreshToken table with `expiresAt = now() + 7 days`
- AND return HTTP 200 with the new token pair

#### Scenario: Refresh fails with revoked token

- GIVEN a refresh token exists in the RefreshToken table with `revokedAt = 2026-05-30T10:00:00Z` (not null)
- WHEN a POST request is made to `/api/v1/auth/refresh` with the revoked token
- THEN the system MUST return HTTP 401 with error "Refresh token has been revoked"

#### Scenario: Refresh fails with expired token

- GIVEN a refresh token exists with `expiresAt = 2026-05-25T00:00:00Z` (past date)
- WHEN a POST request is made to `/api/v1/auth/refresh` at 2026-05-31
- THEN the system MUST return HTTP 401 with error "Refresh token has expired"

#### Scenario: Logout revokes refresh token

- GIVEN a valid refresh token exists
- WHEN a POST request is made to `/api/v1/auth/logout` with:
  ```json
  {
    "refreshToken": "valid-refresh-token"
  }
  ```
- THEN the system MUST set `revokedAt = now()` on the RefreshToken record
- AND return HTTP 204 No Content

#### Scenario: Logout with already-revoked token is idempotent

- GIVEN a refresh token that is already revoked (`revokedAt` is not null)
- WHEN a POST request is made to `/api/v1/auth/logout` with that token
- THEN the system MUST return HTTP 204 No Content (no error)

---

### Requirement: Tenant Isolation — Middleware and Guards

The system MUST enforce tenant isolation at multiple layers to prevent cross-tenant data access.

#### Scenario: TenantMiddleware resolves tenant from subdomain

- GIVEN a request is made to "clinica-norte.vetary.app/api/v1/users"
- WHEN the TenantMiddleware executes
- THEN it MUST extract subdomain "clinica-norte" from the hostname
- AND query the Tenant table for `subdomain = "clinica-norte"`
- AND attach the resolved Tenant object to `req.tenant`
- WHEN the subdomain does not exist in the database
- THEN the middleware MUST return HTTP 404 with error "Tenant not found"

#### Scenario: TenantGuard rejects requests with mismatched tenant

- GIVEN a User is logged into TenantA with JWT containing `{ tenantId: "TenantA.id" }`
- WHEN the User makes a request to subdomain "clinica-b.vetary.app" (TenantB)
- AND the TenantMiddleware resolves `req.tenant = TenantB`
- AND the AuthGuard resolves `req.user.tenantId = "TenantA.id"`
- WHEN the TenantGuard executes
- THEN it MUST compare `req.tenant.id` (TenantB.id) vs `req.user.tenantId` (TenantA.id)
- AND detect a mismatch
- AND return HTTP 403 with error "Your token belongs to a different clinic"

#### Scenario: Public routes bypass AuthGuard and TenantGuard

- GIVEN a controller endpoint is decorated with `@Public()`
- WHEN a request is made to `/api/v1/tenants/register` (public route)
- THEN the AuthGuard MUST NOT execute
- AND the TenantGuard MUST NOT execute
- AND the request MUST be processed without requiring authentication

---

### Requirement: Role-Based Access Control

The system MUST enforce role-based access control using the RolesGuard and `@Roles()` decorator.

#### Scenario: RolesGuard allows access when user has required role

- GIVEN a User is logged in with JWT containing `{ role: "ADMIN" }`
- AND a controller endpoint is decorated with `@Roles(Role.ADMIN)`
- WHEN the User makes a request to that endpoint
- THEN the RolesGuard MUST extract `req.user.role` ("ADMIN")
- AND compare it to the required roles metadata (["ADMIN"])
- AND allow the request to proceed

#### Scenario: RolesGuard denies access when user lacks required role

- GIVEN a User is logged in with JWT containing `{ role: "STAFF" }`
- AND a controller endpoint is decorated with `@Roles(Role.ADMIN, Role.VET)`
- WHEN the User makes a request to that endpoint
- THEN the RolesGuard MUST extract `req.user.role` ("STAFF")
- AND compare it to the required roles metadata (["ADMIN", "VET"])
- AND return HTTP 403 with error "Insufficient permissions"

---

### Requirement: User Management (Tenant-Scoped)

The system MUST provide endpoints to list and create users within the current tenant context.

#### Scenario: List users in current tenant (admin-only)

- GIVEN a User is logged in as ADMIN for TenantA
- AND TenantA has 3 users (via UserTenant records)
- AND TenantB has 2 users (separate tenant)
- WHEN a GET request is made to `/api/v1/users` with subdomain "clinica-a.vetary.app"
- THEN the system MUST query UserTenant for `tenantId = TenantA.id`
- AND join with the User table
- AND return HTTP 200 with an array of 3 User objects (only TenantA's users)
- AND the response MUST NOT include TenantB's users

#### Scenario: Create user in current tenant (admin-only)

- GIVEN a User is logged in as ADMIN for TenantA
- WHEN a POST request is made to `/api/v1/users` with:
  ```json
  {
    "email": "newvet@example.com",
    "password": "SecurePass123!",
    "firstName": "Carlos",
    "lastName": "Gómez",
    "role": "VET"
  }
  ```
- THEN the system MUST create a new User with the provided email and hashed password
- AND create a UserTenant record with `tenantId = TenantA.id`, `role = VET`
- AND return HTTP 201 with the created User object

#### Scenario: Create user with existing email reuses User, creates new UserTenant

- GIVEN a User with email "maria@vet.com" already exists (created for TenantA)
- AND a User is logged in as ADMIN for TenantB
- WHEN a POST request is made to `/api/v1/users` with:
  ```json
  {
    "email": "maria@vet.com",
    "password": "ignored-for-existing-user",
    "firstName": "María",
    "lastName": "López",
    "role": "VET"
  }
  ```
- THEN the system MUST find the existing User by email
- AND create a new UserTenant record with `userId = existing User.id`, `tenantId = TenantB.id`, `role = VET`
- AND return HTTP 201
- AND the password field MUST be ignored (existing User's password is not changed)

---

### Requirement: BaseRepository — Foundation for Tenant-Scoped Queries

The system MUST provide a BaseRepository abstract class that enforces tenant filtering for all future tenant-scoped entities (Bookings, Pets, Appointments in Phase 2+).

#### Scenario: BaseRepository enforces tenantId filtering

- GIVEN a repository extends BaseRepository
- WHEN the repository calls `findByTenant(tenantId, where)`
- AND `tenantId` is null or undefined
- THEN the method MUST throw an `UnauthorizedException` with message "Tenant context missing"
- WHEN `tenantId` is provided
- THEN the method MUST execute `findMany({ where: { tenantId, ...where } })`

#### Scenario: Phase 1 repositories do not extend BaseRepository

- GIVEN TenantRepository manages the Tenant table
- AND UserRepository manages the User table
- THEN TenantRepository MUST NOT extend BaseRepository (Tenant is not tenant-scoped)
- AND UserRepository MUST NOT extend BaseRepository (User is global, scoped via UserTenant)
- BUT BaseRepository MUST exist and be ready for Phase 2 repositories (BookingRepository, PetRepository)

---

### Requirement: Password Security

The system MUST hash all passwords using bcrypt with a cost factor of 10.

#### Scenario: Password hashing on user creation

- WHEN a User is created with plaintext password "SecurePass123!"
- THEN the system MUST hash the password using bcrypt with cost factor 10
- AND store only the `passwordHash` in the User table
- AND the plaintext password MUST NOT be stored anywhere

#### Scenario: Password comparison uses timing-safe comparison

- GIVEN a User has `passwordHash = "$2b$10$..."` (bcrypt hash of "CorrectPass")
- WHEN a login attempt is made with password "CorrectPass"
- THEN the system MUST use bcrypt's `compare()` function (timing-safe)
- AND return true
- WHEN a login attempt is made with password "WrongPass"
- THEN `compare()` MUST return false

---

### Requirement: Security Baseline Configuration

The system MUST configure security headers, CORS, rate limiting, and environment variable validation.

#### Scenario: Helmet.js security headers are enabled

- WHEN the application starts
- THEN the system MUST apply Helmet.js middleware with:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

#### Scenario: CORS is configured from environment variable

- GIVEN the environment variable `ALLOWED_ORIGINS = "https://vetary.app,https://*.vetary.app"`
- WHEN the application starts
- THEN the system MUST configure CORS to allow origins: `["https://vetary.app", "https://*.vetary.app"]`
- AND reject requests from any other origin
- WHEN `NODE_ENV = production` and `ALLOWED_ORIGINS = "*"`
- THEN the system MUST throw an error on startup with message "CORS wildcard not allowed in production"

#### Scenario: Rate limiting on auth endpoints

- WHEN a POST request is made to `/api/v1/auth/login`
- THEN the rate limiter MUST allow a maximum of 5 requests per IP address per 15 minutes
- WHEN the 6th request is made within 15 minutes
- THEN the system MUST return HTTP 429 with error "Too many requests, please try again later"
- WHEN a POST request is made to `/api/v1/tenants/register`
- THEN the rate limiter MUST allow a maximum of 3 requests per IP address per hour

#### Scenario: Environment variable validation on startup

- GIVEN the environment variable `JWT_SECRET` is missing or empty
- WHEN the application starts
- THEN the system MUST throw an error and refuse to start with message "JWT_SECRET is required"
- GIVEN `DATABASE_URL` is missing
- THEN the system MUST throw an error with message "DATABASE_URL is required"
- WHEN all required environment variables are present
- THEN the application MUST start successfully

---

## DTOs (Data Transfer Objects)

All DTOs MUST use class-validator decorators for input validation.

### RegisterTenantDto

```typescript
export class RegisterTenantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @ApiProperty({ example: 'Clínica Veterinaria San Martín' })
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Subdomain must be lowercase alphanumeric with hyphens only',
  })
  @ApiProperty({ example: 'clinica-san-martin' })
  subdomain: string;

  @IsEmail()
  @ApiProperty({ example: 'admin@clinica.com' })
  adminEmail: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  @ApiProperty({ example: 'SecurePass123!' })
  adminPassword: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Juan' })
  adminFirstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Pérez' })
  adminLastName: string;
}
```

### LoginDto

```typescript
export class LoginDto {
  @IsEmail()
  @ApiProperty({ example: 'admin@clinica.com' })
  email: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({ example: 'SecurePass123!' })
  password: string;
}
```

### RefreshTokenDto

```typescript
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}
```

### CreateUserDto

```typescript
export class CreateUserDto {
  @IsEmail()
  @ApiProperty({ example: 'newvet@example.com' })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  @ApiProperty({ example: 'SecurePass123!' })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Carlos' })
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Gómez' })
  lastName: string;

  @IsEnum(Role)
  @ApiProperty({ enum: Role, example: Role.VET })
  role: Role;
}
```

### UpdateUserDto

```typescript
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Juan', required: false })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @ApiProperty({ example: 'Pérez', required: false })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  @ApiProperty({ example: 'NewSecurePass123!', required: false })
  password?: string;
}
```

---

## API Endpoints

All endpoints MUST be prefixed with `/api/v1`.

### Public Endpoints (No Authentication Required)

#### POST /api/v1/tenants/register

**Purpose:** Register a new clinic with admin user in atomic transaction

**Request Body:** RegisterTenantDto

**Success Response:**
- Status: 201 Created
- Body:
```json
{
  "tenant": {
    "id": "clxxx123",
    "name": "Clínica Veterinaria San Martín",
    "subdomain": "clinica-san-martin",
    "status": "ACTIVE",
    "createdAt": "2026-05-31T10:00:00Z",
    "updatedAt": "2026-05-31T10:00:00Z"
  },
  "user": {
    "id": "clyyy456",
    "email": "admin@clinica.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "createdAt": "2026-05-31T10:00:00Z"
  }
}
```

**Error Responses:**
- 400 Bad Request: Invalid subdomain format or validation error
  ```json
  {
    "statusCode": 400,
    "message": ["Subdomain must be lowercase alphanumeric with hyphens only"],
    "error": "Bad Request"
  }
  ```
- 409 Conflict: Subdomain or email already exists
  ```json
  {
    "statusCode": 409,
    "message": "Subdomain already taken",
    "error": "Conflict"
  }
  ```

**Rate Limit:** 3 requests per IP per hour

---

#### POST /api/v1/auth/login

**Purpose:** Authenticate user and issue JWT tokens

**Request Body:** LoginDto

**Success Response:**
- Status: 200 OK
- Body:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "secure-random-string-uuid"
}
```

**Error Responses:**
- 401 Unauthorized: Invalid credentials
  ```json
  {
    "statusCode": 401,
    "message": "Invalid credentials",
    "error": "Unauthorized"
  }
  ```
- 403 Forbidden: User has no access to this tenant
  ```json
  {
    "statusCode": 403,
    "message": "You don't have access to this clinic",
    "error": "Forbidden"
  }
  ```
- 404 Not Found: Tenant subdomain does not exist
  ```json
  {
    "statusCode": 404,
    "message": "Tenant not found",
    "error": "Not Found"
  }
  ```

**Rate Limit:** 5 requests per IP per 15 minutes

---

#### POST /api/v1/auth/refresh

**Purpose:** Refresh access token using refresh token (rotates both tokens)

**Request Body:** RefreshTokenDto

**Success Response:**
- Status: 200 OK
- Body:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-secure-random-string-uuid"
}
```

**Error Responses:**
- 401 Unauthorized: Refresh token is invalid, expired, or revoked
  ```json
  {
    "statusCode": 401,
    "message": "Refresh token has been revoked",
    "error": "Unauthorized"
  }
  ```

---

### Authenticated Endpoints (Require Valid JWT)

#### POST /api/v1/auth/logout

**Purpose:** Revoke refresh token (logout)

**Authentication:** Required (JWT access token)

**Request Body:** RefreshTokenDto

**Success Response:**
- Status: 204 No Content

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token

---

#### GET /api/v1/auth/me

**Purpose:** Get current authenticated user information

**Authentication:** Required (JWT access token)

**Success Response:**
- Status: 200 OK
- Body:
```json
{
  "id": "clxxx123",
  "email": "admin@clinica.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "ADMIN",
  "tenant": {
    "id": "clyyy456",
    "name": "Clínica Veterinaria San Martín",
    "subdomain": "clinica-san-martin"
  }
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token
- 403 Forbidden: Token tenant mismatch with subdomain

---

#### GET /api/v1/users

**Purpose:** List all users in current tenant

**Authentication:** Required (JWT access token)

**Roles Allowed:** ADMIN, VET, STAFF

**Success Response:**
- Status: 200 OK
- Body:
```json
[
  {
    "id": "clxxx123",
    "email": "admin@clinica.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "ADMIN",
    "createdAt": "2026-05-31T10:00:00Z"
  },
  {
    "id": "clxxx456",
    "email": "vet@clinica.com",
    "firstName": "María",
    "lastName": "López",
    "role": "VET",
    "createdAt": "2026-05-31T11:00:00Z"
  }
]
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token
- 403 Forbidden: Token tenant mismatch with subdomain or insufficient role

---

#### POST /api/v1/users

**Purpose:** Create a new user in current tenant (or link existing user)

**Authentication:** Required (JWT access token)

**Roles Allowed:** ADMIN only

**Request Body:** CreateUserDto

**Success Response:**
- Status: 201 Created
- Body:
```json
{
  "id": "clxxx789",
  "email": "newvet@example.com",
  "firstName": "Carlos",
  "lastName": "Gómez",
  "role": "VET",
  "createdAt": "2026-05-31T12:00:00Z"
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token
- 403 Forbidden: User role is not ADMIN

---

#### GET /api/v1/users/:id

**Purpose:** Get user details by ID (must be in current tenant)

**Authentication:** Required (JWT access token)

**Roles Allowed:** ADMIN, or the user themselves (req.user.userId === params.id)

**Success Response:**
- Status: 200 OK
- Body:
```json
{
  "id": "clxxx123",
  "email": "admin@clinica.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "ADMIN",
  "createdAt": "2026-05-31T10:00:00Z",
  "updatedAt": "2026-05-31T10:00:00Z"
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token
- 403 Forbidden: User is not ADMIN and not requesting their own profile
- 404 Not Found: User ID does not exist or not in current tenant

---

#### PATCH /api/v1/users/:id

**Purpose:** Update user details (name, password)

**Authentication:** Required (JWT access token)

**Roles Allowed:** ADMIN, or the user themselves (req.user.userId === params.id)

**Request Body:** UpdateUserDto

**Success Response:**
- Status: 200 OK
- Body:
```json
{
  "id": "clxxx123",
  "email": "admin@clinica.com",
  "firstName": "Juan Updated",
  "lastName": "Pérez",
  "updatedAt": "2026-05-31T15:00:00Z"
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing JWT access token
- 403 Forbidden: User is not ADMIN and not updating their own profile
- 404 Not Found: User ID does not exist or not in current tenant

---

## Business Rules

### Subdomain Validation

**Reserved subdomains (MUST be rejected):**
- `admin`, `api`, `www`, `app`, `auth`, `super`, `root`, `mail`, `smtp`

**Format validation (MUST be enforced):**
- Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Minimum length: 3 characters
- Maximum length: 63 characters (DNS limit)
- Lowercase only
- Alphanumeric characters and hyphens only
- Must not start or end with a hyphen

### Login Resolution via Subdomain Context

**Process:**
1. TenantMiddleware extracts subdomain from `req.hostname` (e.g., "clinica-a.vetary.app" → "clinica-a")
2. Middleware queries Tenant table for `subdomain = "clinica-a"`
3. If not found → return HTTP 404 "Tenant not found"
4. If found → attach Tenant object to `req.tenant`
5. AuthService receives login request with email and password
6. AuthService finds User by email
7. AuthService validates password using bcrypt
8. AuthService queries UserTenant for `(userId, req.tenant.id)`
9. If no UserTenant exists → return HTTP 403 "You don't have access to this clinic"
10. If UserTenant exists → generate JWT with `{ userId, tenantId: req.tenant.id, role: UserTenant.role }`

### TenantGuard Logic

**Execution:**
1. TenantGuard runs AFTER AuthGuard (JWT is already validated)
2. Extract `req.tenant.id` (from TenantMiddleware)
3. Extract `req.user.tenantId` (from JWT payload)
4. Compare `req.tenant.id === req.user.tenantId`
5. If mismatch → return HTTP 403 "Your token belongs to a different clinic"
6. If match → allow request to proceed

### BaseRepository Contract

**Enforcement:**
- All methods that query tenant-scoped entities MUST include `tenantId` in the WHERE clause
- If `tenantId` is null or undefined → throw `UnauthorizedException("Tenant context missing")`
- BaseRepository is an abstract class with protected methods: `findByTenant()`, `createForTenant()`, `updateForTenant()`, `deleteForTenant()`
- Concrete repositories extend BaseRepository and implement `getDelegate()` to return the Prisma model delegate

**Phase 1 Exception:**
- TenantRepository does NOT extend BaseRepository (Tenant table is not tenant-scoped)
- UserRepository does NOT extend BaseRepository (User table is global, scoped via UserTenant junction)
- BaseRepository is implemented in Phase 1 but actively used in Phase 2+ (BookingRepository, PetRepository, etc.)

### Refresh Token Rotation

**Process:**
1. Client sends refresh token to `/api/v1/auth/refresh`
2. AuthService queries RefreshToken table for `token = refreshToken`
3. If not found → return HTTP 401 "Invalid refresh token"
4. If `revokedAt IS NOT NULL` → return HTTP 401 "Refresh token has been revoked"
5. If `expiresAt < now()` → return HTTP 401 "Refresh token has expired"
6. If valid → mark old refresh token as revoked (`UPDATE RefreshToken SET revokedAt = now() WHERE id = ...`)
7. Generate new access token with same payload (userId, tenantId, role)
8. Generate new refresh token (random secure string)
9. Store new refresh token in RefreshToken table with `expiresAt = now() + 7 days`
10. Return new token pair

### Atomic Registration Transaction

**Process:**
1. Validate RegisterTenantDto (subdomain format, reserved words, field validation)
2. Start Prisma transaction
3. Create Tenant: `prisma.tenant.create({ data: { name, subdomain, status: ACTIVE } })`
4. Hash admin password: `bcrypt.hash(adminPassword, 10)`
5. Create User: `prisma.user.create({ data: { email, passwordHash, firstName, lastName } })`
6. Create UserTenant: `prisma.userTenant.create({ data: { userId, tenantId, role: ADMIN } })`
7. Commit transaction
8. If any step fails → rollback entire transaction
9. Return created Tenant and User

---

## Error Catalog

All errors MUST follow this standardized format:

```json
{
  "statusCode": 400,
  "message": "Error message or array of validation errors",
  "error": "HTTP status text"
}
```

### Error Codes and Messages

| HTTP Status | Error Code          | Message                                         | Scenario                                    |
| ----------- | ------------------- | ----------------------------------------------- | ------------------------------------------- |
| 400         | Bad Request         | "Subdomain must be lowercase alphanumeric..."   | Invalid subdomain format                    |
| 400         | Bad Request         | "Subdomain '{subdomain}' is reserved"           | Reserved subdomain used                     |
| 400         | Bad Request         | "Subdomain must be between 3 and 63 characters" | Subdomain too short or too long             |
| 400         | Bad Request         | Validation error array                          | DTO validation failed (class-validator)     |
| 401         | Unauthorized        | "Invalid credentials"                           | Wrong email or password                     |
| 401         | Unauthorized        | "Refresh token has been revoked"                | Revoked refresh token used                  |
| 401         | Unauthorized        | "Refresh token has expired"                     | Expired refresh token used                  |
| 401         | Unauthorized        | "Invalid refresh token"                         | Refresh token not found in DB               |
| 401         | Unauthorized        | "Unauthorized"                                  | Missing or invalid JWT access token         |
| 403         | Forbidden           | "You don't have access to this clinic"          | User has no UserTenant for this tenant      |
| 403         | Forbidden           | "Your token belongs to a different clinic"      | JWT tenantId mismatch with subdomain        |
| 403         | Forbidden           | "Insufficient permissions"                      | User role not in required roles list        |
| 404         | Not Found           | "Tenant not found"                              | Subdomain does not exist in DB              |
| 404         | Not Found           | "User not found"                                | User ID does not exist or not in tenant     |
| 409         | Conflict            | "Subdomain already taken"                       | Duplicate subdomain registration            |
| 409         | Conflict            | "Email already registered"                      | Duplicate email registration                |
| 429         | Too Many Requests   | "Too many requests, please try again later"     | Rate limit exceeded                         |
| 500         | Internal Server Error | "Internal server error"                       | Unexpected server error                     |

---

## Environment Variables

All environment variables MUST be validated on application startup. Missing required variables MUST cause the application to fail with a clear error message.

### Required Variables

| Variable           | Description                                      | Example Value                                      | Validation                             |
| ------------------ | ------------------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| `DATABASE_URL`     | PostgreSQL connection string                     | `postgresql://user:pass@localhost:5432/vetary`     | Must be a valid PostgreSQL URL         |
| `JWT_SECRET`       | Secret key for signing JWT tokens                | `super-secret-key-change-in-production-123`        | Must be at least 32 characters         |
| `JWT_EXPIRATION`   | Access token expiration time                     | `15m`                                              | Must be a valid time string (e.g., 15m, 1h) |
| `REFRESH_TOKEN_EXPIRATION` | Refresh token expiration time            | `7d`                                               | Must be a valid time string (e.g., 7d) |
| `ALLOWED_ORIGINS`  | Comma-separated list of allowed CORS origins     | `https://vetary.app,https://*.vetary.app`          | Must not be `*` when `NODE_ENV=production` |
| `BCRYPT_ROUNDS`    | Bcrypt hashing cost factor                       | `10`                                               | Must be an integer between 8 and 12    |
| `PORT`             | HTTP server port                                 | `3000`                                             | Must be a valid port number (1-65535)  |
| `NODE_ENV`         | Environment name                                 | `development`, `production`, `test`                | Must be one of: development, production, test |

### Optional Variables (Development)

| Variable                  | Description                              | Default Value | Development Use Case                    |
| ------------------------- | ---------------------------------------- | ------------- | --------------------------------------- |
| `DEFAULT_TENANT_SUBDOMAIN` | Default tenant for localhost testing     | `null`        | Bypass subdomain resolution on localhost (dev only) |
| `RATE_LIMIT_ENABLED`      | Enable/disable rate limiting             | `true`        | Disable in local dev for testing        |

### Validation Rules

**On application startup, the system MUST:**
1. Check that all required variables are present
2. Validate that values match expected formats (e.g., DATABASE_URL is a valid PostgreSQL URL)
3. If `NODE_ENV=production` and `ALLOWED_ORIGINS=*`, throw error "CORS wildcard not allowed in production"
4. If `JWT_SECRET` length < 32, throw error "JWT_SECRET must be at least 32 characters"
5. If any validation fails, log clear error message and exit with non-zero status code

**Example validation error output:**
```
Error: Environment variable validation failed
  - JWT_SECRET is required
  - DATABASE_URL must be a valid PostgreSQL connection string
  - ALLOWED_ORIGINS cannot be '*' in production
Application startup aborted.
```

---

## Risks

### 🔴 CRITICAL: Tenant Isolation Leakage

**Risk:** A bug in TenantGuard or BaseRepository allows queries without `tenantId` filter → one clinic sees another's data.

**Mitigation:**
- BaseRepository MUST throw exception if `tenantId` is null/undefined
- Integration test per repository (Phase 2+): create data for Tenant A, query as Tenant B, assert empty result
- E2E test: login as Clinic A admin, attempt to access Clinic B's endpoint via subdomain manipulation, assert 403

### 🟠 HIGH: JWT/Subdomain Mismatch Exploitation

**Risk:** User logs into Clinic A, manually changes URL to Clinic B's subdomain, attempts to use Clinic A's JWT.

**Mitigation:**
- TenantGuard is MANDATORY on all authenticated routes
- TenantGuard MUST compare `req.tenant.id` (from subdomain) vs `req.user.tenantId` (from JWT)
- Mismatch → HTTP 403 "Your token belongs to a different clinic"
- E2E test: login to Clinic A, make request to Clinic B's subdomain with Clinic A's JWT, assert 403

### 🟠 HIGH: Refresh Token Theft Without Revocation

**Risk:** If refresh tokens are stateless (no DB), a stolen token = permanent access until expiry (7 days).

**Mitigation:**
- Store refresh tokens in DB with `revokedAt` field
- Logout immediately revokes token
- Token rotation: every refresh invalidates old token, issues new one
- Future (v2): "Logout all devices" endpoint

### 🟡 MEDIUM: Subdomain Validation Bypass

**Risk:** User registers tenant with subdomain `admin`, `api`, `www` → conflicts with system routes.

**Mitigation:**
- Reserved subdomains list: `['admin', 'api', 'www', 'app', 'auth', 'super', 'root', 'mail', 'smtp']`
- Subdomain regex validation: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Min length 3, max 63 (DNS limit)
- Return HTTP 400 with clear error message

### 🟡 MEDIUM: Tenant Registration Transaction Failure

**Risk:** Tenant is created, but User creation fails → orphaned Tenant with no admin.

**Mitigation:**
- Wrap in Prisma transaction: if any step fails (Tenant create, User create, UserTenant create), rollback entire transaction
- Integration test: mock DB error on User creation, assert Tenant not created

---

## Acceptance Criteria

Phase 1 is complete when ALL of the following are verified:

### ✅ Functional Requirements

- [ ] A clinic can register with name, subdomain, and admin credentials via `/api/v1/tenants/register`
- [ ] Subdomain validation rejects reserved words and invalid formats (HTTP 400)
- [ ] Duplicate subdomain registration returns HTTP 409 "Subdomain already taken"
- [ ] Registration creates Tenant, User, and UserTenant in atomic transaction
- [ ] Transaction rollback works if any step fails (integration test confirms)
- [ ] Admin can log in with email and password via `/api/v1/auth/login`
- [ ] Login returns access token (15min expiry) and refresh token (7 days)
- [ ] Invalid credentials return HTTP 401 "Invalid credentials"
- [ ] User without access to tenant returns HTTP 403 "You don't have access to this clinic"
- [ ] Token refresh rotates tokens (old refresh token is revoked, new pair is issued)
- [ ] Logout revokes refresh token via `/api/v1/auth/logout`
- [ ] Revoked refresh token cannot be used (HTTP 401)
- [ ] Expired refresh token cannot be used (HTTP 401)
- [ ] User can belong to multiple tenants via UserTenant junction table
- [ ] Each UserTenant has one role per clinic
- [ ] Login via subdomain resolves correct tenant context in JWT payload
- [ ] JWT contains `{ userId, tenantId, role, email }`
- [ ] User with Clinic A token cannot access Clinic B's subdomain (TenantGuard rejects with HTTP 403)

### ✅ Security Requirements

- [ ] Passwords are hashed with bcrypt (cost factor 10)
- [ ] Plaintext passwords are never stored in the database
- [ ] CORS is configured from `ALLOWED_ORIGINS` env var (not hardcoded)
- [ ] CORS wildcard (`*`) is rejected when `NODE_ENV=production`
- [ ] Helmet.js security headers are enabled
- [ ] Rate limiting is active on `/auth/login` (5 per IP per 15min)
- [ ] Rate limiting is active on `/tenants/register` (3 per IP per hour)
- [ ] All DTOs are validated with class-validator
- [ ] ValidationPipe is configured globally with `whitelist: true` and `forbidNonWhitelisted: true`
- [ ] All required environment variables are validated on startup
- [ ] Missing required env var causes application to fail with clear error message

### ✅ Tenant Isolation Requirements

- [ ] TenantMiddleware extracts tenant from subdomain on every request
- [ ] Invalid subdomain returns HTTP 404 "Tenant not found"
- [ ] TenantGuard compares subdomain tenant vs JWT tenant
- [ ] TenantGuard mismatch returns HTTP 403 "Your token belongs to a different clinic"
- [ ] BaseRepository is implemented (ready for Phase 2 modules)
- [ ] BaseRepository throws exception if `tenantId` is null/undefined

### ✅ Authorization Requirements

- [ ] AuthGuard validates JWT on protected routes
- [ ] Public routes (`@Public()`) skip AuthGuard
- [ ] RolesGuard enforces `@Roles(...)` decorator
- [ ] User without required role returns HTTP 403 "Insufficient permissions"
- [ ] GET `/users` returns only users in current tenant (tenant-scoped)
- [ ] POST `/users` creates user in current tenant or links existing user
- [ ] Existing user email creates new UserTenant (does not change password)

### ✅ Testing Requirements (Strict TDD)

- [ ] Unit tests for TenantService (subdomain validation, registration transaction)
- [ ] Unit tests for AuthService (login, token generation, password hashing, refresh rotation)
- [ ] Unit tests for UserService (find users in tenant, create user)
- [ ] Integration tests for repositories (tenant isolation verified)
- [ ] E2E test: successful tenant registration
- [ ] E2E test: successful login flow (access + refresh tokens)
- [ ] E2E test: token refresh rotates tokens
- [ ] E2E test: logout revokes token
- [ ] E2E test: Clinic A user cannot access Clinic B's data (cross-tenant isolation)
- [ ] E2E test: TenantGuard rejects JWT/subdomain mismatch

---

## Metadata

**Domains affected:** Auth, Tenants, Users  
**Prisma models:** 4 (Tenant, User, UserTenant, RefreshToken)  
**API endpoints:** 9 total (3 public, 6 authenticated)  
**DTOs:** 5 (RegisterTenantDto, LoginDto, RefreshTokenDto, CreateUserDto, UpdateUserDto)  
**Key business rules:** Subdomain validation, login resolution via subdomain, TenantGuard tenant matching, refresh token rotation, atomic registration transaction  
**Environment variables:** 8 required, 2 optional (dev)  
**Teaching level:** Beginner (include explanatory comments for all patterns)  
**Strict TDD:** ACTIVE (tests written before implementation for all critical modules)  

---

**Specification Status:** Ready for Design Phase
