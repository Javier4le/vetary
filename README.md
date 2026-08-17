# Vetary

> Plataforma SaaS multi-tenant de gestión y reservas para clínicas veterinarias.

---

## ¿Qué es Vetary?

Vetary es una plataforma web que permite a cualquier clínica veterinaria registrarse y operar su propia instancia del sistema — con su subdominio, sus usuarios, sus datos y su configuración completamente aislados de otras clínicas.

Cada clínica obtiene dos mundos:

**Vista pública** — donde los dueños de mascotas descubren la clínica, se registran, agregan a sus mascotas y hacen sus reservas.

**Panel interno** — donde el equipo de la clínica (admin, staff y veterinarios) gestiona el día a día: calendario de citas, fichas clínicas, configuración de servicios y métricas del negocio.

---

## Propósito del proyecto

Vetary nació como proyecto de aprendizaje y construcción de producto, con tres objetivos concretos:

**Aprendizaje:** Construir aplicando arquitectura en capas (Layered Architecture), Repository, Template Method, Decorator y principios SOLID de forma consciente. `Strategy` existe en la infraestructura de autenticación (`JwtStrategy`); Factory, Observer y las estrategias de dominio de reservas están planificados para la Fase 3.

**Producto:** El sistema resuelve un problema real del mercado LATAM. Las clínicas veterinarias pequeñas y medianas no tienen acceso a sistemas de gestión modernos, accesibles y fáciles de implementar. Vetary apunta a ese nicho.

---

## Stack tecnológico

### Backend
- **NestJS** + TypeScript estricto
- **PostgreSQL** como base de datos
- **Prisma** como ORM
- **JWT** con refresh tokens para autenticación
- **Docker** para base de datos en desarrollo y stack completo en producción

### Frontend
- El frontend todavía no está implementado; `vetary-web/` contiene únicamente la especificación de stack `STACK-react.md`.
- Para la Fase 5 está planificado: React 18, TypeScript estricto, Vite, TanStack Query, Zustand, React Router, Tailwind CSS, shadcn/ui, React Hook Form y Zod.

---

## Arquitectura

Vetary implementa **Layered Architecture** con cuatro capas bien definidas:

```
Presentation  →  Controllers, Guards, Interceptors
Application   →  Services, Use Cases, DTOs
Domain        →  Entities, Business Rules, Domain Events
Infrastructure →  Repositories, Prisma, External APIs
```

La estrategia de multi-tenancy es **Shared Database, Shared Schema con `tenant_id`**. Cada registro de datos pertenece a un tenant específico y el sistema garantiza en la capa de repositorio que ninguna query se ejecute sin ese filtro.

Las decisiones arquitectónicas completas están documentadas en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Cómo se construye este proyecto

Vetary se desarrolla con un flujo de **Spec-Driven Development**: cada cambio sustancial pasa por exploración, propuesta, especificación, diseño y tareas antes de escribir código. Los artefactos de ese proceso están versionados en `openspec/` y se archivan al cerrar cada fase.

El código se valida mediante evidencia:

| Portón | Qué verifica | Dónde corre |
|---|---|---|
| Pre-commit | Biome y revisión automática contra las reglas del proyecto | Local |
| CI (GitHub Actions) | Biome, generación de Prisma, compilación, unitarios, migraciones, integración con PostgreSQL real y E2E | Servidor limpio |
| Receipt-driven review | Evidencia de comandos y estado nativo antes de cerrar una unidad de trabajo | Local, antes de entregar |

Las reglas de construcción están en [`AGENTS.md`](./AGENTS.md). Las decisiones arquitectónicas, con su contexto y alternativas, están en [`docs/decisions.md`](./docs/decisions.md). El estado verificado está en [`openspec/STATUS.md`](./openspec/STATUS.md).

Herramientas: [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai), OpenSpec para los artefactos de especificación y Engram para memoria entre sesiones.

---

## Roles del sistema

| Rol | Descripción |
|-----|-------------|
| **Super Admin** | Gestiona todos los tenants registrados en la plataforma |
| **Admin** | Dueño o gerente de la clínica. Configura el sistema y gestiona usuarios |
| **Staff** | Recepción. Gestiona reservas y check-in de pacientes |
| **Veterinario** | Ve su propia agenda y gestiona fichas clínicas |
| **Cliente** | Dueño de mascota. Reserva citas y ve el historial de sus mascotas |

---

## Estado del proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Auth + Multi-tenancy | ✅ Completa — tag `fase-1-complete` |
| 2 | Configuración de la clínica | ✅ Completa — tag `fase-2-complete` |
| 3 | Sistema de reservas | ➡️ Siguiente |
| 4 | Ficha clínica | ⬜ Pendiente |
| 5 | Dashboard + UI final | ⬜ Pendiente |
| 6 | Deploy | ⬜ Pendiente |

### Verificación actual del backend

- **Unitarios:** 14 suites / 111 tests pasando
- **Integración con PostgreSQL:** 4 suites / 27 tests pasando
- **E2E:** 3 suites / 15 tests pasando
- **TypeScript:** `tsc --noEmit` sin errores
- **Biome:** 0 errores y 0 warnings
- **Prisma:** 5.22.0, 2 migraciones aplicadas

La Fase 2 está cerrada. La Fase 3 (reservas) aún no ha comenzado.

---

## Cómo correr el proyecto

### Requisitos
- Node.js 22
- Docker y Docker Compose

### Desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/Javier4le/vetary.git
cd vetary

# Levantar la base de datos
docker compose up -d

# Instalar dependencias
pnpm install

# Variables de entorno
cp .env.example .env
# Completar las variables en .env

# Migraciones
pnpm --filter vetary-api prisma:migrate

# Correr el servidor
pnpm --filter vetary-api start:dev
```

> El frontend todavía no existe; `vetary-web/` permanece como carpeta planificada para la Fase 5.

---

## Futuro del proyecto (v2)

- **Pagos en línea** — integración con Transbank/WebPay para el mercado chileno y Stripe para LATAM
- **Exportación de documentos** — fichas clínicas en PDF, reportes de reservas en Excel
- **Notificaciones por email y WhatsApp** — recordatorios automáticos de citas
- **App móvil** — para que los clientes gestionen sus mascotas desde el celular
- **Módulo de inventario** — gestión de medicamentos e insumos de la clínica

---

## Autor

**Javier Rojas** — Desarrollador de Software
[LinkedIn](https://www.linkedin.com/in/javier4le) · [GitHub](https://www.github.com/Javier4le)
