# Exploration: Phase 5 Frontend Foundation (PR-1 Bootstrap)

## Problem Framing

Vetary is a backend-only monorepo. Nothing built is visible. The developer needs something showable for potential clients and job applications. Phase 5 ("Dashboard y UI final") was pulled forward to bootstrap the frontend. Phase 3 (internal bookings) is paused at PR-3 and must not be touched.

PR-1 scope: Vite + React + TS + Tailwind + shadcn/ui scaffold, `apiClient` with request interceptor, Vitest + RTL with one proving test, Biome integration (no ESLint). PR-2 (login, protected routes, layout) is explicitly out of scope but PR-1 must leave hooks ready.

---

## 1. Workspace Integration

### Verified Facts
- `pnpm-workspace.yaml` (line 2): already lists `vetary-web`
- Root `package.json`: `packageManager: pnpm@11.5.0`, root devDependency `@biomejs/biome: 1.9.4`
- `vetary-api/package.json` scripts use `pnpm --filter` pattern: `lint` = `biome check --write .`, `format` = `biome format --write .`
- `vetary-api/package.json` name: `vetary-api`

### What `vetary-web/package.json` Needs
- **name**: `vetary-web` (matches workspace directory, consistent with backend naming)
- **scripts**:
  - `dev`: `vite` (default port 5173)
  - `build`: `tsc -b && vite build`
  - `preview`: `vite preview`
  - `lint`: `biome check --write .` (mirrors backend pattern exactly)
  - `format`: `biome format --write .` (mirrors backend)
  - `typecheck`: `tsc --noEmit` (STACK-react.md line 48 expects `pnpm --filter vetary-web exec tsc --noEmit`)
  - `test`: `vitest run`
  - `test:watch`: `vitest`
- No `eslint` script. No ESLint deps.
- Must add `pnpm.onlyBuiltDependencies` if Vite/esbuild needs native builds (check after scaffolding).

### Lockfile Consistency
Running `pnpm install` from root after creating `vetary-web/package.json` will update `pnpm-lock.yaml`. The frozen-lockfile CI step will fail until the lockfile is committed alongside the scaffold.

### Risk
None identified. Workspace is pre-configured.

---

## 2. ESLint Removal

### What the Vite React-TS Template Generates (Vite 6.x, 2026)
When running `pnpm create vite vetary-web --template react-ts`, the scaffold creates:

**Files to delete:**
- `vetary-web/eslint.config.js` (flat config, ESLint 9.x style)

