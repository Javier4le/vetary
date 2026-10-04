# Decisiones de Arquitectura (ADRs) y Excepciones

> Registro de decisiones tomadas durante la construcción y de excepciones documentadas a las reglas.
> Una regla rota a propósito y registrada aquí es una decisión de ingeniería. Rota en silencio es deuda técnica.

---

## Formato de cada entrada

```
## ADR-NNN — Título corto
**Fecha:** [fecha]
**Estado:** propuesta | aceptada | reemplazada por ADR-XXX
**Fase:** [en qué fase del proyecto se tomó]

### Contexto
Qué problema o situación llevó a esta decisión.

### Decisión
Qué se decidió hacer.

### Alternativas consideradas
Qué otras opciones había y por qué se descartaron.

### Consecuencias
Qué se gana, qué se sacrifica, qué deuda se asume.
```

---

## Excepciones a las reglas

Cuando se rompe una regla del AGENTS.md o de un STACK a propósito, se registra aquí con el mismo formato, explicando la consecuencia asumida. El agente advierte la consecuencia pero respeta el criterio fundamentado del desarrollador.

---

## Decisiones registradas

*(Las decisiones fundacionales del proyecto están en `ARCHITECTURE.md` → Log de decisiones. A partir de la Fase 1, las nuevas decisiones y excepciones se registran aquí.)*

## ADR-002 — Estrategia de ramas por fase (sin merge a main hasta v1.0)
**Fecha:** 2026-06-05
**Estado:** aceptada
**Fase:** Fase 1 (cierre)

### Contexto
El proyecto avanza por fases funcionales (Auth + Multi-tenancy, Bookings, etc.). Se necesita orden en el historial de Git para saber dónde termina una fase y empieza otra, sin mezclar trabajo incompleto en `main`.

### Decisión
- `main`: **sólo para la primera versión completa del producto** (v1.0). No recibe merges de fases intermedias.
- `develop`: rama de integración continua. Recibe los PRs de cada slice (PR3-A, PR3-B, etc.).
- Al cerrar una fase: se crea un **tag** en `develop` (ej. `fase-1-complete`), NO se mergea a `main`.
- La siguiente fase parte desde el tag de la anterior.

### Alternativas consideradas
- **Rama por fase (`feature/fase-1`, `feature/fase-2`):** descartada para el estado actual porque la Fase 1 ya está en `develop`. Moverla ahora sería rewrite de historia sin beneficio real.
- **Merge a `main` por fase:** descartada explícitamente por el desarrollador; `main` debe representar solo versiones estables de producto.

### Consecuencias
- Historial limpio: cada fase está demarcada por un tag.
- `main` permanece como línea de producción hasta v1.0.
- Se requiere disciplina de taggear al cerrar cada fase.

---

## ADR-001 — Tenant-scoped JWT sessions for multi-clinic users
**Fecha:** 2026-06-05
**Estado:** aceptada
**Fase:** Fase 1 (Auth + Multi-tenancy)

### Contexto
Un mismo usuario puede pertenecer a múltiples clínicas. Sin una definición explícita de sesión por tenant, existe riesgo de usar un token emitido en un contexto de clínica para acceder a otra clínica, especialmente en navegación por subdominios.

### Decisión
El JWT es **tenant-scoped**. El claim `tenantId` del token debe coincidir con el tenant resuelto para la request (subdomain context). Para acceder a otra clínica, el usuario debe autenticarse nuevamente en el contexto de ese tenant (subdominio + token emitido para ese tenant).

### Alternativas consideradas
- **Token global multi-tenant (sin tenant fijo):** descartado por aumentar complejidad en autorización por request y riesgo de cruces entre tenants.
- **Sesión server-side compartida entre tenants:** descartado por perder simplicidad stateless de JWT en v1.

### Consecuencias
- Mayor claridad y aislamiento: cada token representa una sola clínica.
- UX con re-autenticación al cambiar de clínica (trade-off aceptado).
- La validación tenant-context debe mantenerse en middleware/guards de forma consistente.

---

## ADR-003 — Functional work units and evidence-based estimates
**Fecha:** 2026-08-16
**Estado:** aceptada
**Fase:** Fase 2 (cierre)

### Contexto
Los presupuestos de PR-1 (~260 estimadas / 630 reales), PR-2 (~160 / 974) y PR-3 (~220 / 1.210) subestimaron sistemáticamente el trabajo porque contaban principalmente producción y no incluían tests, fixtures ni artefactos OpenSpec. La excepción repetida dejó de proteger el foco de revisión.

### Decisión
- Las fases grandes se dividen en unidades funcionales de hasta 400 líneas reales.
- Cada estimación incluye producción, tests, fixtures, configuración y documentación OpenSpec.
- Los barridos de formato o calidad son cambios independientes sobre `develop` y no consumen el presupuesto de una unidad funcional.
- Para disponibilidad, la unidad debe separar repository + unitarios, service + reglas de solapamiento, y controller + E2E.
- Fase 3 (reservas) debe planificarse con esta descomposición antes de implementar.

### Alternativas consideradas
- Mantener un presupuesto único por PR: descartado por las tres desviaciones consecutivas.
- Anular el presupuesto al final: descartado; elimina la función de control del ledger.

### Consecuencias
- Más commits y slices pequeños, con revisiones más enfocadas.
- Las estimaciones serán mayores, pero estarán basadas en el cambio completo que realmente se revisa.
- La normalización de calidad tendrá historial y presupuesto propios.

