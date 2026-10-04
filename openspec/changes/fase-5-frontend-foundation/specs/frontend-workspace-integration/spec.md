# Frontend Workspace Integration Specification

## Purpose

Define the integration of the `vetary-web` package into the existing pnpm monorepo, including the Vite + React + TypeScript scaffold, ESLint removal, Biome alignment, and lockfile consistency required for PR-1.

## Requirements

### Requirement: Vite React TypeScript Scaffold (WSI-01)

The `vetary-web` package MUST contain a Vite + React + TypeScript application scaffold that can be built, type-checked, and run in development.

#### Scenario: Package scripts support the development lifecycle

- GIVEN the file `vetary-web/package.json`
- WHEN its `scripts` field is inspected
- THEN it MUST contain `dev` running `vite`, `build` running `tsc -b && vite build`, `preview` running `vite preview`, `typecheck` running `tsc --noEmit`, `test` running `vitest run`, and `test:watch` running `vitest`
- AND it MUST contain `lint` running `biome check --write .` and `format` running `biome format --write .`

#### Scenario: TypeScript strictness is enforced

- GIVEN the file `vetary-web/tsconfig.json`
- WHEN its compiler options are inspected
- THEN `strict` MUST be `true`, `noImplicitAny` MUST be `true`, and `noUnusedLocals` MUST be `true`

### Requirement: pnpm Workspace Membership (WSI-02)

`vetary-web` MUST remain a member of the pnpm workspace so that root-level pnpm commands and the lockfile apply to it.

#### Scenario: Workspace file lists the frontend package

- GIVEN the file `pnpm-workspace.yaml`
- WHEN its `packages` list is inspected
- THEN it MUST include `"vetary-web"`

#### Scenario: Filtered commands reach the frontend package

- GIVEN `vetary-web` is listed in `pnpm-workspace.yaml`
- WHEN `pnpm --filter vetary-web exec tsc --noEmit` is run
- THEN the command MUST execute against `vetary-web`

### Requirement: ESLint Complete Removal (WSI-03)

ESLint MUST be fully removed from `vetary-web`; the repository uses Biome from the root for all linting and formatting.

#### Scenario: No ESLint artifacts remain

- GIVEN the `vetary-web` directory
- WHEN `find vetary-web -name 'eslint.config.*'` is run
- THEN it MUST return no results
- AND `vetary-web/package.json` MUST NOT list any of `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, or `globals` as dependencies or devDependencies
- AND `vetary-web/package.json` scripts MUST NOT contain an `eslint` script

#### Scenario: Biome covers the frontend code

- GIVEN ESLint artifacts have been removed
- WHEN `pnpm exec biome check .` is run from the repository root
- THEN it MUST exit with code `0` and report `0` errors and `0` warnings
- AND it MUST inspect at least one `.tsx` file under `vetary-web/src`

### Requirement: Biome Globals for Vitest (WSI-04)

Root `biome.json` MUST declare Vitest globals so that `vi.fn()` and `test()` are not treated as undeclared variables in frontend tests.

#### Scenario: Vitest globals are registered

- GIVEN the file `biome.json`
- WHEN `javascript.globals` is inspected
- THEN it MUST include `"vi"`
- AND it MUST include `"test"`
- AND the existing backend globals (e.g., `describe`, `expect`, `it`) MUST remain present

### Requirement: Lockfile Consistency (WSI-05)

`pnpm-lock.yaml` MUST be updated and committed alongside the scaffold so that `pnpm install --frozen-lockfile` succeeds in CI.

#### Scenario: Frozen lockfile installs successfully

- GIVEN the lockfile has been updated after all dependency changes
- WHEN `pnpm install --frozen-lockfile` is run in CI
- THEN it MUST exit with code `0`
- AND `pnpm --filter vetary-web exec tsc --noEmit` MUST still pass afterwards

#### Scenario: Native build dependencies are allowed

- GIVEN Vite depends on native tooling such as `esbuild`
- WHEN `pnpm install` runs
- THEN root `package.json` `pnpm.onlyBuiltDependencies` (or `allowBuilds`) MUST cover any new native package that pnpm requests to build
- AND the install MUST complete without an interactive approval prompt in CI
