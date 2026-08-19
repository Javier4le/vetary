import type { Role } from "@/database/prisma";
import { SetMetadata } from "@nestjs/common";

// 🏗️ ARQUITECTURA: @Roles() decorator define roles requeridos para una ruta
// 📐 PATRÓN: Decorator Pattern — metadata que RolesGuard lee para validar acceso

export const ROLES_KEY = "roles";

/**
 * @Roles(...roles) decorator
 * Define qué roles pueden acceder a una ruta
 *
 * Uso:
 * ```typescript
 * @Get('users')
 * @Roles(Role.ADMIN, Role.VET)
 * async getUsers() {
 *   return this.userService.findAll();
 * }
 * ```
 *
 * ⚡ PRINCIPIO: Least Privilege — por defecto,  nadie tiene acceso.
 * Solo los roles explícitamente permitidos pueden entrar.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