---

## ADR-004 — One product phase may contain multiple OpenSpec changes
**Date:** 2026-08-19
**Status:** accepted
**Phase:** Phase 3 (Bookings)

### Context
Phase 3 (Bookings) was split into two functional slices (internal booking first, then public
client booking). ADR-002 assumed one phase = one tag, but Phase 3 needs two independently
reviewable changes while remaining a single product phase.

### Decision
- One product phase MAY contain multiple OpenSpec changes; each change has independent
  artifacts, task numbering (starting at T-001), branches, and PRs.
- Phase 3 changes: `fase-3-reservas-internas` (PR-1 branch `feature/fase-3-internas-pr1-foundation`),
  followed by `fase-3-reservas-publicas` (PR-1 branch `feature/fase-3-publicas-pr1-foundation`).
- Every slice uses its own `feature/` branch and targets `develop`; no branch accumulates multiple
  slices before merge.
- The phase tag `fase-3-complete` is created on `develop` ONLY after both changes close. There
  are no `fase-3a-complete` / `fase-3b-complete` tags.
- `SPEC.md` and `README.md` keep the single phase name `fase-3` / "Bookings".

### Alternatives considered
- Renaming to `fase-3a` / `fase-3b`: rejected; keeps one product phase and avoids fragmenting
  tags/README.

### Consequences
- Two reviewable changes with bounded PRs (within the 400-line budget).
- Requires discipline: tag only after all changes in the phase close.

## ADR-005 — Frontend foundation pulled forward from Phase 5
**Date:** 2026-10-04
**Status:** accepted
**Phase:** Phase 5 (Frontend Foundation)

### Context
Vetary is currently a backend-only monorepo. Phases 1 and 2 are complete and verifiable through the API, but nothing built is visible to clients or for a portfolio. Phase 3 (Bookings) is paused at PR-3 (`feature/fase-3-internas-pr3-concurrency`) and Phase 5 (Dashboard and final UI) was originally scheduled after Phases 3 and 4.

### Decision
Bootstrap the frontend foundation now in a dedicated PR-1 (`feature/fase-5-frontend-pr1-bootstrap`) instead of waiting for Phase 5's natural place in the roadmap. Phase 3 stays paused and untouched; Phase 5 is split into multiple slices, starting with the toolchain scaffold, `apiClient`, router shell, and frontend CI.

### Alternatives considered
- **Wait for Phase 5 naturally:** rejected because Phase 3 is blocked-paused and waiting would stall any visible UI indefinitely.
- **Build the frontend in the Phase 3 gap without a dedicated slice:** rejected because it would mix unrelated scopes and complicate the paused Phase 3 branch history.

### Consequences
- Phase 5 now has multiple reviewable slices; the phase order in `SPEC.md` and `README.md` is updated to reflect that the frontend foundation is already in progress.
- The frontend can evolve in parallel with the paused backend work without touching `vetary-api/**` or the Phase 3 branch.
- PR-2 (login, protected routes, layout) depends on this PR-1 landing and on resolving the subdomain → tenantId gap separately.

---

## ADR-006 — Same-domain deployment topology for tenant resolution
**Date:** 2026-10-04
**Status:** accepted
**Phase:** Phase 5 (Frontend Foundation)

### Context
The backend resolves the tenant exclusively from the `Host` header (`TenantMiddleware`), with a `DEFAULT_TENANT_SUBDOMAIN` fallback when the hostname has ≤1 dot. `TenantGuard` compares the resolved tenant's `id` with the JWT `tenantId` claim. A cross-domain topology (e.g., SPA at `app.vetary.app` and API at `api.vetary.app`) would strip the tenant subdomain from `Host`; additionally, `api` is a reserved subdomain and cannot be a tenant. The API global prefix `/api/v1` is set in `vetary-api/src/main.ts:54` and must be preserved.

### Decision
Serve the SPA and the API on the same origin for every tenant subdomain. The reverse proxy must preserve the original `Host` header and must not strip `/api/v1`. In development, the Vite proxy forwards `/api` to `http://localhost:3000` with `changeOrigin: false` so the tenant subdomain in `Host` is preserved.

### Alternatives considered
- **Cross-domain API at `api.vetary.app`:** rejected because the tenant subdomain is lost from `Host`, `TenantMiddleware` cannot resolve the real tenant, and `TenantGuard` fails.
- **Strip `/api/v1` at the proxy:** rejected because the backend global prefix must remain intact.
- **Set `changeOrigin: true` in the Vite proxy:** rejected because it would replace `Host` with `localhost` and hide real subdomain resolution behind the fallback tenant.

### Consequences
- The SPA uses a same-origin relative baseURL `/api/v1` by default, with an optional `VITE_API_URL` override for non-proxied environments.
- Post-login requests work only when the SPA is served on the tenant's own subdomain (or `DEFAULT_TENANT_SUBDOMAIN` matches that tenant).
- Reverse-proxy and CDN configuration must preserve `Host` and the `/api/v1` prefix; this is documented as a hard deploy requirement.

---

<!-- Plantilla para copiar:

## ADR-001 — [Título]
**Fecha:**
**Estado:** aceptada
**Fase:**

### Contexto

### Decisión

### Alternativas consideradas

### Consecuencias

-->