**Dependencies to remove from devDependencies:**
- `@eslint/js`
- `eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `typescript-eslint`
- `globals`

**Scripts to remove from package.json:**
- `"lint": "eslint ."` -- will be replaced with Biome version

### Clean Removal Strategy
1. Scaffold with Vite template
2. Delete `eslint.config.js`
3. Remove ESLint deps: `pnpm remove -D eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh typescript-eslint globals`
4. Replace `lint` script with Biome version
5. Verify: `pnpm exec biome check .` from root passes on the scaffold

### Risk
Low. Vite template is mechanical. ESLint removal is straightforward.

---

## 3. Biome Interaction with the Frontend

### Will Root Biome Cover `vetary-web/` `.ts/.tsx` Files?
**Yes.** Root `biome.json` (lines 2-13) has no `include` directive -- it covers the entire workspace. The `ignore` list excludes `**/dist/**`, `**/node_modules/**`, `**/coverage/**`, `**/src/generated/**`, and tooling dirs. Frontend `.ts`/`.tsx` files will be linted.

### Rule Conflicts to Expect

| Rule | Setting | Frontend Impact |
|------|---------|-----------------|
| `noConsole` | `error` | Dev-only `console.log` in components will fail. Good -- STACK-react.md checklist (line 200) forbids `console.log`. |
| `noExplicitAny` | `error` | Strict. Forces proper typing everywhere. Good for quality. |
| `useImportType` | `off` | No conflict. Import type enforcement is disabled. |
| `noUnusedImports` / `noUnusedVariables` | `error` | Standard. Will catch dead code in scaffold. |
| `useConst` | `error` | Standard. |
| `noNonNullAssertion` | `warn` | OK for React refs and optional chaining. |

### React-Specific Globals Needed
Current `biome.json` `javascript.globals` (lines 59-68) lists: `afterAll`, `afterEach`, `beforeAll`, `beforeEach`, `describe`, `expect`, `it`, `jest`.

**Missing for frontend (Vitest):**
- `vi` -- Vitest's mock/spy global (equivalent to `jest` fn)
- `test` -- Vitest's test function (alias of `it`)

**Recommendation:** Add `vi` and `test` to the globals list. The existing `jest` global can stay (backend uses it). Both test frameworks share `describe`, `expect`, `it`, `beforeEach`, etc.

### Tailwind CSS Files
Biome does NOT lint CSS. Tailwind directives in `.css` files are safe. Biome's `organizeImports` only affects `.ts`/`.tsx`/`.js`/`.jsx`.

### Risk
Low. Add `vi` and `test` to globals. Everything else works out of the box.

---

## 4. Tailwind + shadcn/ui

### Tailwind Version (2026)
**Tailwind CSS v4** (released Jan 2025) is the current major. Key differences from v3:
- CSS-first configuration (no `tailwind.config.js` -- uses `@theme` in CSS)
- Automatic content detection (no `content` array in config)
- `@import "tailwindcss"` instead of `@tailwind` directives

**However**, shadcn/ui compatibility with Tailwind v4 depends on the shadcn CLI version. As of mid-2026, `shadcn@latest` (v3+) supports Tailwind v4 natively. The older `shadcn-ui@0.x` required Tailwind v3.

**Recommendation:** Use Tailwind v4 with `shadcn@latest`. If the CLI generates `tailwind.config.js`, fall back to Tailwind v3 (v4 does not use that file).

### What `shadcn init` Produces
Running `pnpm dlx shadcn@latest init` with defaults creates:

**Files:**
- `src/components/ui/` -- directory for shadcn primitives (button, input, etc.)
- `src/lib/utils.ts` -- the `cn()` utility (clsx + tailwind-merge)
- `components.json` -- shadcn configuration (aliases, style, rsc flag)
- Updates `tsconfig.json` paths (adds `@/` alias pointing to `src/`)
- Updates `vite.config.ts` (adds `resolve.alias` for `@/`)

**components.json defaults:**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Conflict with `features/` + `shared/` Layout
STACK-react.md defines:
```
src/features/[feature]/components/
src/shared/components/
src/shared/lib/
src/app/
```

shadcn defaults to `src/components/ui/` which is **outside** both `features/` and `shared/`.

### Options for shadcn Component Placement

| Option | Path | Pros | Cons |
|--------|------|------|------|
| **A: shared/components/ui** | `src/shared/components/ui/` | Follows STACK structure. Primitives are shared by definition. | Must update `components.json` aliases (`ui: "@/shared/components/ui"`, `components: "@/shared/components"`, `utils: "@/shared/lib/utils"`, `lib: "@/shared/lib"`) |
| **B: Top-level components/ui** | `src/components/ui/` | shadcn default. Zero config. `pnpm dlx shadcn add button` just works. | Violates STACK layout. Creates a third top-level directory alongside `features/` and `shared/`. |
| **C: shared/ui** | `src/shared/ui/` | Flat, matches "shared" semantics. | Non-standard for shadcn. Must override all aliases. |

**Recommendation: Option A.** Place shadcn primitives in `src/shared/components/ui/` and update `components.json` aliases accordingly:
- `components`: `@/shared/components`
- `ui`: `@/shared/components/ui`
- `utils`: `@/shared/lib/utils`
- `lib`: `@/shared/lib`
- `hooks`: `@/shared/hooks`

This keeps the feature structure intact and `pnpm dlx shadcn add <component>` will install to the right place after `components.json` is configured.

### shadcn Default Brand Palette
The developer explicitly said: **do NOT invent a brand palette**. Use shadcn defaults (neutral base color, CSS variables). The developer will decide colors separately.

### Risk
Medium. Tailwind v4 + shadcn compatibility should be verified at scaffold time. If the shadcn CLI does not support v4 yet, fall back to Tailwind v3.

---

## 5. Vitest + RTL under Vite

### Minimal Configuration

**Dependencies to install:**
- `vitest` -- test runner
- `@testing-library/react` -- React component testing
- `@testing-library/jest-dom` -- DOM matchers (`.toBeInTheDocument()`, etc.)
- `@testing-library/user-event` -- user interaction simulation
- `jsdom` -- browser environment simulation (preferred over happy-dom for RTL compatibility)
- `axios` -- HTTP client (needed for apiClient; not yet a dependency)

**vitest.config.ts** (or extend `vite.config.ts` with `test` block):
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,         // enables describe/it/expect/vi without imports
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

**src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom';
```

### Test That Proves the Interceptor Attaches the Header

The test must prove the **dynamic-read pattern** -- the token is read inside the interceptor function on each call, not captured at module load.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from '@/shared/lib/apiClient';

describe('apiClient request interceptor', () => {
  it('attaches Authorization header by reading token dynamically on each request', async () => {
    // Arrange: create a mutable token source (simulates a store)
    let currentToken: string | null = null;
    const getToken = () => currentToken;

    const client = createApiClient(getToken);

    // Act 1: no token -- no Authorization header
    currentToken = null;
    const setMock1 = vi.fn();
    await client.interceptors.request.handlers[0].fulfilled({
      headers: { set: setMock1, get: vi.fn(() => undefined) },
      url: '/test',
    } as any);
    expect(setMock1).not.toHaveBeenCalledWith('Authorization', expect.anything());

    // Act 2: set a token -- Authorization header appears
    currentToken = 'test-token-abc';
    const setMock2 = vi.fn();
    await client.interceptors.request.handlers[0].fulfilled({
      headers: { set: setMock2, get: vi.fn(() => undefined) },
      url: '/test',
    } as any);
    expect(setMock2).toHaveBeenCalledWith('Authorization', 'Bearer test-token-abc');

    // Act 3: change the token -- next request uses the NEW token
    currentToken = 'new-token-xyz';
    const setMock3 = vi.fn();
    await client.interceptors.request.handlers[0].fulfilled({
      headers: { set: setMock3, get: vi.fn(() => undefined) },
      url: '/test',
    } as any);
    expect(setMock3).toHaveBeenCalledWith('Authorization', 'Bearer new-token-xyz');
  });
});
```

**Key insight:** The factory function `createApiClient(getToken)` accepts a token-reading function. The interceptor calls `getToken()` on every request. This proves the dynamic-read pattern without building an auth store.

### Packages Needed for axios
- `axios` (runtime dependency, not devDep -- it is the HTTP client used in production)
- Version: `^1.7.0` or latest stable. Axios 1.x is mature and well-tested.

### Risk
Low. Vitest + Vite integration is native. jsdom is the standard for RTL.

---

## 6. apiClient Design Grounded in STACK-react.md

### Module Public Shape
STACK-react.md (lines 77-101) specifies:
- Single `apiClient` instance in `shared/lib/apiClient.ts`
- `baseURL` from environment variable (`VITE_API_URL`)
- Request interceptor that reads token dynamically (inside the function, not at module load)
- Never import axios directly elsewhere

### Factory vs Singleton

**Option A: Singleton (STACK-react.md literal reading)**
```typescript
// shared/lib/apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token; // dynamic read
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Option B: Factory (testable without a real store)**
```typescript
// shared/lib/apiClient.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

export function createApiClient(getToken: () => string | null): AxiosInstance {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return client;
}

// Production instance -- wired to a token source
// PR-1: returns null (no auth yet). PR-2: wired to useAuthStore.
export const apiClient = createApiClient(() => null);
```

**Recommendation: Option B (Factory).** Reasons:
1. The proving test can pass a mock `getToken` without touching an auth store that does not exist yet in PR-1.
2. The production export `apiClient` is still a singleton -- STACK-react.md is satisfied.
3. PR-2 can wire the real auth store by changing one line:
   ```typescript
   export const apiClient = createApiClient(() => useAuthStore.getState().token);
   ```

### Token Source for PR-1 (No Auth Store Yet)
For PR-1, the `getToken` function returns `null` (no auth). The test proves the pattern works by passing a mock function. The real store is wired in PR-2.

### Environment Variable
- `VITE_API_URL` -- Vite exposes `VITE_*` vars to client code via `import.meta.env`
- Default value for local dev: `http://localhost:3000/api/v1` (backend runs on port 3000 with global prefix `api/v1` per `main.ts` line 54)
- Needs a `.env.example` in `vetary-web/` with `VITE_API_URL=http://localhost:3000/api/v1`

### Risk
Low. Factory pattern is clean and testable.

---

## 7. Backend API Surface (for PR-2 Readiness)

### Verified Endpoints from Source Code

All endpoints are prefixed with `/api/v1` (set in `main.ts` line 54).

**Auth** (`vetary-api/src/modules/auth/controllers/auth.controller.ts`):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/logout` | JWT | Revoke refresh token |
| POST | `/api/v1/auth/refresh` | Public | Get new token pair from refresh token |
| GET | `/api/v1/auth/me` | JWT | Get current authenticated user |

**Users** (`vetary-api/src/modules/users/controllers/user.controller.ts`):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/users` | JWT | List all users in current clinic |
| POST | `/api/v1/users` | JWT + ADMIN | Create a new user |
| POST | `/api/v1/users/vets` | JWT + ADMIN | Create a vet (User + VetProfile) |
| POST | `/api/v1/users/staff` | JWT + ADMIN | Create a staff member |
| GET | `/api/v1/users/me` | JWT | Get current user info |

**Services** (`vetary-api/src/modules/services/controllers/service.controller.ts`):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/services` | JWT | List all services in current clinic |
| POST | `/api/v1/services` | JWT + ADMIN | Create a new service |
| GET | `/api/v1/services/:id` | JWT | Get service by ID |
| PATCH | `/api/v1/services/:id` | JWT + ADMIN | Update a service |
| DELETE | `/api/v1/services/:id` | JWT + ADMIN | Soft disable a service |

**Availability** (`vetary-api/src/modules/availability/controllers/availability.controller.ts`):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/availability/vets/:vetId/slots` | JWT | List availability slots for a vet |
| POST | `/api/v1/availability/vets/:vetId/slots` | JWT + ADMIN | Create weekly availability slot |
| DELETE | `/api/v1/availability/slots/:slotId` | JWT + ADMIN | Delete availability slot |

**Tenants** (`vetary-api/src/modules/tenants/controllers/tenant.controller.ts`):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/tenants/register` | Public | Register a new clinic (tenant) |

**Bookings**: Module exists at `vetary-api/src/modules/bookings/` but contains only `services/` (the `booking-time.ts` helper). No controller yet -- Phase 3 is paused at PR-3.

### PR-2 Will Hit These Real Endpoints
- `POST /auth/login` -- login
- `GET /auth/me` -- verify session
- `POST /auth/refresh` -- token refresh
- `POST /auth/logout` -- logout
- `GET /users/me` -- user profile

### CORS Configuration
Backend `ALLOWED_ORIGINS` env var (CI: `http://localhost:3001`). Frontend dev server will run on port 5173 (Vite default). **The backend `.env` must include `http://localhost:5173` in `ALLOWED_ORIGINS` for dev, OR the Vite dev server must proxy API requests.**

Two approaches:
1. **Vite proxy** (recommended for dev): `server.proxy` in `vite.config.ts` forwards `/api` to `http://localhost:3000`. No CORS issue.
2. **Add origin to backend**: Add `http://localhost:5173` to `ALLOWED_ORIGINS` in backend `.env`.

The proxy approach is cleaner because it avoids modifying backend config for dev.

---

## 8. Docs to Update

### SPEC.md -- Phase Order Misrepresentation

**Lines 172-175 (Fase 5):**
```
### Fase 5 -- Dashboard y UI final
- El admin ve metricas basicas en tiempo real
- El diseno es responsive y pulido en todas las vistas
- El super admin puede gestionar tenants
```

This describes the FINAL frontend phase, not the foundation bootstrap. The exploration is pulling Phase 5 forward. The spec should reflect that Phase 5 now has an early bootstrap slice.

**Recommendation:** Add a note under Phase 5 acknowledging the early bootstrap:
```
### Fase 5 -- Frontend Foundation + Dashboard y UI final
- **Bootstrap (PR-1):** Vite + React + TS + Tailwind + shadcn/ui scaffold, apiClient, Vitest
- El admin ve metricas basicas en tiempo real
- El diseno es responsive y pulido en todas las vistas
- El super admin puede gestionar tenants
```

### README.md -- Phase Status Table

**Lines 97-104:**
```
| 3 | Sistema de reservas | -> Siguiente |
...
| 5 | Dashboard + UI final | Pendiente |
```

Phase 3 is paused (not "Siguiente"). Phase 5 is being worked on (not "Pendiente"). Update:
```
| 3 | Sistema de reservas | Pausada en PR-3 |
...
| 5 | Frontend Foundation + Dashboard | En progreso |
```

**Lines 41-42:**
```
- El frontend todavia no esta implementado; `vetary-web/` contiene unicamente la especificacion de stack `STACK-react.md`.
```

After PR-1, this is no longer true. Update after the scaffold lands.

**Line 155:**
```
> El frontend todavia no existe; `vetary-web/` permanece como carpeta planificada para la Fase 5.
```

Same -- update after scaffold.

### ADR-005 -- Insertion Point

`docs/decisions.md` currently has ADR-001 through ADR-004. ADR-005 should be inserted:
- **After ADR-004** (line 143), before the template comment (line 145)
- **Number:** ADR-005
- **Title:** "Frontend foundation pulled forward from Phase 5"
- **Format:** Follow the existing ADR template (lines 10-27)

**Content should cover:**
- Context: Phase 5 was "Dashboard y UI final" but nothing is visible. Developer needs showable work.
- Decision: Bootstrap frontend (PR-1) in Phase 5 early. Phase 3 stays paused at PR-3.
- Alternatives: Wait for Phase 5 naturally (rejected -- developer needs visibility now), Build frontend in Phase 3 gap (rejected -- Phase 3 has its own scope).
- Consequences: Phase 5 now has multiple slices (foundation + dashboard). Phase ordering in SPEC.md updated.

---

## 9. Open Risks / Open Questions

### Tailwind v4 + shadcn/ui Compatibility
**Risk: Medium.** Tailwind v4 (CSS-first config) changed the setup significantly. shadcn/ui's CLI (`shadcn@latest`) claims v4 support, but the exact behavior should be verified at scaffold time. If the CLI generates `tailwind.config.js` (v3 pattern), it means v4 is not supported yet -- fall back to Tailwind v3.

**Mitigation:** Test `pnpm dlx shadcn@latest init` with Tailwind v4 before committing to it. If it fails, use Tailwind v3.9.x.

### Vite Dev Server Port vs Backend CORS
**Risk: Low-Medium.** Backend `ALLOWED_ORIGINS` is set to `http://localhost:3001` in CI. Vite defaults to port 5173. Two options:
1. Vite proxy (recommended): `server.proxy` forwards `/api` to `http://localhost:3000`. Transparent, no CORS config needed.
2. Add `http://localhost:5173` to backend `.env` `ALLOWED_ORIGINS`.

**Recommendation:** Use Vite proxy for dev. Document it in `vetary-web/.env.example`.

### Biome Globals for Vitest
**Risk: Low.** Need to add `vi` and `test` to `biome.json` `javascript.globals`. This is a one-line change. Without it, `vi.fn()` and `test()` calls in frontend tests will trigger `noUndeclaredVariables: error`.

### `pnpm.onlyBuiltDependencies` for Vite/esbuild
**Risk: Low.** Vite depends on esbuild which has native binaries. pnpm may prompt for `onlyBuiltDependencies` approval. Check if `esbuild` or `@esbuild/*` needs to be added to the allow list in root `package.json`.

### No Frontend CI Job
**Risk: Medium (for later).** Current `.github/workflows/ci.yml` only runs backend CI. PR-1 does not need a CI job (the scaffold has no business logic), but PR-2+ will need one. Flag this for the proposal.

### `@/` Alias Wiring
**Risk: Low.** Both `tsconfig.json` paths and `vite.config.ts` `resolve.alias` must point `@/` to `src/`. The shadcn CLI does this automatically, but verify both are configured. Vitest also needs the alias (via `vite.config.ts` or `vitest.config.ts`).

### React 18 vs React 19
**Risk: Low.** SPEC.md (line 107) says "React 18". The Vite template in 2026 may scaffold React 19 by default. Check at scaffold time. If React 19 is scaffolded, either update SPEC.md or pin React 18 in `package.json`. React 19 is stable and backward-compatible, so upgrading SPEC.md is the simpler path.

---

## Recommended Approach for PR-1

### Step-by-Step Scaffold Order
1. Scaffold Vite React-TS app in `vetary-web/` (preserve existing `STACK-react.md`)
2. Remove ESLint (files, deps, script)
3. Install Biome-compatible lint script
4. Initialize Tailwind (v4 if shadcn supports it, v3 otherwise)
5. Initialize shadcn/ui with defaults, then update `components.json` aliases to `shared/` layout
6. Install Vitest + RTL + jsdom
7. Create `apiClient` factory + singleton export
8. Write the proving test for the interceptor
9. Create placeholder route and `app/router.tsx`
10. Add `.env.example` with `VITE_API_URL`
11. Verify: `pnpm exec biome check .` from root passes
12. Verify: `pnpm --filter vetary-web exec tsc --noEmit` passes
13. Verify: `pnpm --filter vetary-web test` passes
14. Update `pnpm-lock.yaml`

### What PR-1 Must Leave Ready for PR-2
- `apiClient` with factory pattern (PR-2 changes one line to wire auth store)
- `VITE_API_URL` env var configured
- Vite proxy configured for `/api` -> backend
- Router placeholder ready for login/protected routes
- shadcn/ui components available for layout building
- Biome, TypeScript, Vitest all passing

### Non-Goals for PR-1
- No login page or auth flow
- No protected routes
- No layout (sidebar, header)
- No real API calls (apiClient exists but no services use it)
- No brand colors or custom design tokens
- No CI job for frontend

---

## Ready for Proposal
**Yes.** All investigation questions are answered with concrete evidence. The proposal can proceed with the scaffold order, open risks documented, and PR-2 readiness hooks identified. The developer should decide:
1. Whether to try Tailwind v4 first (recommended) or pin v3 for safety
2. Whether to use Vite proxy (recommended) or add frontend origin to backend CORS