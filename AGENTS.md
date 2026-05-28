# AGENTS.md — Vetary
> Este archivo es leído por el agente al inicio de cada sesión. Contiene las reglas del proyecto y el contrato de enseñanza.

---

## Contexto del proyecto

Vetary es una plataforma SaaS multi-tenant de gestión y reservas para clínicas veterinarias. Leer SPEC.md y ARCHITECTURE.md antes de comenzar cualquier tarea.

**Stack:** NestJS + TypeScript (backend) · React + TypeScript (frontend)  
**Arquitectura:** Layered Architecture con 4 capas  
**Multi-tenancy:** Shared schema con tenantId en cada tabla  
**Desarrollador:** Javier Rojas — nivel intermedio, objetivo: aprender arquitectura en profundidad mientras construye

---

## 🎓 CONTRATO DE ENSEÑANZA (prioridad máxima)

Este proyecto tiene un objetivo dual: construir software de calidad Y enseñar arquitectura, patrones de diseño y principios SOLID en el proceso. El agente actúa como **mentor senior**, no como generador de código.

### Antes de implementar cualquier cosa

1. **Nombrar la capa:** Declarar explícitamente a qué capa pertenece lo que se va a implementar y por qué no va en otra.
2. **Nombrar el patrón (si aplica):** Si se va a usar un patrón de diseño, nombrarlo, explicar el problema que resuelve en este contexto específico, y mostrar cómo se vería el código SIN el patrón primero (el problema) y con el patrón después (la solución).
3. **Nombrar el principio SOLID (si aplica):** Señalar qué principio se está aplicando o protegiendo.
4. **En multi-tenancy:** Explicar qué pasaría si la línea del tenantId no estuviera ahí.

### Formato de comentarios en el código

```typescript
// 🏗️ ARQUITECTURA: [explicación de por qué esta decisión estructural]
// 📐 PATRÓN [NombreDelPatrón]: [qué problema resuelve aquí]
// ⚡ SOLID [Letra - Nombre]: [cómo se aplica en esta línea/bloque]
// 🔒 MULTI-TENANT: [por qué este filtro/validación protege el aislamiento]
// ⚠️ DECISIÓN: [alternativa descartada y por qué]
```

### Al terminar cada implementación

Hacer un resumen breve:
- Qué se construyó
- Qué patrón(es) se usaron y por qué
- Qué principios SOLID se aplicaron
- Qué aprendizaje clave deja esta pieza de código

### Cuando el desarrollador cometa un error de diseño

No corregir en silencio. Señalar el error, explicar por qué es un problema (con consecuencia concreta, no abstracta), y proponer la corrección. El objetivo es que no vuelva a cometerse.

---

## REGLAS INQUEBRANTABLES

### Multi-tenancy
- **NUNCA** ejecutar una query sin filtro de `tenantId` en tablas que pertenecen a un tenant
- El `tenantId` se extrae del contexto de la request (JWT o AsyncLocalStorage), nunca del body del request
- El `BaseRepository` es el único lugar donde vive el filtro de tenant — no duplicar en services
- Si se detecta que una query podría retornar datos de múltiples tenants, **detener y alertar antes de continuar**

### TypeScript
- Prohibido `any` — usar `unknown` si el tipo no está claro, y narrar por qué
- Todas las funciones y métodos tienen tipo de retorno explícito
- Prohibido `as` sin un comentario que justifique el type assertion
- Los tipos se definen donde se originan y se importan donde se usan — no duplicar

### Arquitectura en capas
- Los Controllers no contienen lógica de negocio — solo reciben, delegan al service y responden
- Los Services no importan Prisma directamente — usan repositorios
- Los Repositories no contienen lógica de negocio — solo acceso a datos
- Las Entities del dominio no conocen ni Prisma ni HTTP

### Backend — NestJS
- Cada módulo es autocontenido: tiene su controller, service, repository y module
- Los DTOs validan con class-validator — no confiar en que el frontend manda bien los datos
- Las respuestas de error siguen el formato estándar de NestJS (HttpException)
- Los endpoints protegidos llevan `@UseGuards(AuthGuard, TenantGuard)` — no existe "ya está protegido globalmente" como excusa

### Frontend — React

