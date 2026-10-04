# Frontend API Client Specification

## Purpose

Define the shared HTTP client for `vetary-web`: a factory that produces an Axios instance with a dynamic request interceptor, a singleton export for application use, and the same-origin relative baseURL required by the same-domain deployment topology.

## Requirements

### Requirement: Factory and Singleton Shape (API-01)

The file `vetary-web/src/shared/lib/apiClient.ts` MUST export a factory function `createApiClient(getToken)` and a singleton `apiClient` instance.

#### Scenario: Factory accepts a token reader

- GIVEN the module `vetary-web/src/shared/lib/apiClient.ts`
- WHEN its public exports are inspected
- THEN it MUST export a function `createApiClient` accepting a single argument of type `() => string | null`
- AND it MUST export an `apiClient` singleton created by `createApiClient(() => null)` in PR-1

#### Scenario: Singleton is reusable across the app

- GIVEN the `apiClient` singleton
- WHEN it is imported from two different modules
- THEN both imports MUST reference the same Axios instance

### Requirement: Same-Origin Relative baseURL with Optional Override (API-02)

The API client MUST default to the same-origin relative baseURL `/api/v1`. An optional `VITE_API_URL` environment variable MUST override the default.

#### Scenario: Default baseURL is relative

- GIVEN `VITE_API_URL` is unset
- WHEN the Axios instance is inspected
- THEN its `baseURL` MUST be `"/api/v1"`

#### Scenario: Environment variable overrides the default

- GIVEN `VITE_API_URL` is set to `"https://staging.vetary.app/api/v1"`
- WHEN the Axios instance is constructed
- THEN its `baseURL` MUST be `"https://staging.vetary.app/api/v1"`

#### Scenario: Override is documented

- GIVEN the file `vetary-web/.env.example`
- WHEN its contents are inspected
- THEN it MUST document `VITE_API_URL` with a comment explaining that the default same-origin `/api/v1` is used when the variable is unset

### Requirement: Dynamic Token Read in Request Interceptor (API-03)

The request interceptor MUST read the auth token by calling `getToken()` inside the interceptor function on every outgoing request. It MUST NOT capture the token value once at module load or at instance construction.

#### Scenario: Token is read fresh on each request

- GIVEN `createApiClient(getToken)` where `getToken` returns a mutable token value
- AND the first request is made while `getToken()` returns `null`
- WHEN the token value is changed to `"token-a"` and a second request is made
- THEN the second request MUST include the header `Authorization: Bearer token-a`
- AND the first request MUST NOT include an `Authorization` header

#### Scenario: Token changes are reflected on subsequent requests

- GIVEN a client created with a mutable `getToken`
- AND `getToken()` initially returns `"old-token"`
- WHEN `getToken()` is updated to `"new-token"` and another request is fired
- THEN the outgoing request MUST include `Authorization: Bearer new-token`
- AND it MUST NOT include `Authorization: Bearer old-token`

#### Scenario: Null token omits the header

- GIVEN `getToken()` returns `null`
- WHEN a request is intercepted
- THEN the interceptor MUST NOT call `config.headers.set` (or equivalent) with `Authorization`
- AND the request MUST proceed without an `Authorization` header

### Requirement: Interceptor Must Be a Request Interceptor (API-04)

The auth header MUST be attached via a request interceptor. A response-only interceptor MUST NOT satisfy this requirement.

#### Scenario: Header is added before the request leaves the client

- GIVEN the Axios instance
- WHEN its `interceptors.request.handlers` list is inspected
- THEN it MUST contain a fulfilled handler that reads `getToken()` and sets the `Authorization` header
- AND no `interceptors.response` handler MUST be responsible for attaching the outgoing `Authorization` header

### Requirement: Axios Import Isolation (API-05)

No file other than `vetary-web/src/shared/lib/apiClient.ts` MAY import `axios` directly. All HTTP traffic MUST go through the shared API client.

#### Scenario: Direct axios imports are absent

- GIVEN the `vetary-web/src` directory
- WHEN `grep -R "from 'axios'" vetary-web/src` (or equivalent search) is run
- THEN the only result MUST be in `vetary-web/src/shared/lib/apiClient.ts`

#### Scenario: Components and hooks use the singleton

- GIVEN a feature service or hook that needs to call the backend
- WHEN its imports are inspected
- THEN it MUST import `apiClient` from `"@/shared/lib/apiClient"`
- AND it MUST NOT import `axios` directly

### Requirement: Proving Interceptor Test (API-06)

There MUST be an automated test that proves the dynamic-read request interceptor behavior. The test MUST fail if the token is captured at module load or if the interceptor is moved to the response phase.

#### Scenario: Test passes with dynamic request interceptor

- GIVEN the test file for the API client
- WHEN `pnpm --filter vetary-web test` is run
- THEN the test MUST pass
- AND it MUST verify that changing `getToken()` between requests changes the `Authorization` header

#### Scenario: Test would fail if token were captured at import

- GIVEN a hypothetical implementation that reads `getToken()` once when `apiClient.ts` is evaluated and stores the value in a module-level constant
- WHEN the proving test is run against that implementation
- THEN the assertion that the header follows the latest token value MUST fail

#### Scenario: Test would fail if interceptor were moved to response

- GIVEN a hypothetical implementation that sets `Authorization` inside a response interceptor instead of a request interceptor
- WHEN the proving test inspects `interceptors.request.handlers`
- THEN the test MUST fail because the outgoing request never receives the header
