# Frontend App Shell Specification

## Purpose

Define the minimal application shell for PR-1: React Router wiring, a placeholder route, the docs-first commit requirements, the same-domain deployment topology rules, and the open subdomain-to-tenant gap that blocks PR-2.

## Requirements

### Requirement: React Router Configuration (APS-01)

The application MUST configure React Router in `vetary-web/src/app/router.tsx`.

#### Scenario: Router file exports a configured router

- GIVEN the file `vetary-web/src/app/router.tsx`
- WHEN its contents are inspected
- THEN it MUST import `createBrowserRouter` (or equivalent v6 API) from `react-router-dom`
- AND it MUST export a router object or a component that renders `<RouterProvider />`

#### Scenario: Router is mounted in the application entry

- GIVEN the file `vetary-web/src/main.tsx`
- WHEN its contents are inspected
- THEN it MUST render the router exported from `vetary-web/src/app/router.tsx`

### Requirement: Placeholder Route (APS-02)

The router MUST contain exactly one placeholder route that renders visible content without making real API calls.

#### Scenario: A placeholder page is reachable

- GIVEN the development server is running
- WHEN the browser navigates to the root path `/`
- THEN a placeholder component MUST render (e.g., a heading or status message)
- AND the placeholder MUST NOT perform `POST /auth/login` or any other backend mutation

#### Scenario: Placeholder lives inside a feature

- GIVEN the placeholder route definition
- WHEN its component import path is inspected
- THEN it MUST import the page from `src/features/<feature>/pages/...`
- AND it MUST NOT import the page from `src/app/` or `src/pages/` at the top level

### Requirement: Docs-First Commit (APS-03)

Before any application code is committed, `docs/decisions.md` MUST gain ADR-005 and ADR-006, and `SPEC.md` / `README.md` MUST stop misrepresenting the phase order.

#### Scenario: ADR-005 exists before app code

- GIVEN the branch `feature/fase-5-frontend-pr1-bootstrap`
- WHEN the first commit touching the branch is inspected
- THEN `docs/decisions.md` MUST contain ADR-005 "Frontend foundation pulled forward from Phase 5"
- AND the ADR MUST follow the existing template and be inserted after ADR-004

#### Scenario: ADR-006 documents deployment topology

- GIVEN `docs/decisions.md` after the docs commit
- WHEN its ADR list is inspected
- THEN it MUST contain ADR-006 "Same-domain deployment topology for tenant resolution"
- AND the ADR MUST state that the original Host header is preserved, `/api/v1` is not stripped, and the dev proxy uses `changeOrigin: false`

#### Scenario: Phase order is corrected in SPEC.md and README.md

- GIVEN `SPEC.md` and `README.md` after the docs commit
- WHEN their Phase 3 and Phase 5 sections are inspected
- THEN Phase 3 MUST be marked as paused at PR-3
- AND Phase 5 MUST be described as "Frontend Foundation + Dashboard — In progress"
- AND any line stating that the frontend does not exist MUST be updated or removed

### Requirement: Same-Domain Deployment Topology (APS-04)

Production deployment MUST serve the SPA and the API on the same origin so that the tenant subdomain remains in the `Host` header and the `/api/v1` global prefix is preserved.

#### Scenario: Reverse proxy preserves Host and prefix

- GIVEN a request to `https://laspalmeras.vetary.app/api/v1/users`
- WHEN the reverse proxy forwards the request to the backend
- THEN the backend MUST receive `Host: laspalmeras.vetary.app`
- AND the backend MUST receive the request path as `/api/v1/users`
- AND `/api/v1` MUST NOT be stripped

#### Scenario: Cross-domain topology is rejected

- GIVEN a proposal to deploy the API at `https://api.vetary.app` and the SPA at `https://app.vetary.app`
- WHEN the deployment plan is reviewed against this specification
- THEN it MUST be rejected because `api` is a reserved subdomain and the tenant subdomain would be lost from the `Host` header

### Requirement: Vite Dev Proxy Reproduction (APS-05)

Local development MUST reproduce the same-domain topology using a Vite proxy with `changeOrigin: false`, accessed via `<sub>.localhost:5173`.

#### Scenario: Dev proxy preserves subdomain Host

- GIVEN `vetary-web/vite.config.ts` configures `server.proxy['/api']` pointing to `http://localhost:3000` with `changeOrigin: false`
- WHEN the app is accessed at `http://laspalmeras.localhost:5173`
- AND it makes a request to `/api/v1/users`
- THEN the backend MUST receive `Host: laspalmeras.localhost`
- AND the request path MUST be `/api/v1/users`

#### Scenario: Plain localhost does not hide tenant resolution

- GIVEN the app is accessed at `http://localhost:5173`
- WHEN a backend request is made
- THEN the backend MAY fall back to `DEFAULT_TENANT_SUBDOMAIN`
- AND this mode MUST be documented as a fallback that does not validate real subdomain resolution

## Open Gaps and Out-of-Scope Items

### Requirement: Subdomain → tenantId Resolution (OPEN-GAP-01)

The frontend knows its own subdomain from the browser hostname but, in PR-1, the system does NOT provide a way to resolve that subdomain to a tenant UUID. This requirement is explicitly **NOT SATISFIED** in PR-1 and blocks PR-2 real login.

(Reason: `POST /auth/login` requires `tenantId` in the body, and the tenants module only exposes `POST /tenants/register`. No public resolver exists.)

(Migration: Resolve in PR-2 by choosing one of the approved options: (a) add `GET /tenants/resolve?subdomain=`, (b) extend login to accept subdomain, or (c) a documented temporary demo bridge with a clear expiration.)

#### Scenario: PR-1 leaves the gap unresolved

- GIVEN PR-1 is complete
- WHEN the public backend API surface is inspected
- THEN there MUST be no endpoint that returns a tenant UUID for a given subdomain
- AND the frontend MUST NOT attempt to log in against the real API

#### Scenario: PR-2 is blocked until the gap is closed

- GIVEN the PR-2 planning phase begins
- WHEN the subdomain-to-tenant resolution decision is reviewed
- THEN it MUST be explicitly resolved before any login page or auth store is implemented
