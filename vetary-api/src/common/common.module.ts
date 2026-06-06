import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CustomAuthGuard } from './guards/auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { RolesGuard } from './guards/roles.guard';

// 🏗️ ARQUITECTURA: CommonModule — cross-cutting concerns
// Exporta guards y decoradores globales para evitar importarlos en cada módulo.
//
// ⚡ PRINCIPIO: DRY — un solo lugar donde se registra la cadena de seguridad.
//
// 📐 PATRÓN: Global Guards via APP_GUARD
//   NestJS inyecta estos guards automáticamente en TODOS los controllers.
//   Orden de ejecución: AuthGuard → TenantGuard → RolesGuard
//   (definido por el orden de los providers APP_GUARD)

@Module({
  providers: [
    // 🔒 Cadena de seguridad GLOBAL — se aplica a TODOS los endpoints
    // Orden CRÍTICO: Throttle → Auth → Tenant → Roles
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // 0. Rate limiting (rejects before auth if exceeded)
    },
    {
      provide: APP_GUARD,
      useClass: CustomAuthGuard, // 1. Validar JWT (o saltar si @Public())
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard, // 2. Verificar que el token pertenece al subdomain actual
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // 3. Verificar permisos de rol
    },
  ],
})
export class CommonModule {}
