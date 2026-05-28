# Vetary — Especificación del Producto
**Versión:** 1.0  
**Fecha:** Mayo 2026  
**Autor:** Javier Rojas  
**Estado:** Definición inicial

---

## ¿Qué es Vetary?

Vetary es una **plataforma SaaS multi-tenant** de gestión y reservas para clínicas veterinarias. Cada clínica que se registra obtiene su propio espacio aislado dentro de la plataforma: sus usuarios, mascotas, reservas y configuración son completamente independientes de las demás clínicas.

El producto tiene dos mundos:
- **Vista pública:** donde los dueños de mascotas descubren la clínica, se registran y hacen sus reservas.
- **Panel interno:** donde el equipo de la clínica (admin, staff y veterinarios) gestiona el día a día.

---

## El modelo multi-tenant

Un **tenant** es una clínica. Cuando "Clínica Las Palmeras" se registra en Vetary, se convierte en un tenant con su propio subdominio (`laspalmeras.vetary.app`), su propia configuración y sus propios datos. Otra clínica no puede ver ni acceder a sus datos en ningún escenario.

La estrategia elegida es **base de datos compartida, esquema compartido con `tenant_id`**. Toda tabla de datos lleva un `tenant_id` que identifica a qué clínica pertenece. El sistema garantiza en la capa de repositorio que ninguna query se ejecute sin ese filtro.

---

## Roles del sistema

### Super Admin (tú como dueño de la plataforma)
Accede a un panel especial que no pertenece a ningún tenant. Ve todos los tenants registrados, puede activarlos, suspenderlos o eliminarlos. No interactúa con datos clínicos.

### Admin (dueño o gerente de la clínica)
- Configura el perfil de la clínica (nombre, logo, dirección, horarios generales)
- Crea y gestiona cuentas de Staff y Veterinarios
- Configura los servicios ofrecidos (tipo, duración, precio)
- Ve el dashboard con métricas del negocio
- Gestiona horarios de disponibilidad por veterinario

### Staff (recepción)
- Ve el calendario de reservas del día y la semana
- Crea reservas manualmente (para clientes que llaman o llegan sin cita)
- Confirma, reprograma o cancela reservas
- Registra el check-in cuando el paciente llega a la clínica
- Accede a la ficha básica del paciente

### Veterinario
- Ve solo su propia agenda (no la de otros vets)
- Accede a la ficha completa del paciente antes de la consulta
- Agrega notas clínicas al finalizar cada consulta
- Marca la consulta como completada

### Cliente (dueño de mascota)
- Se registra en la plataforma de una clínica específica
- Registra sus mascotas con datos básicos
- Hace reservas eligiendo servicio, veterinario, fecha y hora
- Ve sus próximas reservas y el historial pasado
- Ve el historial clínico de cada mascota (solo lectura de las notas del vet)

---

## Flujos principales

### Registro de un nuevo tenant (clínica)
1. La clínica llega a la landing pública de Vetary
2. Completa el formulario: nombre de la clínica, subdominio deseado, datos del admin
3. El sistema crea el tenant, crea la cuenta admin y genera el subdominio
4. El admin accede y configura su clínica (logo, servicios, horarios)
5. Crea las cuentas de sus vets y staff

### Reserva por parte de un cliente
1. El cliente entra a `laspalmeras.vetary.app`
2. Ve los servicios disponibles y los veterinarios
3. Selecciona: servicio → veterinario → fecha → horario disponible
4. Si no tiene cuenta, se registra. Si tiene, inicia sesión.
5. Confirma la reserva — estado inicial: **Pendiente**
6. El staff o admin confirma — estado: **Confirmada**
7. El cliente llega, el staff hace check-in — estado: **En curso**
8. El vet termina y agrega notas — estado: **Completada**

### Estados de una reserva
```
Pendiente → Confirmada → En curso → Completada
         ↓            ↓
      Cancelada    Cancelada
```

### Ficha del paciente (mascota)
Cada mascota tiene:
- Datos básicos: nombre, especie, raza, fecha de nacimiento, peso, color/descripción
- Dueño asociado (puede haber varios dueños por mascota si se implementa)
- Historial de consultas: fecha, veterinario, motivo, notas clínicas
- Próximas reservas

---

## Stack tecnológico

### Backend
- **Runtime:** Node.js 22
- **Framework:** NestJS con TypeScript estricto
- **Base de datos:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT con refresh tokens
- **Validación:** class-validator + class-transformer

### Frontend
- **Framework:** React 18 con TypeScript estricto
- **Build tool:** Vite
- **Estado servidor:** TanStack Query v5
- **Estado cliente:** Zustand (solo para lo que no es server state)
- **Routing:** React Router v6
- **UI/Estilos:** Tailwind CSS + shadcn/ui
- **Formularios:** React Hook Form + Zod

---

## Lo que SÍ entra en v1

- Registro y onboarding de tenants (clínicas)
- Autenticación completa (login, logout, refresh token, recuperar contraseña)
- Gestión de roles y permisos
- CRUD de veterinarios y staff
- Configuración de servicios (tipos de consulta con duración y precio)
- Configuración de horarios de disponibilidad por veterinario
- Sistema de reservas completo con flujo de estados
- Ficha de mascota con historial clínico
- Panel del cliente (mis mascotas, mis reservas)
- Panel del veterinario (mi agenda, notas clínicas)
- Panel del staff (calendario, gestión de reservas del día)
- Panel del admin (configuración, usuarios, servicios)
- Dashboard con métricas básicas (reservas del día, semana, por veterinario)
- Super admin panel (gestión de tenants)
- Landing pública por tenant con formulario de reserva
- Diseño responsive

## Lo que NO entra en v1 (queda para v2)

- Pagos en línea (Transbank/WebPay)
- Exportación de fichas a PDF
- Exportación de reservas a Excel
- Notificaciones por email
- Recordatorios automáticos
- App móvil
- Videoconsultas

---

## Criterios de aceptación por fase

### Fase 1 — Fundación (Auth + Multi-tenancy)
- Un tenant puede registrarse y recibir su subdominio
- Un admin puede iniciar sesión en su tenant
- El sistema rechaza tokens de un tenant intentando acceder a datos de otro
- Rutas protegidas por rol funcionan correctamente

### Fase 2 — Configuración de la clínica
- El admin puede crear servicios con nombre, duración y precio
- El admin puede crear cuentas de veterinario y staff
- El admin puede configurar la disponibilidad horaria de cada vet

### Fase 3 — Sistema de reservas
- Un cliente puede registrarse, agregar una mascota y hacer una reserva
- La reserva pasa por todos sus estados correctamente
- El staff puede ver el calendario y gestionar reservas
- El vet puede ver su agenda del día

### Fase 4 — Ficha clínica
- El vet puede abrir la ficha de una mascota antes de la consulta
- El vet puede agregar notas clínicas al finalizar
- El cliente puede ver el historial de su mascota

### Fase 5 — Dashboard y UI final
- El admin ve métricas básicas en tiempo real
- El diseño es responsive y pulido en todas las vistas
- El super admin puede gestionar tenants

### Fase 6 — Deploy
- El proyecto está deployado y accesible con un demo funcional
- README explica cómo probar el sistema

---

## Nombre del proyecto
**Vetary** — veterinary + -ary (lugar, sistema). Limpio, profesional, memorable.

*Dominio sugerido para el portfolio: vetary.app (a registrar cuando se llegue al deploy)*
