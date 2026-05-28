# Vetary — Decisiones de Arquitectura
**Versión:** 1.0  
**Fecha:** Mayo 2026

---

## Arquitectura elegida: Layered Architecture (Arquitectura en Capas)

### Por qué esta arquitectura y no otra

Se evaluaron tres opciones:

**Hexagonal (Ports & Adapters):** Excelente para sistemas donde los adaptadores externos cambian frecuentemente. Para este proyecto agrega complejidad sin beneficio real — los ports y adapters son overhead innecesario en una primera versión.

**Microservicios:** Resuelve problemas de escala y equipos grandes. Vetary v1 es un equipo de una persona. El costo de infraestructura y coordinación no justifica el beneficio.

**Layered Architecture (elegida):** Separación clara de responsabilidades, progresiva en complejidad, directamente mapeable a NestJS, y suficientemente estructurada para que los patrones de diseño aparezcan de forma natural. Si en el futuro se necesita escalar, la migración a hexagonal es más directa desde una arquitectura en capas bien hecha.

---

## Las 4 capas

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│   Controllers · Guards · Interceptors   │
│   (HTTP in, HTTP out — nada más)        │
├─────────────────────────────────────────┤
│         APPLICATION LAYER               │
│   Services · Use Cases · DTOs           │
│   (orquesta la lógica, no la contiene)  │
├─────────────────────────────────────────┤
│           DOMAIN LAYER                  │
│   Entities · Business Rules · Events    │
│   (el corazón — no conoce HTTP ni DB)   │
├─────────────────────────────────────────┤
│       INFRASTRUCTURE LAYER              │
│   Repositories · Prisma · External APIs │
│   (todo lo que toca el mundo exterior)  │
└─────────────────────────────────────────┘
```

### Regla de dependencia (inviolable)
Las capas solo pueden depender de las capas que están **debajo** de ellas. El dominio no conoce la infraestructura. La presentación no toca los repositorios directamente.

```
Presentation → Application → Domain
Infrastructure → Domain (implementa interfaces del dominio)
```

---

## Estrategia Multi-tenant

### Decisión: Shared Database, Shared Schema con tenant_id

Cada tabla de datos lleva `tenantId` como columna. Toda query se filtra por ese valor.

**Por qué no base de datos separada por tenant:** Complejidad operacional altísima. Gestionar N bases de datos en una aplicación educativa no tiene sentido.

**Por qué no schemas separados:** PostgreSQL lo soporta, pero agrega complejidad en las migraciones con Prisma. Para este proyecto no vale la pena.

**Por qué shared schema:** Más simple de implementar, más fácil de aprender, y suficiente para el nivel de escala de v1. Los grandes riesgos (leakage entre tenants) se mitigan en la capa de repositorio.

### Cómo fluye el tenant por la aplicación

```
Request HTTP
    ↓
TenantMiddleware (extrae tenantId del subdominio o JWT)
    ↓
TenantContext (disponible en toda la request via AsyncLocalStorage)
    ↓
BaseRepository (toda query incluye WHERE tenantId = :tenantId)
    ↓
