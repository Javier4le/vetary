# Proposal: Public Client Booking (CLIENT)

## Intent

Open booking to pet owners: clients self-register within a tenant and create their own
bookings. Runs immediately after `fase-3-reservas-internas`, before Phase 4, completing the v1
booking flow in SPEC.md.

Shared Phase 3 context is retained in
`../fase-3-reservas-internas/exploration.md`, which contains the complete pre-split exploration,
including discarded approaches and the rationale for the accepted decisions.

## Branch / PR Boundary

- PR-1 branch `feature/fase-3-publicas-pr1-foundation`; PR targets `develop` after the internal
  change merges. Later slices use their own `feature/fase-3-publicas-prN-*` branches.
- Runs immediately after `fase-3-reservas-internas`, before Phase 4.
- Independent artifacts; tasks start at T-001. Phase tag `fase-3-complete` after both close.

## Scope

### In Scope

- `CLIENT` added to the `Role` enum + one migration.
- Public client self-registration within tenant context (subdomain-resolved).
- Client creates bookings for themselves; authorization restricted to own bookings.
- Tenant resolution for unauthenticated clients (subdomain → tenant).
- Reuse validated booking infrastructure (state machine, overlap, availability fit).
- Strict TDD (`bookings` + `auth`).

### Out of Scope

- `Pet` model and pet registration (→ Phase 4); booking keeps the `petName` string.
- Clinical-history viewing, notifications, payments, admin CRUD of clients beyond registration.
- Changing internal ADMIN/STAFF booking behavior.

## Capabilities

### New Capabilities

- `client-registration`: `CLIENT` role + public self-registration endpoint (atomic
  `User` + `UserTenant(CLIENT)`).

### Modified Capabilities

- `bookings`: public booking creation endpoint; CLIENT authorization scoped to own bookings.
- `auth`: `CLIENT` in `Role` enum + registration DTO + JWT role propagation.

## Approach

Public `POST /auth/register` (client) atomically creates `User` + `UserTenant(role=CLIENT)`,
mirroring `createVet`. Tenant resolved from subdomain by `TenantMiddleware` (add path to
tenant-agnostic list only if needed). Booking creation reuses `BookingsService`; a client is
authorized only for bookings where `clientId === req.user.userId`. No domain entity classes.

## Affected Areas

| Area | Impact |
|------|--------|
| `vetary-api/prisma/schema.prisma` | Modified (`CLIENT` in `Role`) |
| `vetary-api/src/modules/auth/**` | Modified (register endpoint + DTO) |
| `vetary-api/src/modules/bookings/**` | Modified (client-scoped create) |
| `vetary-api/src/modules/users/**` | Modified (`CreateUserDto` role enum) |
| `vetary-api/test/**` | New (registration + public booking) |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Unauthenticated tenant-resolution gaps | Med | subdomain resolution; wrong-tenant E2E |
| `Role` migration + DTO drift | Low | single migration + DTO enum in same change |
| Client authz leak (booking of others) | Med | `clientId` scoping + integration test |
| Scope creep | Med | no Pet, no notifications |

## Rollback Plan

Additive (enum value + endpoints). Revert = `git revert` + migration rollback (remove `CLIENT`
only after bookings removed). Internal booking path unchanged.

## Dependencies

- `fase-3-reservas-internas` completed (bookings module + state machine + overlap + availability fit).
- Phase 2 complete.

## Success Criteria

- [ ] Client self-registers; `User` + `UserTenant(CLIENT)` atomic (201).
- [ ] Client creates a booking (reuses overlap + availability validation) (201).
- [ ] Client cannot create or read another client's booking (403/404).
- [ ] Tenant resolution correct for unauthenticated subdomain flow.
- [ ] Strict TDD green; Biome + `tsc` clean.
