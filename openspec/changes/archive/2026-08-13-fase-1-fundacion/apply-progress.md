# Apply Progress — PR2: AuthService (T13) + AuthController (T14)

## T13: AuthService — COMPLETED ✅

### TDD Cycle Evidence (Strict TDD)

| Step | Action | Evidence |
|------|--------|----------|
| **RED** | Wrote auth.service.spec.ts with 14 tests BEFORE implementation | Tests failed with "Cannot find module './auth.service'" |
| **GREEN** | Implemented auth.service.ts with all methods | 14/14 tests passed |
| **TRIANGULATE** | Added edge cases: revoked token, expired token, non-existent token, null tenant | All edge cases covered |
| **REFACTOR** | Cleaned imports, removed biome-ignore comments (useImportType is off), fixed paths | Clean compile, no warnings |

### Files Created
- `vetary-api/src/modules/auth/dto/login.dto.ts` — LoginDto (email, password, tenantId)
- `vetary-api/src/modules/auth/dto/refresh-token.dto.ts` — RefreshTokenDto (refreshToken)
- `vetary-api/src/modules/auth/services/auth.service.ts` — AuthService implementation
- `vetary-api/src/modules/auth/services/auth.service.spec.ts` — 14 tests (STRICT TDD)

### Files Modified
- `vetary-api/src/modules/auth/auth.module.ts` — Added AuthService provider + AuthController, exports AuthService

### Tests (14 total)
1. ✅ hashPassword("SecurePass123!") → returns bcrypt hash starting with $2b$
2. ✅ comparePasswords("SecurePass123!", hash) → true
3. ✅ comparePasswords("wrong", hash) → false
4. ✅ login(email, password, tenantId) valid → returns { accessToken, refreshToken }
5. ✅ login wrong password → throws UnauthorizedException
6. ✅ login user not found → throws UnauthorizedException
7. ✅ login user has no UserTenant for tenantId → throws ForbiddenException
8. ✅ refresh(validToken) → revokes old, returns new pair
9. ✅ refresh(revokedToken) → throws UnauthorizedException
10. ✅ refresh(expiredToken) → throws UnauthorizedException
11. ✅ refresh(nonExistentToken) → throws UnauthorizedException
12. ✅ logout(refreshToken) → marks as revoked
13. ✅ logout(nonExistentToken) → throws UnauthorizedException
14. ✅ hashPassword produces different hashes for same password (salted)

### Implementation Details
- Injects: PrismaService, ConfigService, JwtService
- hashPassword: bcrypt.hash with BCRYPT_ROUNDS from config
- comparePasswords: bcrypt.compare
- login: find User by email → find UserTenant by userId+tenantId → compare password → JwtService.sign(payload) + create RefreshToken record (random UUID, 7-day expiry)
- refresh: find RefreshToken by token → check not revoked & not expired → revoke old → create new RefreshToken → return new pair
- logout: find by token → set revokedAt = new Date()
- JWT payload: { sub: userId, tenantId, role, email }
- Access token expiry: JWT_EXPIRATION from config
- Refresh token expiry: REFRESH_TOKEN_EXPIRATION from config (parsed with parseExpiration helper)

### Security Decisions
- Same error message for "user not found" and "wrong password" → prevents email enumeration
- Token rotation on refresh → old token revoked, new pair generated
- Refresh tokens stored in DB with expiry → enables revocation (logout)
- ForbiddenException (not Unauthorized) for missing UserTenant → distinguishes auth failure from access denial

---

## T14: AuthController — COMPLETED ✅

### Files Created
- `vetary-api/src/modules/auth/controllers/auth.controller.ts` — AuthController with 4 endpoints
- `vetary-api/src/modules/auth/controllers/auth.controller.spec.ts` — 6 tests

### Endpoints
| Method | Route | Guard | Decorators | Description |
|--------|-------|-------|------------|-------------|
| POST | /auth/login | @Public() | @ApiOperation, @ApiResponse | Authenticate, return tokens |
| POST | /auth/logout | @UseGuards(AuthGuard('jwt')) | @ApiBearerAuth, @HttpCode(204) | Revoke refresh token |
| POST | /auth/refresh | @Public() | @ApiOperation, @ApiResponse | Generate new token pair |
| GET | /auth/me | @UseGuards(AuthGuard('jwt')) | @ApiBearerAuth, @CurrentUser, @CurrentTenant | Return current user identity |

### Tests (6 total)
1. ✅ Controller is defined
2. ✅ POST /auth/login delegates to authService.login with correct args
3. ✅ POST /auth/logout delegates to authService.logout with refresh token
4. ✅ POST /auth/refresh delegates to authService.refresh with refresh token
5. ✅ GET /auth/me returns user identity from CurrentUser decorator
6. ✅ GET /auth/me handles null tenant gracefully

### Swagger Documentation
- All endpoints have @ApiOperation, @ApiResponse decorators
- Protected endpoints have @ApiBearerAuth()
- Response schemas with examples provided

---

## Full Test Results

```
Test Suites: 7 passed, 7 total
Tests:       72 passed, 72 total
Snapshots:   0 total
Time:        3.891 s
```

All existing tests continue to pass (no regressions).

---

## Teaching Comments Applied
- 🏗️ ARQUITECTURA: Module/Service/Controller separation, AuthModule as dependency boundary
- 📐 PATRÓN: Service, DTO, Token Rotation, Bearer Token
- ⚡ PRINCIPIO: Single Responsibility, Separation of Concerns, Fail Fast, Defence in Depth, Validate at the Border
- 🔒 SEGURIDAD: bcrypt hashing, token rotation, email enumeration prevention, JWT payload scoping, refresh token revocation

---

## Remaining Tasks
- T15: AuthGuard + Public decorator integration (global guard)
- T16: E2E tests for auth flow
