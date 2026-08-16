import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// 🏗️ ARQUITECTURA: TenantGuard — TERCERO en la cadena (después de AuthGuard)
// ÚLTIMA línea de defensa contra cross-tenant data leakage.
// Compara req.tenant.id (del TenantMiddleware, basado en subdomain) con
// req.user.tenantId (del JWT, basado en login).
//
// 📐 PATRÓN: Chain of Responsibility — eslabón 3 de 4
//   TenantMiddleware → AuthGuard → TenantGuard → RolesGuard → Controller
//
// ⚡ PRINCIPIO: Fail Closed — si falta cualquier contexto, rechazar.
//   No asumir que "undefined === undefined" es válido.
//
// ⚠️ DECISIÓN: No usamos AsyncLocalStorage en Phase 1.
//   El tenant fluye vía req.tenant (NestJS standard), no implícito.
//   Esto hace el flujo visible y debuggeable.

@Injectable()
export class TenantGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		// Rutas públicas no necesitan verificación de tenant
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const tenant = request.tenant; // Set by TenantMiddleware
		const user = request.user; // Set by AuthGuard

		// 🔒 SEGURIDAD: Fail closed — contexto faltante = rechazo inmediato
		if (!tenant || !user) {
			throw new ForbiddenException("Tenant or user context missing");
		}

		// 🔒 SEGURIDAD: CORE del aislamiento multi-tenant
		//   ej: user loggeó en Clinic A (JWT con tenantId=A),
		//       pero la request llegó por clinic-b.vetary.app (tenant.id=B)
		//   → Rechazar. El token NO pertenece a esta clínica.
		if (tenant.id !== user.tenantId) {
			throw new ForbiddenException("Your token belongs to a different clinic");
		}

		return true;
	}
}
