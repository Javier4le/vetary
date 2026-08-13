# Delta for Users — Vet Creation

## ADDED Requirements

### Requirement: Atomic Vet Account Creation

The system MUST provide an admin-only endpoint to create a VET account and VetProfile atomically.

| ID | Requirement |
|---|---|
| V01 | `POST /api/v1/users/vets` creates `User`, `UserTenant(role=VET)`, and `VetProfile` in a single atomic transaction. |
| V02 | `VetProfile` fields include optional `specialty`, `registrationNumber`, and `bio`. |
| V03 | The endpoint is ADMIN-only. |
| V04 | The role is enforced server-side as `VET`. |

#### Scenario: Create a new vet

- GIVEN an authenticated ADMIN in tenant A
- WHEN `POST /api/v1/users/vets` is called with `{ email: "vet@example.com", firstName: "María", lastName: "López" }`
- THEN the system MUST create a User, a UserTenant with role VET, and a VetProfile
- AND return HTTP 201

#### Scenario: Atomic rollback on failure

- GIVEN the vet creation transaction fails during VetProfile creation
- THEN the system MUST rollback User and UserTenant creation
- AND no partial records remain

### Requirement: Existing Email Reuse

The system MUST reuse an existing User when the email already exists globally.

| ID | Requirement |
|---|---|
| V05 | If the email exists globally, the system MUST reuse the existing User. |
| V06 | The system MUST create a new UserTenant for the current tenant if missing. |
| V07 | The password field MUST be ignored for existing users. |

#### Scenario: Reuse existing user across tenants

- GIVEN a User with email "vet@example.com" exists in tenant A
- WHEN an ADMIN from tenant B calls `POST /api/v1/users/vets` with that email
- THEN the system MUST reuse the existing User
- AND create a UserTenant(role=VET) in tenant B
- AND create a VetProfile in tenant B
