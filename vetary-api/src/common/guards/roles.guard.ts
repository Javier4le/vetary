import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";

// 🏗️ ARQUITECTURA: RolesGuard — CUARTO en la cadena (último antes del Controller)
// Verifica que el rol del usuario autenticado esté dentro de los permitidos
// por el decorador @Roles(...) en el endpoint.
//
// 📐 PATRÓN: Chain of Responsibility — eslabón 4 de 4
//   TenantMiddleware → AuthGuard → TenantGuard → RolesGuard → Controller
//
// ⚡ PRINCIPIO: Least Privilege — si no hay @Roles(), se permite (backwards compatible).
//   Si hay @Roles(...), SOLO esos roles pueden entrar.

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles() → no hay restricción de rol en este endpoint
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by AuthGuard

    // 🔒 SEGURIDAD: AuthGuard debería haber rechazado antes, pero fail-closed aquí también
    if (!user) {
      throw new ForbiddenException("User context missing");
    }

    // 🔒 SEGURIDAD: Verificar membresía de rol
    if (!requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
