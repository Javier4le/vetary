# Design: Phase 5 Frontend Foundation — PR-1 Bootstrap

> **Scope:** PR-1 (bootstrap) only. PR-2 (login, protected routes, layout) is out of
> scope. The backend and the paused Phase 3 branch are untouched.
>
> **Evidence basis:** every non-obvious decision below was **empirically verified in a
> sandbox scaffold** (`/tmp/opencode/vetary-web-probe`, 2026-10-04): the real
> `create-vite` template output, the real `shadcn@latest` CLI behavior against
> Tailwind v4 + React 19 + Vite 8, the proving interceptor test running green under
> Vitest 5 + jsdom, `tsc -b && vite build`, and the repo's own Biome 1.9.4 config.
> The final sandbox state was: **Biome 0 errors / 0 warnings, 4/4 tests passing,
> build passing.**

## Technical Approach

Scaffold `vetary-web` from the official Vite React-TS template, strip the
template's own linter (it ships **oxlint**, not ESLint — corrected below), wire
Tailwind CSS v4 + shadcn/ui (2026 CLI, **Base UI** primitives) into the
`shared/components/ui/` layout via `components.json` alias overrides, and hand-write
only the small reviewable core: `shared/lib/apiClient.ts` (factory + singleton,
dynamic-token request interceptor, same-origin `/api/v1` baseURL), its proving test,
and a minimal router shell with one placeholder feature. A second CI job
(`Vetary Web CI`) runs `tsc --noEmit` + Vitest. Docs (ADR-005, ADR-006, SPEC.md,
README.md) land first as a separate commit on the same branch.

This implements the proposal's PR-1 work-unit breakdown and satisfies all six specs:
`frontend-workspace-integration`, `frontend-ui-foundation`, `frontend-api-client`,
`frontend-testing-tooling`, `frontend-app-shell`, `frontend-ci`.

## Verified Evidence from the Sandbox Scaffold (2026-10-04)

