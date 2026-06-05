# STACK-react.md — Traducción al stack React
> Cómo se aplican los principios de AGENTS.md en React + TypeScript.
> Reutilizable en cualquier proyecto React. Se lee en sesiones de frontend.
> **Vive en:** la raíz del subproyecto frontend (`vetary-web/`)

---

## Estructura macro: feature-based modules

Cada feature de negocio es un directorio autocontenido. Una feature nunca contamina otra. Lo que sirve a más de una feature va a `shared/`.

```
src/
├── features/
│   └── [feature]/
│       ├── components/    ← UI específica de la feature
│       ├── hooks/         ← orquestación de estado y lógica
│       ├── services/      ← llamadas HTTP, nada más
│       └── types.ts
├── shared/
│   ├── components/        ← Button, Input, Modal, Table...
│   ├── hooks/             ← lógica reutilizable transversal
│   ├── lib/               ← apiClient, queryClient
│   ├── types/             ← tipos globales
│   └── utils/             ← lógica pura compartida
└── app/
    ├── router.tsx
    └── providers.tsx
```

---

## Gestor de paquetes (regla del proyecto)

- Este proyecto usa **pnpm** como gestor de paquetes oficial.
- No usar `npm` ni `yarn` para instalar dependencias o correr scripts en este repo.
- Comandos esperados: `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm --filter vetary-web <script>`.
- Fuente de verdad: `package.json` de la raíz del monorepo con `packageManager: "pnpm@11.5.0"`.

---

## Calidad obligatoria antes de commit (frontend)

- Todo cambio debe pasar lint y type-check antes de commit.
- El objetivo no es “silenciar warnings”; es detectar bugs temprano y mantener consistencia de equipo.
- Comandos mínimos:
  - `pnpm --filter vetary-web lint`
  - `pnpm --filter vetary-web exec tsc --noEmit`

---

## Imports: preferir alias absoluto

- Preferir imports absolutos del proyecto (`@/...`) sobre rutas relativas profundas (`../../../...`).
- Motivo: mejora mantenibilidad y evita roturas al mover archivos.

---

## Separación de 3 capas dentro de cada feature (INVIOLABLE)

Dirección de dependencia estricta. Ninguna capa salta ni invierte la cadena:

```
components/   → llama a hooks, nunca a services directamente
    ↓
hooks/        → llama a services, nunca construye requests inline
    ↓
services/     → solo HTTP, no conoce hooks ni componentes
    ↓
shared/lib/apiClient   → instancia HTTP configurada, única fuente
```

El principio universal detrás: la UI no hace I/O directo, la config HTTP está centralizada, el estado de servidor está separado del de cliente. El mecanismo (hooks, services) es de React; el principio se mantiene en cualquier framework.

---

## Regla crítica: cliente HTTP configurado (bug real en producción)

**Nunca** importar axios directamente en hooks, componentes o services:

```typescript
// ❌ PROHIBIDO — sin baseURL, sin auth, sin interceptores
import axios from 'axios';

// ✅ SIEMPRE — el cliente configurado centralizado
import { apiClient } from '@/shared/lib/apiClient';
```

`apiClient` vive en `shared/lib/apiClient.ts` y es el único lugar donde se configuran `baseURL`, headers de auth e interceptores. Sin esto, las requests funcionan en desarrollo (Vite las proxea) pero fallan en producción.

### El interceptor va en request, y el token se lee dinámicamente

Dos bugs reales que esta regla previene: (1) un interceptor en `response` no agrega headers a las peticiones salientes; (2) un token capturado una sola vez al cargar el módulo queda congelado y no refleja un login posterior.

```typescript
// ✅ correcto — interceptor en request, token leído DENTRO en cada llamada
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token; // se lee en cada request, no al cargar
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## Estado: servidor vs cliente

- **TanStack Query** maneja todo el estado de servidor (data del backend), y vive en los **hooks**, no en componentes ni services
- **Zustand** maneja solo estado de UI puro (modales abiertos, filtros, sesión en memoria)
- Definir `staleTime` explícitamente en las queries — nunca dejar el default sin pensarlo

---

## Auth guard: verificar sesión una sola vez

No llamar a la API en cada navegación (genera una request por click). Verificar una vez al montar la app; el guard consulta el store en memoria.

```typescript
// main.tsx — una sola verificación al iniciar
await authStore.checkSession();

// router — el guard consulta el store, no la API
beforeEach((to) => {
  if (to.meta.requiresAuth && !authStore.isAuthenticated) return { name: 'login' };
});
```

---

## Flujos async secuenciales: mutateAsync + async/await

Cuando una operación encadena varias requests dependientes, usar `mutateAsync` con `async/await`. Nunca encadenar `useEffect` o callbacks de `onSuccess` — son frágiles y fallan en silencio.

```typescript
// ✅ flujo secuencial explícito, un solo punto de fallo
const submitBooking = async () => {
  try {
    const booking = await createBookingAsync(payload);
    await createNotificationAsync(booking.id);
    await updateAvailabilityAsync(booking.vetId);
  } catch (error) {
    // un solo lugar para manejar el error
  }
};
```

---

## Formularios: React Hook Form + Zod

- React Hook Form para el estado del formulario — no `useState` por cada campo
- Zod para el schema de validación, idealmente derivado de los tipos del backend (los DTOs de Swagger son la fuente de verdad)

---

## Lógica pura: shared/utils/

Cualquier cálculo o transformación que no sea HTTP ni estado va en `shared/utils/`, nunca dentro de un hook o componente. Si la misma lógica aparece en dos lugares, ya está en el lugar equivocado.

---

## Error boundaries

Error boundaries a nivel feature y uno global. Un error de render en una feature no debe tumbar toda la app.

---

## Accesibilidad (mínimo)

Navegación por teclado y contraste de color adecuado desde el inicio. No es un extra de v2.

---

## Componentes grandes

Un componente de 800+ líneas no es un problema de rendimiento, es de mantenibilidad. Cuando un componente crece, extraer subcomponentes y mover lógica a hooks.

---

## Naming en React

- Componentes: `PascalCase` (`BookingForm.tsx`)
- Hooks: `camelCase` con prefijo `use` (`useBooking.ts`)
- Carpetas: `kebab-case`
- Services: `[feature].service.ts` con funciones nombradas por acción (`fetchBookings`, `createBooking`)

---

## ✅ Checklist de cierre de feature (frontend React)

- [ ] La estructura sigue las 3 capas: services → hooks → components
- [ ] Ningún archivo importa `axios` directamente — siempre `apiClient`
- [ ] El interceptor de auth está en `request` y lee el token dinámicamente
- [ ] Los flujos de múltiples requests usan `mutateAsync` + `async/await`
- [ ] No hay lógica de negocio ni cálculos dentro de componentes
- [ ] `staleTime` definido explícitamente en las queries
- [ ] Los formularios usan React Hook Form + Zod
- [ ] Hay error boundaries (feature + global)
- [ ] Navegación por teclado y contraste verificados
- [ ] No hay `console.log` ni datos fake
- [ ] No hay `any` sin justificación comentada
- [ ] Los estados de carga y error tienen representación en la UI
