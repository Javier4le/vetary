import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	type NestMiddleware,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { PrismaService } from "../../database/prisma.service";

// 🏗️ ARQUITECTURA: TenantMiddleware — PRIMER punto de entrada de toda request
// Corre ANTES de cualquier Guard o Controller
// Su única responsabilidad: "¿de qué clínica viene esta request?"
//
// 📐 PATRÓN Middleware: transforma la request agregando información (req.tenant)
// No bloquea por reglas de negocio — solo resuelve la identidad del tenant
//
// ⚠️ DECISIÓN: Usamos req.hostname para extraer el subdominio
// Alternativa descartada: header X-Tenant-Id → cliente puede mentir (inseguro)

// Extendemos Request de Express para poder adjuntar req.tenant con tipado
declare module "express" {
	interface Request {
		tenant?: {
			id: string;
			name: string;
			subdomain: string;
			status: string;
		};
	}
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
	constructor(private readonly prisma: PrismaService) {}

	async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
		const subdomain = this.extractSubdomain(req.hostname);

		// 🔒 SEGURIDAD: Si no hay subdominio, no sabemos a qué clínica apunta la request
		if (!subdomain) {
			throw new BadRequestException(
				"No tenant subdomain found. Access must be via a clinic subdomain (e.g. clinica-a.vetary.app).",
			);
		}

		const tenant = await this.prisma.tenant.findUnique({
			where: { subdomain },
		});

		// 🔒 SEGURIDAD: Subdominio no registrado → 404, no 403
		// No informamos si el tenant existe o no para no exponer información
		if (!tenant) {
			throw new NotFoundException(`Clinic '${subdomain}' not found.`);
		}

		// 🔒 SEGURIDAD: Tenant suspendido → 403 explícito
		if (tenant.status !== "ACTIVE") {
			throw new ForbiddenException(
				"This clinic account is currently suspended. Contact support.",
			);
		}

		// ⚡ PRINCIPIO: Explicit over Implicit
		// Adjuntamos el tenant al objeto request para que esté disponible en toda la cadena
		// Guards, Controllers y Services pueden acceder vía @CurrentTenant() decorator
		req.tenant = tenant;

		next();
	}

	// 📐 PATRÓN: Strategy para extracción del subdominio
	// 'clinica-a.vetary.app' → 'clinica-a'
	// 'localhost'            → usa DEFAULT_TENANT_SUBDOMAIN (dev)
	// 'vetary.app'           → null (dominio raíz, sin subdominio)
	private extractSubdomain(hostname: string): string | null {
		const parts = hostname.split(".");

		// localhost o dominio raíz sin subdominio
		if (parts.length <= 1) {
			// ⚠️ DECISIÓN: En desarrollo local usamos variable de entorno como fallback
			// Esto permite testear con Postman/Thunder Client sin necesitar /etc/hosts
			return process.env.DEFAULT_TENANT_SUBDOMAIN ?? null;
		}

		// 'clinica-a.vetary.app' → parts = ['clinica-a', 'vetary', 'app'] → 'clinica-a'
		return parts[0] ?? null;
	}
}
