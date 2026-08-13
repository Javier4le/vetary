# Exploration for fase-1-fundacion: PR3 Closure and Finalization

## Current State
Phase 1 has established the essential multi-tenant security foundations for Vetary, including atomic tenant registration, JWT authentication with refresh tokens, user management with role-based access, and tenant isolation via a layered architecture.

Tenant context is resolved at middleware level from subdomain and enforced through guards (AuthGuard, TenantGuard, RolesGuard) combined with base repository filtering.

PR1 and PR2 delivered foundational code for tenant creation, authentication, and user services, but guards and E2E tenant isolation tests remain to finalize Phase 1.

## Affected Areas
- `vetary-api/src/common/middleware/tenant.middleware.ts`
- `vetary-api/src/modules/auth/services/auth.service.ts`
- `vetary-api/src/modules/tenants/services/tenant.service.ts`
- `vetary-api/src/modules/*/repositories/`
- `vetary-api/src/common/decorators/`
- Guards implementation and integration pending

## Approaches

1. **Scoped PR3: Guards + E2E Tests**
   - Implement AuthGuard, TenantGuard, RolesGuard.
   - Use @Public(), @Roles() decorators.
   - Add E2E tests verifying cross-tenant isolation.
   - Pros: Balanced scope and risk, suitable for 400-line limit.
   - Cons: No UI features.

2. **Expanded PR3: Add Missing Features + Guards + Tests**
   - Complete missing user/auth code.
   - Implement Guards and exhaustive tests.
   - Pros: Full foundation before Phase 2.
   - Cons: Larger scope, risk of long PR.

3. **Minimal PR3: Only E2E Tests**
   - Assume implemented guards.
   - Deliver tenant isolation E2E only.
   - Pros: Small scope, quick.
   - Cons: Risk if guards incomplete.

## Recommendation
Go with Scoped PR3: finalize guards, decorators, and E2E tests to close Phase 1 securely.

## Risks
- Guard bugs leaking tenant info.
- Missing tests allowing regressions.
- Oversized PR delaying Phase 1.

## PR3 Closure Scope
### IN SCOPE
- AuthGuard, TenantGuard, RolesGuard implementations
- Controller decorators
- Integration wiring
- E2E tenant isolation tests
### OUT OF SCOPE
- UI features
- Non-guard business logic
- Email, MFA, impersonation
### Acceptance Tests
- Cross-tenant access denied
- JWT validation enforced
- TenantGuard matching enforced
- Role enforcement working
- Middleware tenant context correct
