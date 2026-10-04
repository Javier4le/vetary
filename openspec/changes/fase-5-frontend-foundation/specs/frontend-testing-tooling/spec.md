# Frontend Testing Tooling Specification

## Purpose

Define the test harness for `vetary-web`: Vitest with `jsdom`, React Testing Library, and the proving interceptor test that guards the dynamic auth-header pattern.

## Requirements

### Requirement: Vitest Configuration (TST-01)

`vetary-web` MUST run Vitest with a browser-like `jsdom` environment and global test APIs.

#### Scenario: Vitest uses jsdom and globals

- GIVEN the file `vetary-web/vitest.config.ts` (or an equivalent `test` block in `vite.config.ts`)
- WHEN its `test` options are inspected
- THEN `environment` MUST be `"jsdom"`
- AND `globals` MUST be `true`
- AND `setupFiles` MUST include at least one setup file (e.g., `src/test/setup.ts`)

#### Scenario: Tests run with the workspace alias

- GIVEN a test file imports a source module via `"@/shared/lib/apiClient"`
- WHEN `pnpm --filter vetary-web test` is run
- THEN the import MUST resolve to `vetary-web/src/shared/lib/apiClient.ts`
- AND the test MUST pass

### Requirement: React Testing Library Setup (TST-02)

React Testing Library and `jest-dom` matchers MUST be configured so component tests can assert on the DOM.

#### Scenario: jest-dom matchers are available

- GIVEN the file `vetary-web/src/test/setup.ts`
- WHEN its contents are inspected
- THEN it MUST import `"@testing-library/jest-dom"`

#### Scenario: A component test can query the DOM

- GIVEN a test that renders a React component
- WHEN the test uses `screen.getByText(...)` or `expect(element).toBeInTheDocument()`
- THEN the test MUST pass without import errors

### Requirement: Proving Interceptor Test (TST-03)

There MUST be a test that proves the API client request interceptor reads the token dynamically on every request. The test MUST fail if the interceptor is moved to the response phase or if the token value is captured at module load.

#### Scenario: Test exercises dynamic token read

- GIVEN the test file `vetary-web/src/shared/lib/apiClient.test.ts` (or equivalent)
- WHEN `pnpm --filter vetary-web test` is run
- THEN the test MUST call `createApiClient(getToken)` with a mutable `getToken`
- AND it MUST verify that a `null` token produces no `Authorization` header
- AND it MUST verify that setting the token to `"token-a"` produces `Authorization: Bearer token-a`
- AND it MUST verify that changing the token to `"token-b"` produces `Authorization: Bearer token-b`

#### Scenario: Test guards against response-interceptor implementation

- GIVEN a developer moves the auth-header logic from `interceptors.request` to `interceptors.response`
- WHEN the proving test is run
- THEN it MUST fail because the outgoing request never receives the `Authorization` header

#### Scenario: Test guards against static token capture

- GIVEN a developer captures `getToken()` once at module evaluation and stores it in a constant
- WHEN the proving test is run
- THEN it MUST fail because subsequent token changes are not reflected in the outgoing request
