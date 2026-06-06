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