Response
```

### Regla de oro del multi-tenant
**Ningún repositorio puede ejecutar una query sin el filtro de tenantId.** Esta regla se verifica en el BaseRepository y el agente debe señalarla cada vez que se implementa un nuevo repositorio.

---

## Patrones de diseño que aparecerán (y por qué)

Estos patrones no se implementan porque suenan bien. Aparecen porque el problema los pide.

### Repository Pattern
**El problema:** Si las queries de la base de datos están dispersas en los services, cambiar de Prisma a otro ORM significa tocar toda la aplicación. Y en multi-tenant, el filtro de tenantId tiene que garantizarse en un solo lugar, no en cada service.  
**La solución:** Un repositorio por entidad que encapsula todo el acceso a datos. El service llama al repositorio y no sabe nada de Prisma.  
**Dónde aparece:** En cada módulo desde la Fase 1.

### Factory Pattern
**El problema:** Crear una reserva no es siempre igual. Una consulta de rutina, una emergencia y una cirugía tienen validaciones y lógica distintas. El código que decide qué tipo crear no debería estar mezclado con el código que crea el objeto.  
**La solución:** Una BookingFactory que recibe el tipo de servicio y devuelve el objeto correcto ya inicializado.  
**Dónde aparece:** Fase 3, módulo de bookings.

### Observer Pattern (Domain Events)
**El problema:** Cuando una reserva cambia de estado (de Confirmada a En curso), varias cosas tienen que pasar: actualizar la ficha del paciente, notificar al vet, registrar el evento en el historial. Si el service de bookings llama a todo eso directamente, tiene demasiadas dependencias.  
**La solución:** El cambio de estado emite un evento de dominio. Otros módulos escuchan ese evento y reaccionan de forma independiente.  
**Dónde aparece:** Fase 3, cuando se implementa el flujo de estados.

### Strategy Pattern
**El problema:** Calcular la disponibilidad horaria de un veterinario puede tener reglas distintas según el tipo de servicio (una consulta dura 30 min, una cirugía 2 horas, un grooming 1 hora). Si esa lógica está en un solo if/else gigante, es imposible de mantener.  
**La solución:** Una interfaz AvailabilityStrategy con implementaciones por tipo de servicio.  
**Dónde aparece:** Fase 2, módulo de disponibilidad.

### Decorator Pattern
**El problema:** NestJS usa decoradores para auth, roles y tenant. Entender cómo funcionan es entender el patrón Decorator aplicado a metadatos.  
**La solución:** Decoradores custom: `@CurrentTenant()`, `@Roles()`, `@Public()`.  
**Dónde aparece:** Fase 1, en los guards de autenticación.

---

## Estructura del monorepo

Vetary es un **monorepo** — un solo repositorio Git que contiene el backend y el frontend. Esta decisión se tomó porque es un proyecto de un solo developer con un solo agente trabajando secuencialmente. Repos separados solo agregarían fricción sin beneficio real.

```
vetary/                      ← raíz del monorepo (un solo repo en GitHub)
├── vetary-api/              ← proyecto NestJS (backend)
├── vetary-web/              ← proyecto React (frontend)
├── docs/
│   └── WORKFLOW.md
├── SPEC.md                  ← documentos en raíz para que el agente los vea
├── ARCHITECTURE.md
├── AGENTS.md
└── README.md
```

**Regla de trabajo:** El agente se abre siempre desde la raíz `vetary/`. En cada sesión se le indica explícitamente en qué subcarpeta está trabajando. El backend se construye primero y de forma completa antes de tocar el frontend.

---

## Estructura de carpetas

### Backend (NestJS)
```
src/
├── common/                    # Código compartido entre módulos
│   ├── decorators/            # @CurrentTenant, @Roles, @Public
│   ├── filters/               # Manejo global de excepciones
│   ├── guards/                # AuthGuard, TenantGuard, RolesGuard
│   ├── interceptors/          # Logging, transform response
│   └── middleware/            # TenantMiddleware
│
├── modules/
│   ├── auth/                  # JWT, login, refresh, register
│   ├── tenants/               # CRUD de clínicas (solo super admin)
│   ├── users/                 # Gestión de usuarios por tenant
│   ├── veterinarians/         # Perfil y agenda del vet
│   ├── pets/                  # Ficha del paciente
│   ├── bookings/              # Sistema de reservas
│   ├── services-catalog/      # Tipos de servicios por tenant
│   ├── availability/          # Lógica de disponibilidad horaria
│   └── dashboard/             # Métricas y estadísticas
│
├── database/
│   └── prisma.service.ts
│
├── app.module.ts
└── main.ts

# Estructura interna de cada módulo:
modules/bookings/
├── dto/                       # Input validation (class-validator)
├── entities/                  # Clases de dominio
├── events/                    # Domain events
├── repositories/              # Acceso a datos (Prisma oculto aquí)
├── services/                  # Lógica de negocio
├── controllers/               # HTTP handlers
├── factories/                 # Creación de objetos complejos
└── bookings.module.ts
```

### Frontend (React)
```
src/
├── features/                  # Un directorio por feature
│   ├── auth/
│   │   ├── components/        # LoginForm, RegisterForm
│   │   ├── hooks/             # useLogin, useRegister
│   │   ├── services/          # Llamadas a la API
│   │   └── types.ts
│   ├── bookings/
│   ├── pets/
│   ├── veterinarians/
│   ├── dashboard/
│   └── admin/
│
├── shared/
│   ├── components/            # Button, Input, Modal, Table, etc.
│   ├── hooks/                 # useAuth, useTenant
│   ├── lib/                   # axios instance, queryClient
│   ├── types/                 # Tipos globales compartidos
│   └── utils/                 # Helpers, formatters
│
├── app/
│   ├── router.tsx             # React Router config
│   └── providers.tsx          # QueryClientProvider, AuthProvider, etc.
│
└── main.tsx
```

---

## Decisiones de TypeScript

- **Strict mode activado.** Sin excepciones.
- Prohibido `any`. Si no se sabe el tipo, se usa `unknown` y se narra.
- Todas las funciones tienen tipo de retorno explícito.
- Los DTOs del backend son la fuente de verdad de los tipos. El frontend los consume.
- Zod valida en el frontend lo que class-validator valida en el backend.

---

## Decisiones de base de datos (Prisma Schema)

Todo modelo incluye:
```prisma
model Booking {
  id        String   @id @default(cuid())
  tenantId  String   // 🔒 Multi-tenant: siempre presente
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  // ... resto de campos
}
```

Los IDs son CUID (no UUID ni autoincrement). Son seguros para URLs, legibles, y no exponen información de secuencia.

---

## Log de decisiones importantes

| Fecha | Decisión | Alternativa descartada | Razón |
|-------|----------|------------------------|-------|
| Mayo 2026 | Layered Architecture | Hexagonal, Microservicios | Complejidad adecuada al proyecto y al aprendizaje |
| Mayo 2026 | Shared schema multi-tenant | DB separada, schemas separados | Simplicidad operacional |
| Mayo 2026 | Prisma como ORM | TypeORM, Drizzle | Mejor DX con TypeScript, migraciones más claras |
| Mayo 2026 | CUID para IDs | UUID, autoincrement | Seguro para URLs, sin exposición de secuencia |
| Mayo 2026 | NestJS | Express puro, Fastify | Estructura modular fuerza buenas prácticas |
| Mayo 2026 | React + Vite | Next.js | SSR innecesario; la arquitectura del frontend debe ser clara |