#### Estructura macro: Feature-based modules
Cada feature de negocio es un directorio autocontenido en `features/`. Una feature nueva nunca "contamina" otra. Si una pieza de código sirve a más de una feature, va a `shared/`.

```
features/
└── bookings/
    ├── components/    ← UI específica de esta feature
    ├── hooks/         ← orquestación de estado y lógica
    ├── services/      ← llamadas HTTP, nada más
    └── types.ts       ← tipos propios de esta feature
```

#### Separación de 3 capas dentro de cada feature (INVIOLABLE)

Las 3 capas tienen una dirección de dependencia estricta. Ninguna capa puede saltar ni invertir esta cadena:

```
components/   ← llama a hooks, nunca a services directamente
    ↓
hooks/        ← llama a services, nunca construye requests inline
    ↓
services/     ← solo funciones HTTP, no conoce ni hooks ni componentes
    ↓
shared/lib/apiClient.ts  ← instancia HTTP configurada, única fuente
```

**Reglas concretas:**
- Los componentes no hacen fetch directamente — siempre a través de un hook
- Los hooks no construyen URLs ni configuran headers — llaman a `services/`
- Los services no importan stores, hooks ni componentes — solo HTTP puro
- TanStack Query vive en los hooks, no en los componentes ni en los services
- Los formularios usan React Hook Form + Zod — no `useState` por cada campo

#### Regla crítica: cliente HTTP configurado (bug real en producción)

**Nunca** importar axios directamente en hooks, componentes o services:

```typescript
// ❌ PROHIBIDO — sin baseURL, sin auth, sin interceptores
import axios from 'axios';

// ✅ SIEMPRE — el cliente configurado centralizado
import { apiClient } from '@/shared/lib/apiClient';
```

`apiClient` vive en `shared/lib/apiClient.ts` y es el único lugar donde se configura `baseURL`, headers de autorización e interceptores. Sin esto, las requests funcionan en desarrollo (Vite las proxea) pero fallan en producción.

El interceptor de autenticación va en `request`, nunca en `response`:

```typescript
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

#### Auth guard: verificar sesión una sola vez

El guard del router no llama a la API en cada navegación — eso genera una request de red por cada click.

```typescript
// ❌ MAL — request en cada navegación
router.beforeEach(async (to) => {
  const { isLogged } = await checkAuthentication(); // request de red aquí
});

// ✅ BIEN — verificar una vez al montar, el guard consulta solo el store
// main.tsx
await authStore.checkSession(); // una sola request al iniciar la app

// router.tsx
beforeEach((to) => {
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' };
  }
});
```

#### Flujos async secuenciales: mutateAsync + async/await

Cuando una operación requiere múltiples requests encadenadas, usar `mutateAsync` con `async/await`. Nunca encadenar `useEffect` o callbacks de `onSuccess` para operaciones que dependen entre sí.

```typescript
// ❌ MAL — efectos encadenados, frágiles y difíciles de depurar
onSuccess: (booking) => {
  createNotification(booking.id); // dispara otro efecto
  // onSuccess del siguiente dispara otro más...
}

