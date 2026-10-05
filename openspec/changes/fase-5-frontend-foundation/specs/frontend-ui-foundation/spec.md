# Frontend UI Foundation Specification

## Purpose

Define the styling, component-library, and project-structure foundation for `vetary-web`, including Tailwind CSS, shadcn/ui defaults, the feature-based directory layout from `STACK-react.md`, and absolute `@/` imports.

## Requirements

### Requirement: Tailwind CSS Configuration (UIF-01)

Tailwind CSS MUST be configured in `vetary-web` so that utility classes compile correctly for all components.

#### Scenario: Tailwind directives are present

- GIVEN the file `vetary-web/src/index.css` (or equivalent entry CSS)
- WHEN its contents are inspected
- THEN it MUST import Tailwind CSS (`@import "tailwindcss"` for v4 or equivalent v3 directives)
- AND it MUST define the base theme variables required by shadcn/ui

#### Scenario: Build output contains Tailwind styles

- GIVEN a component that uses a Tailwind utility class such as `bg-primary`
- WHEN `pnpm --filter vetary-web build` is run
- THEN the produced bundle MUST contain the resolved CSS for that utility

### Requirement: Tailwind v4 and shadcn/ui Compatibility Gate (UIF-02)

Before the first shadcn/ui component is added, the team MUST verify that the installed shadcn CLI supports Tailwind CSS v4. If it does not, Tailwind CSS v3 MUST be pinned and the reason recorded.

#### Scenario: Compatibility check passes for Tailwind v4

- GIVEN `vetary-web` depends on Tailwind CSS v4
- WHEN `pnpm dlx shadcn@latest init` is run with default options
- THEN it MUST NOT create a `tailwind.config.js` or `tailwind.config.ts` file
- AND `pnpm dlx shadcn@latest add button` MUST compile without errors

#### Scenario: Compatibility check fails and falls back to v3

- GIVEN `pnpm dlx shadcn@latest init` creates a `tailwind.config.js`
- WHEN the incompatibility is detected
- THEN Tailwind CSS MUST be downgraded to the latest v3 release
- AND the reason MUST be recorded in `docs/decisions.md` under ADR-006 or a dedicated note
- AND no partial Tailwind v4 configuration files MUST remain in `vetary-web`

### Requirement: shadcn/ui Defaults (UIF-03)

shadcn/ui MUST be initialized with its default neutral base color. No brand palette or custom design tokens may be invented in PR-1.

#### Scenario: shadcn configuration uses neutral defaults

- GIVEN the file `vetary-web/components.json`
- WHEN its `tailwind.baseColor` and CSS variables are inspected
- THEN `baseColor` MUST be `"neutral"`
- AND no custom brand colors (e.g., arbitrary hex primary values not produced by the CLI) are present in the theme CSS

#### Scenario: Default component renders with neutral styling

- GIVEN a shadcn primitive rendered in the placeholder route
- WHEN it is displayed
- THEN it MUST use the default neutral color scale (no custom brand palette)

### Requirement: shadcn Primitive Path Resolution (UIF-04)

shadcn/ui primitives MUST resolve to `src/shared/components/ui/` via overridden `components.json` aliases.

#### Scenario: components.json aliases point to the shared layout

- GIVEN the file `vetary-web/components.json`
- WHEN its `aliases` object is inspected
- THEN `ui` MUST be `"@/shared/components/ui"`
- AND `components` MUST be `"@/shared/components"`
- AND `utils` MUST be `"@/shared/lib/utils"`
- AND `lib` MUST be `"@/shared/lib"`

#### Scenario: Adding a primitive lands in the shared directory

- GIVEN the aliases have been overridden
- WHEN `pnpm dlx shadcn@latest add button` is run
- THEN `vetary-web/src/shared/components/ui/button.tsx` MUST be created
- AND no `vetary-web/src/components/ui/button.tsx` file MUST be created

### Requirement: Feature-Based Project Structure (UIF-05)

`vetary-web/src` MUST follow the directory structure declared in `vetary-web/STACK-react.md`: `features/<feature>/{components,hooks,services,pages,types.ts}`, `shared/{components,lib,hooks}`, and `app/`.

#### Scenario: Required directories exist

- GIVEN the `vetary-web/src` directory
- WHEN its structure is inspected
- THEN it MUST contain at least `features/` (with a placeholder feature), `shared/components/`, `shared/lib/`, and `app/`
- AND it MUST NOT contain business logic inside presentational components

#### Scenario: Pages live inside features

- GIVEN the placeholder feature directory under `vetary-web/src/features/`
- WHEN its `pages/` subdirectory is inspected
- THEN it MUST contain the page component for the placeholder route

### Requirement: Absolute `@/` Imports (UIF-06)

Both TypeScript and Vite MUST resolve `@/` to `vetary-web/src/`, and the codebase MUST prefer absolute imports over deep relative imports.

#### Scenario: TypeScript path mapping is configured

- GIVEN the file `vetary-web/tsconfig.json`
- WHEN its `compilerOptions.paths` is inspected
- THEN `"@/*"` MUST map to `["./src/*"]`

#### Scenario: Vite alias resolves at runtime

- GIVEN the file `vetary-web/vite.config.ts`
- WHEN its `resolve.alias` is inspected
- THEN `"@"` MUST resolve to the absolute path of `vetary-web/src`

#### Scenario: Imports use the alias

- GIVEN any `vetary-web/src/**/*.ts` or `vetary-web/src/**/*.tsx` file
- WHEN its imports are inspected
- THEN cross-module imports SHOULD use `"@/..."` rather than relative paths crossing more than one directory level
