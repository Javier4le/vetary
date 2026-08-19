import { ConfigService } from "@/config/config.service";
import type { Role } from "@/database/prisma";
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtPayload } from "../interfaces/jwt-payload.interface";

// 🔒 SEGURIDAD: JwtStrategy — valida la firma del JWT en CADA request protegida
// 📐 PATRÓN Strategy (Passport): una estrategia de autenticación plug-and-play
// NestJS puede tener múltiples estrategias: jwt, local, google-oauth, etc.
//
// ⚡ PRINCIPIO: Trust but Verify — confiamos en el token (está firmado),
// pero verificamos que:
//   1. La firma es válida (no fue manipulado)
//   2. No expiró
//   3. Vino del header correcto (Authorization: Bearer <token>)
//
// ⚠️ DECISIÓN: La estrategia NO consulta la base de datos
// Por qué: JWT es stateless. Si la firma es válida, confiamos en el payload.
// Consecuencia: si un usuario es eliminado, su token sigue siendo válido hasta expirar.
// Aceptamos esto porque access tokens duran 15 minutos — ventana de riesgo pequeña.

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
	constructor(configService: ConfigService) {
		super({
			// 📐 PATRÓN: Bearer Token — estándar OAuth2/JWT
			// El cliente envía: Authorization: Bearer eyJhbG...
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

			// 🔒 SEGURIDAD: Rechazar tokens expirados automáticamente
			// passport-jwt verifica exp internamente con la fecha del servidor
			ignoreExpiration: false,

			// 🔒 SEGURIDAD: Clave secreta para verificar la firma HMAC-SHA256
			// Si alguien cambia un bit del payload, la firma no coincide → rechazado
			secretOrKey: configService.jwtSecret,
		});
	}

	/**
	 * Se ejecuta SOLO si el token tiene firma válida y no expiró.
	 * El resultado se adjunta a req.user — disponible en toda la cadena.
	 */
	async validate(payload: JwtPayload): Promise<{
		userId: string;
		tenantId: string;
		role: Role;
		email: string;
	}> {
		// ⚡ PRINCIPIO: Minimal Surface — solo extraemos lo que necesitan los Guards
		// No cargamos el User completo de la BD. Eso lo hace el controller si lo necesita.
		return {
			userId: payload.sub,
			tenantId: payload.tenantId,
			role: payload.role,
			email: payload.email,
		};
	}
}