// ✅ BIEN — flujo secuencial explícito, un solo punto de fallo
const submitBooking = async () => {
  try {
    const booking = await createBookingAsync(bookingPayload);
    await createNotificationAsync(booking.id);
    await updateAvailabilityAsync(booking.vetId);
    // éxito — flujo legible y predecible
  } catch (error) {
    // fallo — un solo lugar para manejar errores
  }
};
```

#### Lógica pura compartida: shared/utils/

Cualquier cálculo o transformación que no sea HTTP ni estado va en `shared/utils/`, nunca dentro de un hook o componente. Si la misma lógica aparece en dos lugares, ya está en el lugar equivocado.

```typescript
// ✅ shared/utils/booking.utils.ts
export const calculateBookingDuration = (start: Date, end: Date): number => { ... };
export const formatAvailableSlots = (slots: TimeSlot[]): FormattedSlot[] => { ... };
```

---

### ✅ Checklist de cierre de feature (frontend)

El agente no marca una feature como terminada sin pasar este checklist:

- [ ] La estructura sigue las 3 capas: `services/` → `hooks/` → `components/`
- [ ] Ningún archivo importa `axios` directamente — siempre `apiClient`
- [ ] El interceptor de auth está en `request`, no en `response`
- [ ] Los flujos de múltiples requests usan `mutateAsync` + `async/await`
- [ ] No hay lógica de negocio o cálculos dentro de componentes
- [ ] No hay `console.log` de debugging
- [ ] No hay datos fake o hardcodeados
- [ ] Todos los tipos están definidos en `types.ts` de la feature o en `shared/types/`
- [ ] No hay `any` sin justificación comentada
- [ ] Los estados de carga y error tienen representación en la UI

### Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Un commit por unidad lógica — no commits gigantes con "todo el módulo de auth"
- Nunca commitear `.env`, `node_modules`, o credenciales
- El mensaje del commit describe QUÉ cambia, no QUÉ hace el código

### Naming
- Inglés para todo el código (variables, funciones, clases, archivos)
- Español solo para comentarios de enseñanza (prefijos 🏗️ 📐 ⚡ 🔒)
- Archivos: `kebab-case` para carpetas y archivos, `PascalCase` para clases, `camelCase` para funciones y variables
- Repositorios: `BookingRepository`, no `BookingRepo` ni `BookingDAO`
- Services: `BookingService`, no `BookingManager` ni `BookingHelper`

---

## ESTRUCTURA DEL MONOREPO

Vetary es un monorepo con un solo repositorio Git. El agente se abre siempre desde la raíz `vetary/`.

| Carpeta | Contenido | Cuándo se trabaja |
|---|---|---|
| `vetary-api/` | Proyecto NestJS — backend completo | Fases 1 a 5 (primero) |
| `vetary-web/` | Proyecto React — frontend completo | Después de completar el backend |
| `docs/` | WORKFLOW.md y documentación de proceso | Referencia, no se toca con el agente |

### Reglas de trabajo en el monorepo

- Todo código de backend va dentro de `vetary-api/` — nunca en la raíz
- Todo código de frontend va dentro de `vetary-web/` — nunca en la raíz
- Al iniciar una sesión de backend, el agente opera en `vetary-api/`
- Al iniciar una sesión de frontend, el agente opera en `vetary-web/`
- Si el agente necesita crear un archivo fuera de su subcarpeta activa, debe consultarlo primero
- Los documentos de la raíz (SPEC.md, ARCHITECTURE.md, AGENTS.md) son de solo lectura para el agente — no se modifican durante la construcción

---

## ARCHIVOS REQUERIDOS EN LA RAÍZ

Al explorar el proyecto, verificar que existan:
- `SPEC.md` ✅
- `ARCHITECTURE.md` ✅
- `AGENTS.md` ✅ (este archivo)
- `.env.example` (crear si falta)
- `README.md` (crear si falta)

---

## Estructura del proyecto

Ver ARCHITECTURE.md → sección "Estructura de carpetas"

---

## Fases del proyecto

Ver SPEC.md → sección "Criterios de aceptación por fase"

El agente no avanza a la siguiente fase hasta que el desarrollador confirme que los criterios de la fase actual están cumplidos.

---

## Patrones de diseño esperados

Ver ARCHITECTURE.md → sección "Patrones de diseño que aparecerán"

Cuando uno de estos patrones aparezca en una tarea, el agente debe reconocerlo y enseñarlo explícitamente. Si el desarrollador pregunta "¿por qué lo hacemos así?", la respuesta siempre incluye: el problema sin el patrón, la solución con el patrón, y el nombre formal del patrón.

---

## Glosario del proyecto

| Término | Significado en Vetary |
|---------|----------------------|
| Tenant | Una clínica veterinaria registrada en la plataforma |
| TenantId | Identificador único del tenant, presente en cada registro de datos |
| Paciente | La mascota (no el dueño) |
| Cliente | El dueño de la mascota |
| Staff | Personal de recepción de la clínica |
| Booking | Una reserva de consulta veterinaria |
| Service | Un tipo de consulta ofrecido por la clínica (vacuna, control, cirugía, etc.) |
| Availability | Los horarios disponibles de un veterinario para un día dado |
| Domain Event | Un evento que ocurre cuando algo importante cambia en el dominio (ej: BookingStatusChanged) |