| # | Verified fact | How |
|---|---------------|-----|
| E1 | `create-vite` react-ts template now scaffolds **React 19.2.8, TypeScript ~6.0.2, Vite 8.3, oxlint** (no ESLint), with a 3-way tsconfig split (`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`) | Scaffolded fresh template |
| E2 | Template ships **without** `"strict": true` in `tsconfig.app.json` — must be added (spec WSI-01) | Read generated tsconfig.app.json |
| E3 | `shadcn@latest` (v4.21.1) **validates Tailwind v4 natively** ("Found v4"), writes `components.json` with `"tailwind.config": ""` and creates **no** `tailwind.config.*` | `shadcn init -y -b base -p nova` |
| E4 | The 2026 CLI **requires the `@/*` tsconfig alias BEFORE `init`** (it validates instead of creating it) | `init` failed with "Could not find valid path aliases" until paths were added |
| E5 | The CLI reads **only the root `tsconfig.json`**: with paths only in `tsconfig.app.json` (behind `references`) it silently writes primitives into a **literal `@/` directory** (`./@/components/ui/button.tsx`) | `shadcn add button` created `@/components/ui/` at project root |
| E6 | Fix for E5: `compilerOptions.paths` in the **root `tsconfig.json`** makes `shadcn add button` resolve correctly | Re-ran `add button` → `src/components/ui/button.tsx` |
| E7 | Alias override to the shared layout works: after editing `components.json` aliases, `add button` → `src/shared/components/ui/button.tsx`, `add utils` → `src/shared/lib/utils.ts` | Re-ran CLI with overridden aliases |
| E8 | TypeScript 6.0 **deprecates `baseUrl`** — `tsc -b` fails with TS5101 if `baseUrl` is set; `paths` **without** `baseUrl` works for both `tsc` and the shadcn CLI | Build failed with TS5101, passed after removing `baseUrl` |
| E9 | The 2026 CLI installs `cn` (shadcn's own package) **instead of clsx + tailwind-merge**; `utils.ts` is `export { cn } from "cn"`; `button.tsx` imports `cn` directly, not `@/lib/utils` | Read generated files + installed deps |
| E10 | Default base color is **neutral**, CSS variables on — matches the fixed "shadcn defaults, no invented palette" decision | `components.json` output |
| E11 | The full proving-test approach (custom axios **adapter sink**, no `as any`) passes 4/4 under Vitest 5.0.3 + jsdom 30 with `globals: true` | `vitest run` |
| E12 | Repo Biome 1.9.4 config passes on the whole frontend (0/0) once: tabs + double quotes + semicolons formatting, `organizeImports` ordering (`@/` imports first), and no non-null assertions | `biome check` with `--config-path=biome.json` |
| E13 | Raw template `App.tsx`/`main.tsx` **fail** repo Biome (17 errors: formatting + `getElementById("root")!` non-null assertion) — boilerplate must be normalized or deleted in the scaffold commit | Biome on fresh template |
| E14 | `client.defaults.adapter = myAdapter` typechecks without `any`; `config.headers.set(...)` types cleanly in the interceptor | `tsc -b` green |
| E15 | `pnpm install` needed **no new `allowBuilds` entries** (Vite 8 ships prebuilt binaries; no postinstall prompts) | Clean install in sandbox |
| E16 | Node 22 runs the whole stack (local Node v22.22.3; CI pins node 22) — matches the existing workflow | All commands ran on Node 22 |

## Architecture Decisions

### D1: React 19 (adopt the template), SPEC.md corrected — not React 18

**Choice:** React `^19.2.8` + `react-dom ^19.2.8` (exactly what the template
scaffolds). `SPEC.md` line 107 ("React 18") and `README.md` line 42 are corrected to
React 19 **in the docs commit (Commit 1)**.

**Alternatives considered:** Pin React 18 by downgrading the template.

**Rationale:** The 2026 template scaffolds 19.2.8. Every planned dependency supports
19 — TanStack Query v5 (React 19-ready), React Router v7, shadcn/Base UI (generates
for 19 by default), RTL 16 (peers 18 \|\| 19). Pinning 18 would mean downgrading
`@types/react`, fighting the template and every generator for zero feature benefit.
The full stack was verified green on 19 in the sandbox (E11, E12, `tsc -b`, build).
`STACK-react.md` is deliberately version-agnostic (structure rules only), so nothing
in the frontend contract pins 18. The SPEC correction rides the Commit-1 docs edit
that already touches SPEC.md, so there is no extra churn.

### D2: TypeScript ~6.0.2 (template pin) — do not chase 7.x

**Choice:** `typescript ~6.0.2`, exactly the template's pin.

**Alternatives considered:** `typescript@7.0.2` (latest, the native port).

**Rationale:** The template is tested against ~6.0. TS 6 already deprecates
`baseUrl` (E8) and TS 7 removes it — adopting 7.x mid-scaffold adds migration risk
for zero bootstrap value. Follow the template; upgrade separately if ever needed.

### D3: Exact dependency set

**Choice:** (versions as resolved 2026-10-04; apply uses whatever the tooling
resolves at scaffold time — the majors are the contract)

| Dependency | Version | Type | Why |
|------------|---------|------|-----|
| `react`, `react-dom` | `^19.2.8` | deps | Template (D1) |
| `typescript` | `~6.0.2` | dev | Template (D2) |
| `vite` | `^8.3.0` | dev | Template; `@tailwindcss/vite` and Vitest 5 both peer-support Vite 8 |
| `@vitejs/plugin-react` | `^6.1.1` | dev | Template |
| `@types/react`, `@types/react-dom`, `@types/node` | template pins | dev | Template |
| `tailwindcss` | `^4.3.3` | deps (tool-owned placement) | Tailwind v4, CSS-first — **no postcss/autoprefixer needed** (only a v3 fallback would need them) |
| `@tailwindcss/vite` | `^4.3.3` | deps (tool-owned placement) | v4's Vite plugin (E3) |
| `@base-ui/react` | `^1.8.0` | deps | Installed by `shadcn init` — the CLI's default component library (successor by the Radix team) |
| `@fontsource-variable/geist`, `tw-animate-css` | CLI pins | deps | Installed by the default `nova` preset |
| `class-variance-authority` | `^0.7.1` | deps | Installed by shadcn (as fixed) |
| `cn` | `^0.4.0` | deps | **Installed by shadcn in place of clsx + tailwind-merge** (E9) — factual correction to the pre-2026 assumption, not a reopened decision |
| `lucide-react` | `^1.51.0` | deps | Installed by shadcn (as fixed; default icon library) |
| `shadcn` | `^4.21.1` | deps | The 2026 CLI installs itself; keep what the tool owns |
| `axios` | `^1.20.0` | deps | Runtime HTTP client for `apiClient` |
| `react-router-dom` | `^7.18.4` | deps | v7's `createBrowserRouter` is the same data-router API as v6.4+; v6 is legacy. SPEC.md line 111 ("React Router v6") corrected to v7 in Commit 1 |
| `vitest` | `^5.0.3` | dev | Test runner; peers Vite 8 (E11) |
| `jsdom` | `^30.1.2` | dev | Browser env for RTL (spec TST-01) |
| `@testing-library/react` | `^16.3.3` | dev | Component testing; peers React 19 |
| `@testing-library/jest-dom` | `^7.0.1` | dev | DOM matchers (spec TST-02) |

**Removed from the template:** `oxlint` (dev dep), `.oxlintrc.json`, `lint: oxlint`
script — replaced by root Biome (D5).

**Deliberately NOT installed:** `@testing-library/user-event` (no interaction test
in PR-1; add in PR-2), `clsx`/`tailwind-merge` (superseded by `cn`, E9),
`postcss`/`autoprefixer` (only a Tailwind v3 fallback needs them),
`globals`/`@eslint/js`/ESLint plugins (the template no longer ships ESLint at all).

**Alternatives considered:** pinning every exact version in the design.

**Rationale for floats:** the scaffold tooling owns generated dependency resolution;
the design contracts the **majors** (React 19, TS 6, Vite 8, Tailwind 4, Router 7,
Vitest 5, axios 1) and the frozen lockfile pins the rest. Fighting the tools'
resolution would only create drift.

### D4: Tailwind v4 verify gate — PASSED empirically; exact command sequence + fallback

**Choice:** Tailwind v4 is **confirmed** compatible (E3–E7, E10; sandbox build
green). The gate still runs at apply time (it takes ~2 minutes and produces the
committed primitives), in this exact order:

```bash
# 0. Preconditions already in place (from D6/D7):
#    - vite.config.ts has the @tailwindcss/vite plugin + @ alias
#    - root tsconfig.json has paths (WITHOUT baseUrl)
#    - src/index.css contains only: @import "tailwindcss";
# 1. Init with defaults (non-interactive: base component library + nova preset)
pnpm dlx shadcn@latest init -y -b base -p nova
# 2. GATE CHECK A — v4 means NO tailwind.config file, and tailwind.config is "" in components.json
test ! -f tailwind.config.js && test ! -f tailwind.config.ts
# 3. Override components.json aliases to the shared layout (D8)
# 4. GATE CHECK B — a sample primitive compiles and lands in shared/
pnpm dlx shadcn@latest add button -y
test -f src/shared/components/ui/button.tsx
pnpm dlx shadcn@latest add utils -y
pnpm --filter vetary-web exec tsc --noEmit && pnpm --filter vetary-web build
```

**Fallback if any check fails:** pin Tailwind to the latest v3 (add
`postcss`/`autoprefixer`, `tailwind.config.js`, content globs), re-run `shadcn init`
against v3, and **record the reason as a note under ADR-006 in the same commit** —
no partial v4 state remains (spec UIF-02 fallback scenario).

**Alternatives considered:** pinning v3 preemptively.

**Rationale:** v4 + shadcn was empirically proven (E3–E7); the gate exists because
the apply environment may resolve different CLI/registry versions than the sandbox.
The fallback is documented and cheap. Note the 2026 CLI needs **non-interactive
flags** (`-y -b base -p nova`) — plain `shadcn init` opens a TTY prompt menu
(component library + preset) that a piped stdin cannot answer (observed in the
sandbox: piped newlines stalled the preset prompt and the CLI exited without
generating).

### D5: Template linter removal — it is **oxlint**, not ESLint (reality correction)

**Choice:** Delete `.oxlintrc.json`, remove the `oxlint` dev dependency, replace the
`lint` script with `biome check --write .` and add `format: biome format --write .`
(mirroring `vetary-api/package.json` exactly). Then `pnpm exec biome check .` from
the root must pass 0/0 on the whole monorepo.

**Alternatives considered:** none — this is the fixed "root Biome owns lint/format"
decision; only the artifact names changed with the 2026 template (E1).

**Rationale:** The proposal/exploration assumed `eslint.config.js` + ESLint deps;
the current template ships oxlint instead (E1). ESLint artifacts will simply never
exist — spec WSI-03's "no ESLint artifacts" scenarios pass trivially; the real
removal target is oxlint. E13 shows the raw template also fails repo Biome, so the
scaffold commit must run `biome check --write .` (and hand-fix the non-null
assertion in `main.tsx` — see D12) before it can be green.

### D6: `vite.config.ts` — exact contract (single file: build + proxy + test)

**Choice:** one `vite.config.ts` (no separate `vitest.config.ts`), using
`vitest/config`'s `defineConfig` (superset of Vite's):

