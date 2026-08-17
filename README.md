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

Vetary nació como proyecto de portfolio y aprendizaje, con tres objetivos concretos:

**Aprendizaje:** Construir aplicando arquitectura en capas (Layered Architecture), patrones de diseño GoF (Repository, Factory, Observer, Strategy, Decorator) y principios SOLID de forma consciente — entendiendo por qué se usa cada herramienta, no solo cómo.

**Portfolio:** Demostrar capacidad para diseñar y construir un producto SaaS real, con decisiones arquitectónicas documentadas y justificadas. El proyecto está pensado para ser mostrado tanto en entrevistas técnicas como a clientes potenciales en plataformas freelance.

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
- **React 18** + TypeScript estricto + Vite
- **TanStack Query v5** para estado de servidor
- **Zustand** para estado de UI
- **React Router v6**
- **Tailwind CSS** + **shadcn/ui**
- **React Hook Form** + **Zod** para formularios

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
git clone https://github.com/tu-usuario/vetary-api
cd vetary-api

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

> El frontend tiene su propio repositorio: `vetary-web`

---

## Futuro del proyecto (v2)

- **Pagos en línea** — integración con Transbank/WebPay para el mercado chileno y Stripe para LATAM
- **Exportación de documentos** — fichas clínicas en PDF, reportes de reservas en Excel
- **Notificaciones por email y WhatsApp** — recordatorios automáticos de citas
- **App móvil** — para que los clientes gestionen sus mascotas desde el celular
- **Módulo de inventario** — gestión de medicamentos e insumos de la clínica

---

## Autor

**Javier Rojas** — Developer Frontend/Backend  
Viña del Mar, Chile  
[LinkedIn](https://www.linkedin.com/in/javier4le) · [GitHub](https://www.github.com/Javier4le)
