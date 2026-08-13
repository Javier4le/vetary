# Vetary — Estado del Proyecto

> Actualizado: 2026-08-13
> Sesión actual: Fase 2 — Configuración de la clínica (PR-1 COMPLETADO)

---

## Fase 1 — Fundación ✅ COMPLETADA

- Tag: `fase-1-complete` en `develop`
- Última verificación unit/integration: `npx jest --no-coverage` — `Test Suites: 15 passed, 15 total`; `Tests: 118 passed, 118 total` (Jest emitió un warning de teardown de workers; exit status 0)
- E2E: `npx jest --config ./test/jest-e2e.json` — `Test Suites: 2 passed, 2 total`; `Tests: 8 passed, 8 total`
- Migraciones Prisma: `npx prisma migrate status` — `2 migrations found in prisma/migrations`; `Database schema is up to date!`
- Auth + Multi-tenancy funcionando
- BaseRepository con aislamiento de tenant activo

---

## Fase 2 — Configuración de la Clínica 🔄 EN PROGRESO

### SDD Completado
| Fase | Estado | Artifacts |
|------|--------|-----------|
| Explore | ✅ | Engram: `sdd/fase-2/explore` |
| Propose | ✅ | Engram + OpenSpec |
| Spec | ✅ | Engram + OpenSpec |
| Design | ✅ | Engram + OpenSpec |
| Tasks | ✅ | Engram + OpenSpec (actualizado con progreso) |

### Implementación (Chained PRs — feature-branch-chain)
| PR | Estado | Commits | Tests | Líneas |
|----|--------|---------|-------|--------|
| PR-1 | ✅ COMPLETADO | 3 commits | Histórico: Unit 12 suites / 98 tests; E2E: 2 suites / 8 tests | ~630 |
| PR-2 | 🔧 CORRECCIÓN EN PROGRESO | commits pendientes | Unit/integration: 15 suites / 118 tests; E2E: 2 suites / 8 tests | 974 líneas según ledger nativo |
| PR-3 | ⏳ PENDIENTE | — | — | ~220 estimado |

### PR-1 Detalles
**Branch:** `feature/fase-2-pr1-services` (desde `develop`)

**Commits:**
1. `0889067` — Schema Prisma: Service, VetProfile, VetAvailability, Tenant.timezone
2. `a97b76c` — Services module: controller, service, repository, DTOs
3. `2e59f4f` — Bugfix descripción null + 14 tests nuevos
4. `db0a96d` — Docs: actualización tasks.md con progreso

**Archivos creados/modificados:**
- `prisma/schema.prisma` — 4 modelos nuevos
- `src/modules/services/` — módulo completo
- `test/unit/services/` — 6 tests unitarios
- `test/integration/services/` — 6 tests de integración
- `src/app.module.ts` — ServicesModule registrado

**Tests medidos:** `npx jest --no-coverage`: 15 suites / 118 tests; E2E: 2 suites / 8 tests (`npx jest --config ./test/jest-e2e.json`); TypeScript sin errores (`npx tsc --noEmit`); migraciones Prisma al día: 2 migraciones encontradas (`npx prisma migrate status`). Verificación enfocada de users: integración real PostgreSQL 1 suite / 4 tests y controller unitario 1 suite / 4 tests. Jest emitió un warning de teardown de workers, con exit status 0.

---

### PR-2 Completado — Extender users/ + VetProfile
**Tareas:** T-006 a T-009
1. VetProfileRepository (extiende BaseRepository)
2. UserService.createVet() (transacción atómica: User + UserTenant + VetProfile)
3. UserController: POST /users/vets + POST /users/staff
4. Tests de integración real PostgreSQL y tests unitarios de controller

### PR-3 Pendiente — Availability + Overlap
**Tareas:** T-010 a T-014
1. AvailabilityRepository
2. AvailabilityService (overlap validation)
3. AvailabilityController
4. Tests + E2E

---

## Convenciones Establecidas

### Stack Backend (NestJS)
- **Linter/Formatter:** Biome (reemplazó ESLint + Prettier)
- **Tests:** Jest (unit + integration + E2E con Supertest)
- **TypeScript:** Strict mode, `noExplicitAny: error`
- **Import rule:** NUNCA `import type` en clases con decoradores NestJS
- **Monorepo:** pnpm con `packageManager` en package.json raíz
- **Money:** CLP como Int, nunca Float

### Stack Frontend (React)
- Pendiente implementar en Fase 5

---

## Siguiente Sesión

### Instrucciones para retomar
1. Checkout branch existente: `feature/fase-2-pr1-services`
2. Continuar desde T-006 (VetProfileRepository)
3. Ejecutar tests antes de empezar: `cd vetary-api && npx jest`
4. Verificar que todos pasen antes de modificar código

### Contexto disponible
- **Engram** (persistente): buscar `sdd/fase-2-configuracion-clinica/*`
- **OpenSpec** (archivos): `openspec/changes/fase-2-configuracion-clinica/`
- **Git**: branch `feature/fase-2-pr1-services` con PR-1 completo

---

## Reglas de Negocio Documentadas
- Disponibilidad: semanal recurrente, multi-bloque por día, un timezone por clínica
- Servicios: soft-disable (isActive), precio CLP Int, nombre único por tenant
- Creación de vets: atómica (User + UserTenant + VetProfile en transacción Prisma)
- Concurrency: single-admin por tenant en v1

---

## Artefactos SDD
| Tipo | Ubicación |
|------|-----------|
| Proposal | `openspec/changes/fase-2-configuracion-clinica/proposal.md` |
| Spec | `openspec/changes/fase-2-configuracion-clinica/spec.md` |
| Design | `openspec/changes/fase-2-configuracion-clinica/design.md` |
| Tasks | `openspec/changes/fase-2-configuracion-clinica/tasks.md` |
| Apply Progress | Engram: `sdd/fase-2-configuracion-clinica/apply-progress` |
| Product Decisions | Engram: `sdd/fase-2-configuracion-clinica/product-decisions` |
