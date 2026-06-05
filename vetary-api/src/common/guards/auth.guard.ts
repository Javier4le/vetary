import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// 🏗️ ARQUITECTURA: AuthGuard — SEGUNDO en la cadena (después de TenantMiddleware)
// Valida JWT en rutas protegidas. Si @Public(), salta completamente.
//
// 📐 PATRÓN: Chain of Responsibility — eslabón 2 de 4 en la cadena de seguridad
//   TenantMiddleware → AuthGuard → TenantGuard → RolesGuard → Controller
//
// ⚡ PRINCIPIO: Defence in Depth — si @Public() no está, NO pasas.
//   La decisión de "público" es explícita en el código, no implícita.

@Injectable()
export class CustomAuthGuard extends PassportAuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * ENTRYPOINT de NestJS para cada request protegida.
   * Primero lee @Public() metadata; si está presente, salta JWT.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // 📐 PATRÓN: Short-circuit — evita overhead de verificación JWT en rutas públicas
      return true;
    }

    // Delegar a Passport JWT strategy (verify firma + expiración)
    return (await super.canActivate(context)) as boolean;
  }

  /**
   * Se ejecuta DESPUÉS de que Passport validó la firma.
   * Si err o user son falsy → token inválido o expirado.
   */
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      // 🔒 SEGURIDAD: Nunca exponer detalles del error al cliente
      throw err || new UnauthorizedException("Invalid token");
    }
    return user;
  }
}