```ts
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": path.resolve(import.meta.dirname, "./src") },
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: false,
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
	},
});
```

**Alternatives considered:** separate `vitest.config.ts`; `changeOrigin: true`;
`__dirname`.

**Rationale:**
- Single file keeps one source of truth for the alias (spec UIF-06, TST-01 both
  need `@` to resolve); a second config would drift.
- `changeOrigin: false` **preserves the Host header** — this is the dev mirror of
  the production same-domain topology (spec APS-05): accessing
  `http://<sub>.localhost:5173` makes the backend's `TenantMiddleware` resolve the
  real subdomain instead of falling back to `DEFAULT_TENANT_SUBDOMAIN`.
- `import.meta.dirname` (not `__dirname`) — the package is `"type": "module"`;
  `import.meta.dirname` is typed via `tsconfig.node.json`'s node types and verified
  green (E11, E14).
- Verified working in the sandbox (Vitest 5 + Vite 8 + jsdom, 4/4 tests).

### D7: `tsconfig` — keep the 3-way split; `paths` in BOTH root and app config; NO `baseUrl`; ADD `strict`

**Choice:**

- `tsconfig.json` (root) — template output **plus** a `compilerOptions.paths` block:

```jsonc
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- `tsconfig.app.json` — template output **plus** `"strict": true` **plus**
  `"paths": { "@/*": ["./src/*"] }` (no `baseUrl` anywhere).
- `tsconfig.node.json` — template output, unchanged.

**Alternatives considered:** collapsing to a single tsconfig; putting paths only in
the app config; keeping `baseUrl`.

**Rationale:**
- **E5/E6 is the critical gotcha:** the 2026 shadcn CLI reads **only the root
  `tsconfig.json`** and does not follow `references` — with paths only in
  `tsconfig.app.json` it silently writes primitives into a **literal `@/`
  directory**. The root `paths` block exists *for the CLI* (tsc ignores it during
  `tsc -b`, since the root config has `files: []`). The app config's `paths` serves
  `tsc`/editors for `src/**`.
- **E8:** `baseUrl` is deprecated in TS 6 (build-breaking TS5101); `paths` without
  `baseUrl` resolves relative to the tsconfig and satisfies both tsc and the CLI.
- **E2:** the template no longer sets `strict` — spec WSI-01 requires it. Verified
  that adding `"strict": true` keeps the build and tests green (generated shadcn
  code is strict-clean).
- The split itself stays because `tsc -b` (the `build` script) is built around it
  and it cleanly separates app vs node config (vite.config.ts). Keeping the
  template's shape minimizes scaffold churn.

### D8: `components.json` — exact final content

**Choice:** what `shadcn init` writes, with the `aliases` object overridden (fixed
Option A), verified to route primitives into `shared/` (E7):

```json
{
	"$schema": "https://ui.shadcn.com/schema.json",
	"style": "base-nova",
	"rsc": false,
	"tsx": true,
	"tailwind": {
		"config": "",
		"css": "src/index.css",
		"baseColor": "neutral",
		"cssVariables": true,
		"prefix": ""
	},
	"iconLibrary": "lucide",
	"rtl": false,
	"aliases": {
		"components": "@/shared/components",
		"utils": "@/shared/lib/utils",
		"ui": "@/shared/components/ui",
		"lib": "@/shared/lib",
		"hooks": "@/shared/hooks"
	},
	"menuColor": "default",
	"menuAccent": "subtle",
	"registries": {}
}
```

**Alternatives considered:** `src/components/ui/` (CLI default), `src/shared/ui/`.

**Rationale:** fixed decision (Option A) + spec UIF-04. `"tailwind.config": ""`
and `baseColor: "neutral"` are the CLI's own v4 output (E3, E10) — defaults only, no
invented palette. Future `pnpm dlx shadcn@latest add <x>` lands primitives in
`src/shared/components/ui/` automatically (E7).

### D9: `biome.json` — add `test` + `vi` globals; nothing else

**Choice:** extend `javascript.globals` (alphabetical) to:

```json
"globals": [
	"afterAll",
	"afterEach",
	"beforeAll",
	"beforeEach",
	"description",
	"expect",
	"it",
	"jest",
	"test",
	"vi"
]
```

**Alternatives considered:** disabling `noUndeclaredVariables` for test files;
per-project biome config overrides.

**Rationale:** spec WSI-04 requires `vi` and `test` (Vitest globals with
`globals: true`); backend globals stay untouched. **No other frontend-specific
Biome adjustment is required** — verified empirically (E12): the whole frontend
(all hand-written files + generated `button.tsx`/`utils.ts`) passes the repo config
0/0 once formatted to repo style. The only frictions found were mechanical:
formatting (tabs/double quotes/semicolons — `biome check --write` handles),
`organizeImports` ordering (imports sort with `@/` aliases first — write them in
that order, or `--write --unsafe` fixes), and the template's non-null assertion
(hand-fixed in D12).

### D10: `shared/lib/apiClient.ts` — exact public shape (19 lines, hand-written)

**Choice:**

```ts
import axios, { type AxiosInstance } from "axios";

export function createApiClient(getToken: () => string | null): AxiosInstance {
	const client = axios.create({
		baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
	});

	client.interceptors.request.use((config) => {
		const token = getToken();
		if (token) {
			config.headers.set("Authorization", `Bearer ${token}`);
		}
		return config;
	});

	return client;
}

export const apiClient: AxiosInstance = createApiClient(() => null);
```

**Alternatives considered:** bare singleton reading a store (STACK-react literal
example); factory without singleton; env read per-request.

**Rationale:** Fixed decision (factory + singleton, relative baseURL, env read at
construction, token read inside the interceptor on each call). The factory is what
makes the proving test possible **without any auth store existing yet** (spec
API-01/API-03/API-04); PR-2 re-wires the singleton's argument to the real store in
one line. `import.meta.env.VITE_API_URL ?? "/api/v1"` gives the same-origin default
(spec API-02) with the override, read at construction. `config.headers.set(...)`
typechecks cleanly on the `AxiosHeaders` instance the interceptor receives (E14) —
no `any`, no non-null assertions. `VITE_API_URL` is typed via `src/vite-env.d.ts`
(D13).

### D11: The proving interceptor test — adapter-sink strategy, no `any`

**Choice:** `vetary-web/src/shared/lib/apiClient.test.ts`, exactly this shape
(verified green, E11):

```ts
import { createApiClient } from "@/shared/lib/apiClient";
import type { AxiosAdapter, AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

function createHeaderSinkAdapter(sink: { authorization: string | null }): AxiosAdapter {
	return async (config) => {
		const value = config.headers?.get("Authorization");
		sink.authorization = typeof value === "string" ? value : null;
		const response: AxiosResponse = {
			data: {},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
		return response;
	};
}

describe("createApiClient", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("reads the token dynamically on every request", async () => {
		let currentToken: string | null = null;
		const client = createApiClient(() => currentToken);
		const sink: { authorization: string | null } = { authorization: null };
		client.defaults.adapter = createHeaderSinkAdapter(sink);

		await client.get("/ping");
		expect(sink.authorization).toBeNull();

		currentToken = "token-a";
		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer token-a");

		currentToken = "token-b";
		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer token-b");
	});

	it("attaches the header in the request phase, before the adapter runs", async () => {
		const client = createApiClient(() => "request-phase-token");
		const sink: { authorization: string | null } = { authorization: null };
		client.defaults.adapter = createHeaderSinkAdapter(sink);

		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer request-phase-token");
	});

	it("defaults the baseURL to the same-origin /api/v1", () => {
		const client = createApiClient(() => null);
		expect(client.defaults.baseURL).toBe("/api/v1");
	});

	it("lets VITE_API_URL override the baseURL at construction time", () => {
		vi.stubEnv("VITE_API_URL", "https://staging.vetary.app/api/v1");
		const client = createApiClient(() => null);
		expect(client.defaults.baseURL).toBe("https://staging.vetary.app/api/v1");
	});
});
```

**Alternatives considered:** the exploration draft's
`client.interceptors.request.handlers[0].fulfilled({...} as any)` approach.

**Rationale (why this proves the two failure modes, spec API-06 / TST-03):**
- **A custom axios adapter is a real transport seam.** Axios dispatches request
  interceptors → adapter → response interceptors, in that order. The adapter
  observing the header proves it was attached **before the request left the
  client** (request phase). If the logic moved to a response interceptor, the
  adapter would observe `null` and both dynamic-token tests fail. (Test 2 pins this
  explicitly.)
- **The mutable closure token** (`currentToken` reassigned between `client.get`
  calls) proves the token is read **per call, inside the interceptor**. If
  `getToken()` were captured once at module load or client construction, test 1
  fails at `token-b` (frozen `token-a` ≠ expected `token-b`).
- The exploration's `handlers[0].fulfilled` draft was **rejected**: it pokes axios
  internals (fragile across axios versions), and requires `as any` twice — which
  violates `noExplicitAny: error` in the repo's Biome config. The adapter approach
  is fully typed (E14), uses public API (`client.defaults.adapter`), and
  additionally covers the baseURL default/override scenarios (API-02) via
  `vi.stubEnv`.
- Mocking approach named for the tasks phase: **real axios instance + custom
  transport adapter (no `vi.mock`, no axios-mock-adapter dependency)** — smallest
  possible mocking surface, no fragile module-registry mocking.

### D12: App shell skeleton — `app/router.tsx`, entry, one placeholder feature

**Choice:**

`src/app/router.tsx` (9 lines):

```tsx
import { HomePage } from "@/features/home/pages/HomePage";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <HomePage />,
	},
]);
```

`src/main.tsx` (16 lines — rewritten, avoids the template's non-null assertion that
trips Biome `noNonNullAssertion`):

```tsx
import { router } from "@/app/router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error('Root element "#root" not found');
}

createRoot(rootElement).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
```

`src/features/home/pages/HomePage.tsx` (7 lines — the placeholder route):

```tsx
export function HomePage() {
	return (
		<main className="flex min-h-svh items-center justify-center">
			<h1 className="text-2xl font-semibold">Vetary — frontend foundation</h1>
		</main>
	);
}
```

**How the placeholder proves routing without backend calls:** `HomePage` is pure
static JSX — no `apiClient` import, no effects, no fetch. Navigating to `/` renders
through `createBrowserRouter` → `RouterProvider` (spec APS-02), proving the router
wiring end-to-end with zero network activity. Every commit is verified with
`pnpm --filter vetary-web build` + `test`, which compile and render-mount the
shell without a dev server.

**Alternatives considered:** `app/providers.tsx` in PR-1; a top-level `src/pages/`.

**Rationale:** No providers exist yet (no TanStack Query, no auth store) —
`app/providers.tsx` is deferred to the first PR that needs one (PR-2+), matching
STACK-react.md's structure without creating dead files. Pages live inside
features (spec APS-02 scenario 2, UIF-05). The entry guard replaces the template's
`document.getElementById("root")!` (E13 — Biome warning; success criteria demand
0 warnings).

### D13: Feature folder skeleton — minimal, no empty files

**Choice:** PR-1 creates exactly:

```
src/
├── app/
│   └── router.tsx
├── features/
│   └── home/
│       └── pages/
│           └── HomePage.tsx
├── shared/
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx        (gate artifact, generated)
│   │       └── ...               (future shadcn primitives)
│   └── lib/
│       ├── apiClient.ts
│       ├── apiClient.test.ts
│       └── utils.ts             (generated: export { cn } from "cn")
├── test/
│   └── setup.ts
├── vite-env.d.ts
├── index.css                     (tool-owned after shadcn init)
└── main.tsx
```

Plus `vetary-web/.env.example`:

```
# API base URL override for the shared HTTP client (src/shared/lib/apiClient.ts).
# Default (unset): same-origin relative "/api/v1" — production serves the SPA and
# the API on the same origin (ADR-006). In dev, the Vite proxy forwards /api to
# http://localhost:3000 preserving the Host header (changeOrigin: false).
# Uncomment and set only for non-proxied/staging environments:
# VITE_API_URL=https://staging.vetary.app/api/v1
```

and `src/vite-env.d.ts` (types the env override for strict TS):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
```

**Deferred per-feature folders** (`features/home/{components,hooks,services}`,
`features/home/types.ts`, `shared/{hooks,types,utils}`, `app/providers.tsx`): each
is created **with the first code that needs it** (PR-2+), because empty
directories are not tracked by git and empty placeholder files are dead weight that
`noUnusedVariables`-style cleanliness exists to avoid. `STACK-react.md`'s layout is
a per-feature contract, not a pre-created scaffold.

**Alternatives considered:** pre-creating every folder with `.gitkeep` or empty
`types.ts` stubs.

**Rationale:** no Biome `noEmptyBlockStatements` issue exists for absent files
(that rule targets code blocks, not directories — E12 confirms nothing flags);
git would silently drop empty dirs anyway; stubs would be deleted by the next
real feature work. Minimal PR-1, maximal PR-2 readiness.

### D14: CI — second parallel job `Vetary Web CI`, no Postgres

**Choice:** append a second job to `.github/workflows/ci.yml` (alongside the
existing `quality` job named `Vetary API CI`):

```yaml
  web:
    name: Vetary Web CI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.5.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript
        run: pnpm --filter vetary-web exec tsc --noEmit

      - name: Unit tests
        run: pnpm --filter vetary-web test
```

**Alternatives considered:** appending steps to `Vetary API CI`.

**Rationale (spec CI-01/CI-02/CI-03):**
- **No PostgreSQL service / no Prisma steps** — the web job runs pure
  `tsc --noEmit` + Vitest under jsdom: no database, no migrations, no backend
  process. The API job's postgres service + Prisma generate/migrate + Jest
  integration/E2E are backend-only concerns.
- **Parallel, independent failure domains:** the job has no `needs:` on the API
  job (and vice versa) — a frontend type error fails `Vetary Web CI` without
  muddying `Vetary API CI` (spec CI-02 scenario 2), and one job failing does not
  cancel the other (default GitHub behavior).
- **No new Biome step:** the existing `pnpm exec biome check .` in `Vetary API CI`
  runs from the repo root and already covers `vetary-web/src/**` — root `biome.json`
  has no `include` restriction (verified E12 that it checks `.tsx`). Duplicating it
  in the web job would be redundant.
- Node 22 matches the API job and runs the verified stack (E16). Cost tradeoff
  accepted per the fixed recommendation: one extra `pnpm install` (~cached by
  setup-node's pnpm cache).
- Commands use `pnpm --filter vetary-web ...` from the root (no
  `working-directory:`) — matching the spec's exact wording and the repo's
  pnpm-filter convention; the `test` script is `vitest run` (WSI-01).

### D15: Commit / work-unit plan (docs-first ordering)

**Choice:** one branch `feature/fase-5-frontend-pr1-bootstrap` → one PR to
`develop`, four commits in this order:

| # | Commit (message shape) | Contents | Green-state proof at commit time |
|---|------------------------|----------|----------------------------------|
| 1 | `docs: record ADR-005 frontend pull-forward and ADR-006 same-domain topology` | `docs/decisions.md`: ADR-005 (inserted after ADR-004, English per ADR-004 precedent) + ADR-006 (same-domain topology: preserve Host, keep `/api/v1`, dev proxy `changeOrigin: false`); `SPEC.md`: Phase 5 bootstrap bullet + React 19 / Router v7 corrections (Spanish voice preserved — minimal additive edits); `README.md`: phase table (Phase 3 → "Pausada en PR-3", Phase 5 → "En progreso"), lines 41–42 + 155 frontend-exists corrections, line 42 stack list React 19 | docs-only; `pnpm exec biome check .` |
| 2 | `feat(web): scaffold Vite React app with Tailwind v4, shadcn and Biome alignment` | Template output **minus deleted boilerplate** (`App.tsx`, `App.css`, `assets/hero.png`, `assets/react.svg`, template `README.md`, `.oxlintrc.json` + oxlint dep); Tailwind v4 + `@tailwindcss/vite`; D4 gate sequence (shadcn init + alias override + `add button`/`add utils`); `vite.config.ts` (D6 complete, incl. proxy + test block); tsconfig edits (D7); `biome.json` globals (D9); `package.json` scripts/deps (D3); `src/index.css` (tool-owned); minimal shell (D12: `main.tsx`, `app/router.tsx`, `HomePage.tsx`, `test/setup.ts`); lockfile | `biome check .` 0/0; `tsc --noEmit`; `build`; dev server renders `/` |
| 3 | `feat(web): add apiClient with dynamic auth header and proving test` | `src/shared/lib/apiClient.ts` (D10); `src/shared/lib/apiClient.test.ts` (D11); `src/vite-env.d.ts`; `vetary-web/.env.example` | `pnpm --filter vetary-web test` → 4/4 (incl. proving test); biome; tsc |
| 4 | `ci: add Vetary Web CI job with tsc and vitest` | `.github/workflows/ci.yml` web job (D14) | workflow YAML valid; job green on the PR |

**Alternatives considered:** one giant scaffold commit; docs as a separate PR.

**Rationale:** Docs-first is a fixed rule (spec APS-03: ADRs + SPEC/README must
land before any app code — commit 1 on the same branch satisfies it while keeping
one PR/one branch per ADR-004). Boilerplate is deleted **in** the scaffold commit
rather than reformatted-then-deleted (E13 showed the raw template fails Biome, so
keeping it in commit 2 would mean formatting code that commit 3 immediately
removes — churn and a polluted diff). Commit 2 ends in a **building, linted,
rendering** app; commit 3 adds the reviewable core with its proof in the same unit
(work-unit-commits: tests ship with the behavior they verify). Commit 4 isolates
CI so a workflow failure reverts independently (proposal rollback plan). ESLint
scripts never exist (D5), so no separate cleanup commit is needed.

### D16: PR-2-blocking gap stays open (not designed here)

**Choice:** The subdomain → tenantId gap (spec OPEN-GAP-01) remains documented and
unresolved: PR-1 ships no login, no auth store, no resolution endpoint; PR-2
planning must pick option (a)/(b)/(c) before any login work.

**Rationale:** Explicit constraint — this design creates no resolution mechanism
and the proving test deliberately avoids any store.

## Data Flow

Dev topology (reproduces production same-domain behavior):

```
Browser  http://<sub>.localhost:5173
   │  fetch("/api/v1/...")            same-origin relative baseURL (apiClient)
   ▼
Vite dev server  ── proxy /api ──▶  http://localhost:3000
   (changeOrigin: false → Host: <sub>.localhost preserved)
                                      │
                                      ▼
                        NestJS  /api/v1/*  (prefix kept)
                        TenantMiddleware reads req.hostname
                        → tenant resolved → TenantGuard OK
```

Request-time token flow (the pattern the proving test guards):

```
component/hook/service call
   └── apiClient.get("/x")            singleton, baseURL "/api/v1"
         ├── request interceptor ──▶ getToken()      ← read HERE, per call
         │                                └── token? set "Authorization: Bearer <t>"
         ├── adapter (real transport; in tests: sink adapter)
         └── response interceptors (none in PR-1)
```

PR-2 wiring point (one line, no other changes):

```
export const apiClient = createApiClient(() => useAuthStore.getState().token);
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `vetary-web/` (scaffold) | Create | Vite React-TS template output minus boilerplate (D15 commit 2 list) |
| `vetary-web/package.json` | Create | Name `vetary-web`, scripts dev/build/preview/typecheck/test/test:watch/lint/format (WSI-01), deps per D3, no linter of its own |
| `vetary-web/vite.config.ts` | Create | D6 exact contract: react + tailwindcss plugins, `@` alias, `/api` proxy `changeOrigin: false`, Vitest jsdom/globals/setup |
| `vetary-web/tsconfig.json` | Create (template + edit) | Template output + root `compilerOptions.paths` for the shadcn CLI (D7) |
| `vetary-web/tsconfig.app.json` | Create (template + edit) | Template output + `strict: true` + `paths` (no `baseUrl`) |
| `vetary-web/tsconfig.node.json` | Create | Template output unchanged |
| `vetary-web/components.json` | Create | shadcn init output with shared-layout aliases (D8) |
| `vetary-web/src/index.css` | Create | `@import "tailwindcss"` + tool-generated shadcn theme (neutral, CSS vars) |
| `vetary-web/src/main.tsx` | Create (rewrite of template) | D12 entry with non-null-safe root guard |
| `vetary-web/src/app/router.tsx` | Create | D12 router, one placeholder route |
| `vetary-web/src/features/home/pages/HomePage.tsx` | Create | D12 placeholder page |
| `vetary-web/src/shared/lib/apiClient.ts` | Create | D10 factory + singleton |
| `vetary-web/src/shared/lib/apiClient.test.ts` | Create | D11 proving test (4 tests) |
| `vetary-web/src/shared/lib/utils.ts` | Create | Generated (`export { cn } from "cn"`) via `shadcn add utils` |
| `vetary-web/src/shared/components/ui/button.tsx` | Create | Generated gate artifact via `shadcn add button` |
| `vetary-web/src/test/setup.ts` | Create | `import "@testing-library/jest-dom";` |
| `vetary-web/src/vite-env.d.ts` | Create | `VITE_API_URL` typing (D13) |
| `vetary-web/.env.example` | Create | Documents the override + same-domain default (D13) |
| `vetary-web/.oxlintrc.json`, oxlint dep, `lint: oxlint` script | Delete/Replace | D5 — template linter removed; Biome owns lint |
| `vetary-web/eslint.config.js`, ESLint deps | N/A — never exist | 2026 template ships oxlint, not ESLint (E1) |
| `vetary-web/README.md` (template) | Delete | Boilerplate; repo README + STACK-react.md cover it |
| `vetary-web/src/App.tsx`, `App.css`, `assets/*` (template) | Delete | Replaced by the shell (D15) |
| `biome.json` | Modify | Add `test`, `vi` globals (D9) — only change |
| `.github/workflows/ci.yml` | Modify | Add `web` job `Vetary Web CI` (D14); API job untouched |
| `pnpm-lock.yaml` | Modify | Updated by `pnpm install`; committed with scaffold (WSI-05) |
| `docs/decisions.md` | Modify | ADR-005 (after ADR-004, before template comment) + ADR-006 |
| `SPEC.md` | Modify | Phase 5 bootstrap bullet + React 19 / Router v7 corrections (Spanish voice) |
| `README.md` | Modify | Phase status table + frontend-exists lines + stack list |
| `vetary-api/**`, Phase 3 branch | **Untouched** | Hard constraint |
| `pnpm-workspace.yaml` | Modify (only if prompted) | `allowBuilds` addition only if `pnpm install` requests one (E15: not needed in sandbox) |

## Interfaces / Contracts

Public module contract (the only new stable API surface in PR-1):

```ts
// vetary-web/src/shared/lib/apiClient.ts
export function createApiClient(getToken: () => string | null): AxiosInstance;
export const apiClient: AxiosInstance; // = createApiClient(() => null) in PR-1
```

Invariants (enforced by the proving test + Biome, referenced by STACK-react.md):
- `baseURL === "/api/v1"` unless `VITE_API_URL` is set (read at construction).
- Exactly one request interceptor; zero response interceptors in PR-1.
- The token is read via `getToken()` inside the interceptor on every request.
- No file under `src/` other than `apiClient.ts` imports `axios` (spec API-05;
  verified by grep in CI-adjacent checks and by convention in review).

Alias contract: `@/*` → `vetary-web/src/*` in root tsconfig (CLI), tsconfig.app
(tsc), vite.config (runtime + tests) — three places, one meaning.

Script contract (`vetary-web/package.json`): `dev: vite`, `build: tsc -b && vite
build`, `preview: vite preview`, `lint: biome check --write .`, `format: biome
format --write .`, `typecheck: tsc --noEmit`, `test: vitest run`, `test:watch:
vitest` — mirroring `vetary-api` script names exactly.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | apiClient: dynamic token read, request-phase attachment, null-token omission, baseURL default + override | `apiClient.test.ts` (D11) — custom axios adapter sink, real axios dispatch, `vi.stubEnv`; runs in `Vetary Web CI` |
| Unit (compile) | Whole app typechecks strict, incl. tests | `tsc --noEmit` (also part of `tsc -b` build) in CI |
| Integration (toolchain) | Tailwind v4 + shadcn gate; alias routing to `shared/`; build output contains resolved CSS | D4 command sequence + `pnpm --filter vetary-web build` |
| Static | No direct axios imports outside apiClient; no ESLint/oxlint artifacts; Biome 0/0 | `grep` checks + `pnpm exec biome check .` in CI (existing root step) |
| E2E | None in PR-1 — no user flows exist yet; PR-2+ adds RTL user flows and (later) Playwright | Deferred by design |

Runtime harness per commit (work-unit evidence): dev server render of `/` via the
placeholder route; no backend calls occur (spec APS-02).

## Threat Matrix

N/A — this change introduces no security-routing, shell-command, subprocess,
VCS/PR-automation, executable-file-classification, or process-integration
boundary. Per-row justification:

| Row | Applicability | Reason |
|-----|---------------|--------|
| Documentation-like paths | N/A | No executable docs/MDX/CMake-like files; docs changes are Markdown only (ADR/SPEC/README) |
| Git repository selection | N/A | No `git -C`, no alternate repo/cwd logic introduced; standard single-repo workflow |
| Commit state | N/A | No commit-automation code; apply commits via normal tooling |
| Push state | N/A | No push/refspec logic designed |
| PR commands | N/A | No PR-command composition in app code; the one PR follows the repo's normal flow |

(React Router here is client-side view routing — no request-routing or
authorization boundary changes; the API's TenantMiddleware/TenantGuard are
untouched.)

## Review Budget and Workload Forecast (for `sdd-tasks` — READ THIS SECTION FIRST)

The 400-line review budget (ADR-003/ADR-004, chained-pr) protects **hand-written
reviewable lines**. PR-1's raw diff is dominated by **generated/tool-owned lines
nobody reviews line by line**. Measured from the sandbox scaffold (final formatted
state):

**Hand-written reviewable (~300 lines — the part the 400 budget governs):**

| Item | Lines (measured) |
|------|------------------|
| `apiClient.ts` + `apiClient.test.ts` | 19 + 62 = 81 |
| Shell: `main.tsx`, `router.tsx`, `HomePage.tsx`, `setup.ts`, `vite-env.d.ts`, `.env.example` | 16 + 9 + 7 + 1 + 9 + ~6 = 48 |
| `vite.config.ts` (hand-written) | 24 |
| Hand edits: `package.json` scripts/deps, tsconfig paths+strict, `biome.json` globals, `components.json` alias override | ~35 |
| CI job (`ci.yml` web block) | ~28 |
| Docs: ADR-005 (~25), ADR-006 (~30), SPEC.md (~6), README.md (~16) | ~77 |
| **Total hand-written** | **~293 ≈ 300** |

**Generated / tool-owned, committed but not line-reviewed (~2,000–2,900):**

| Item | Lines |
|------|-------|
| Template files kept (tsconfig trio, index.html, .gitignore, public svgs) | ~150 |
| shadcn output (`components.json`, `utils.ts`, `button.tsx`, `index.css` theme) | ~215 |
| `pnpm-lock.yaml` (frozen-lockfile CI requires it; sandbox app lockfile alone is 4,590 lines; the monorepo delta shares existing tool deps) | ~1,600–2,500 |

**Raw PR total: ~2,200–3,200 changed lines.** The generated portion is **atomic**
— the template + toolchain + lockfile must land together or the app does not
install/build; no honest slicing pass can split it (chained-pr: "generated/vendor
diff cannot split cleanly" branch).

**Recommendations for the tasks phase (decide ONCE, before apply — never
mid-apply):**

1. **Review Workload Guard presentation** (delivery strategy `ask-on-risk` → ask
   the maintainer once): PR-1 as a **single PR with `size:exception` scoped to the
   generated/tool-owned lines** (scaffold + shadcn output + lockfile, ~2,000+),
   while the hand-written reviewable core stays **~300 ≤ 400**. Suggested framing
   for the maintainer: *"PR-1 raw diff ≈ 2.2–3.2k lines, of which only ~300 are
   hand-written reviewable (within the 400 budget); the rest is atomic generated
   scaffold + lockfile that cannot be split. Options: accept `size:exception` for
   the generated portion (recommended), or split Commit 1 (docs, ~77 lines) into
   its own PR (rejected: extra PR overhead, docs-first already satisfied
   in-branch)."* **Do NOT silently self-grant the exception** — the guard asks,
   the maintainer decides.
2. **`--max-changed-lines` for `sdd-attempt acquire`: `3200`.** Recorded reason:
   the raw total (incl. lockfile at the top of the estimate range) must fit the
   attempt ledger **once, up front** — the Phase 3 PR-2 lesson (acquire ~350 vs
   real 513 forced a mid-apply maintainer decision and a full reset) is exactly
   the failure mode a realistic ceiling prevents. The 400-line *review* budget is
   tracked separately on the hand-written portion and is not this number.
3. **Forecast fields for the tasks summary:** `Chained PRs recommended: No
   (single PR with size:exception for generated lines)`; `400-line budget risk:
   High (raw total) / Low (hand-written core)`; `Decision needed before apply:
   Yes — size:exception acceptance`.

## Migration / Rollout

No data migration, no feature flags. Rollout is the PR landing on `develop`
(additive only). Rollback = branch revert / PR revert; the API CI job is untouched
and stays green independently (proposal rollback plan). If the Tailwind v4 gate
fails at apply time, the scaffold commit pins v3 in the same commit and records
the reason under ADR-006 — no partial v4 state.

## Open Questions

None blocking. Two carried items (explicitly out of scope by constraint):

- [ ] **PR-2-blocking:** subdomain → tenantId resolution (spec OPEN-GAP-01) —
  resolved in PR-2 planning, not here.
- [ ] The 2026 shadcn CLI installs itself as a runtime dependency (`shadcn:
  ^4.21.1`) and the default `nova` preset brings the Geist variable font — both
  are tool-owned defaults kept as-is (no invented palette). If the maintainer
  prefers to strip the CLI dep or swap the preset, that is a small follow-up on
  `develop`, not a PR-1 blocker.
