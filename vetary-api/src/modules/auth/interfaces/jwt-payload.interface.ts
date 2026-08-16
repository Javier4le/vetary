// 🔒 SEGURIDAD: JWT Payload — datos que viajan firmados en el access token
// 📐 PATRÓN: Interface como contrato — define exactamente qué esperamos del token
// ⚡ PRINCIPIO: Explicit over Implicit — cada campo justificado

export interface JwtPayload {
	// sub (subject) = userId — estándar JWT, identifica al usuario
	sub: string;

	// tenantId — clínica a la que pertenece esta sesión
	tenantId: string;

	// role — permisos del usuario EN ESTE TENANT
	role: Role;

	// email — identidad global del usuario (no cambia entre tenants)
	email: string;

	// iat = issued at, exp = expiry — gestionados automáticamente por jwt.sign()
}
import type { Role } from "@prisma/client";
