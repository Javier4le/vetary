# Frontend CI Specification

## Purpose

Define the continuous-integration additions that prevent a broken frontend from leaving CI green in PR-1.

## Requirements

### Requirement: Frontend Type-Check Job (CI-01)

CI MUST run `tsc --noEmit` for `vetary-web` in a dedicated `Vetary Web CI` job.

#### Scenario: Type errors fail the web CI job

- GIVEN a pull request that introduces a TypeScript type error in `vetary-web/src`
- WHEN the `Vetary Web CI` job runs `pnpm --filter vetary-web exec tsc --noEmit`
- THEN the job MUST fail
- AND the `Vetary API CI` job MUST remain independent and unaffected

#### Scenario: No PostgreSQL service is required for the web job

- GIVEN the `Vetary Web CI` job definition
- WHEN its `services` block is inspected
- THEN it MUST NOT declare a PostgreSQL service
- AND it MUST NOT run Prisma generate or migrate steps

### Requirement: Frontend Test Job (CI-02)

CI MUST run the `vetary-web` Vitest suite in the `Vetary Web CI` job.

#### Scenario: Failing frontend tests block merge

- GIVEN a pull request that causes the proving interceptor test (or any frontend test) to fail
- WHEN the `Vetary Web CI` job runs `pnpm --filter vetary-web test`
- THEN the job MUST fail
- AND the failure MUST be reported in the job logs

#### Scenario: Web job does not depend on API job

- GIVEN both `Vetary Web CI` and `Vetary API CI` jobs
- WHEN their dependency graph is inspected
- THEN the web job MUST be able to run in parallel with the API job
- AND a failure in one MUST NOT cancel the other unless the workflow explicitly chooses that behavior

### Requirement: Root Biome Coverage (CI-03)

Root `pnpm exec biome check .` already covers the whole monorepo, including `.tsx` files. CI MUST keep this step passing; no additional Biome step is required for the frontend.

#### Scenario: Biome check covers frontend files

- GIVEN the existing `Vetary API CI` job runs `pnpm exec biome check .`
- WHEN that step executes
- THEN it MUST lint and format-check `.ts` and `.tsx` files under `vetary-web/src`
- AND it MUST exit `0` when the frontend conforms to Biome rules

#### Scenario: Biome failures block CI

- GIVEN a frontend file violates a Biome rule (e.g., unused import, `console.log`)
- WHEN `pnpm exec biome check .` runs
- THEN the step MUST exit non-zero
- AND the violation MUST be reported for the offending `vetary-web` file
