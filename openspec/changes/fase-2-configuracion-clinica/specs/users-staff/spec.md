# Delta for Users — Staff Creation

## ADDED Requirements

### Requirement: Staff Account Convenience Endpoint

The system MUST provide an admin-only convenience endpoint that creates a STAFF user.

| ID | Requirement |
|---|---|
| ST01 | `POST /api/v1/users/staff` wraps the existing user creation logic with `role=STAFF`. |
| ST02 | The endpoint is ADMIN-only. |
| ST03 | Existing email collision behavior from Phase 1 is preserved. |

#### Scenario: Create staff member

- GIVEN an authenticated ADMIN in tenant A
- WHEN `POST /api/v1/users/staff` is called with `{ email: "staff@example.com", firstName: "Ana", lastName: "Torres", password: "SecurePass123!" }`
- THEN the system MUST create or link a User
- AND create a UserTenant with role STAFF in tenant A
- AND return HTTP 201

#### Scenario: Existing email reuse

- GIVEN a User with email "staff@example.com" exists globally
- WHEN an ADMIN calls `POST /api/v1/users/staff` with that email
- THEN the system MUST reuse the existing User
- AND create a UserTenant(role=STAFF) in the current tenant
