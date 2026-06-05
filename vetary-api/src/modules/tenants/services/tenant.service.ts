import {
	BadRequestException,
	ConflictException,
	Injectable,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { PrismaService } from "@/database/prisma.service";
import type { RegisterTenantDto } from "../dto/register-tenant.dto";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { TenantRepository } from "../repositories/tenant.repository";

// 📐 PATRÓN: Service — orquesta la lógica de negocio sin conocer HTTP ni la BD directamente
// ⚡ PRINCIPIO: Single Responsibility — este service solo gestiona el registro de tenants
// 🔒 SEGURIDAD: Validaciones de negocio antes de tocar la base de datos (fail-fast)

// Subdominios reservados: colisionan con rutas del sistema o son palabras peligrosas
const RESERVED_SUBDOMAINS = new Set([
	"admin",
	"api",
	"www",
	"app",
	"auth",
	"super",
	"root",
	"vetary",
	"mail",
	"ftp",
	"cdn",
	"static",
	"assets",
	"docs",
	"help",
	"support",
	"dashboard",
]);

// Regex del spec: solo minúsculas, números y guiones (sin guión al inicio o final)
const SUBDOMAIN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface RegisterTenantResult {
	tenant: {
		id: string;
		name: string;
		subdomain: string;
		status: string;
	};
	user: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
	};
}

@Injectable()
export class TenantService {
	constructor(
		private readonly tenantRepository: TenantRepository,
		// 🏗️ ARQUITECTURA: PrismaService se inyecta directamente SOLO aquí
		// porque necesitamos prisma.$transaction para atomicidad
		// Los repositorios normales usan BaseRepository — este es un caso especial
		private readonly prisma: PrismaService,
	) {}

	async register(dto: RegisterTenantDto): Promise<RegisterTenantResult> {
		// ─── Validaciones de negocio (antes de tocar la BD) ──────────────────
		this.validateSubdomain(dto.subdomain);

		const subdomainExists = await this.tenantRepository.existsBySubdomain(
			dto.subdomain,
		);
		if (subdomainExists) {
			throw new ConflictException(
				`Subdomain '${dto.subdomain}' is already taken. Please choose another.`,
			);
		}

		// ─── Transacción atómica: Tenant + User + UserTenant ─────────────────
		// 📐 PATRÓN Transaction: las tres operaciones son un todo indivisible
		// Si cualquiera falla, Prisma hace rollback de todas → no quedan datos huérfanos
		//
		// Analogía: es como una transferencia bancaria — o se debitan Y acreditan ambas
		// cuentas, o no ocurre nada. No hay estado intermedio.
		const passwordHash = await bcrypt.hash(
			dto.adminPassword,
			Number(process.env.BCRYPT_ROUNDS) || 10,
		);

		const result = await this.prisma.$transaction(async (tx: any) => {
			// 1. Crear el Tenant
			const tenant = await tx.tenant.create({
				data: {
					name: dto.tenantName,
					subdomain: dto.subdomain,
					status: "ACTIVE",
				},
			});

			// 2. Crear el User (sin tenantId — el usuario es global)
			const user = await tx.user.create({
				data: {
					email: dto.adminEmail,
					passwordHash,
					firstName: dto.adminFirstName,
					lastName: dto.adminLastName,
				},
			});

			// 3. Crear el UserTenant (la membresía — rol ADMIN en esta clínica)
			await tx.userTenant.create({
				data: {
					userId: user.id,
					tenantId: tenant.id,
					role: "ADMIN",
				},
			});

			return { tenant, user };
		});

		// 🔒 SEGURIDAD: Nunca devolver el hash de la contraseña
		return {
			tenant: {
				id: result.tenant.id,
				name: result.tenant.name,
				subdomain: result.tenant.subdomain,
				status: result.tenant.status,
			},
			user: {
				id: result.user.id,
				email: result.user.email,
				firstName: result.user.firstName,
				lastName: result.user.lastName,
			},
		};
	}

	// ─── Validación del subdominio ──────────────────────────────────────────────
	private validateSubdomain(subdomain: string): void {
		// ⚡ PRINCIPIO: Fail-Fast — detectar problemas lo antes posible
		if (subdomain.length < 3) {
			throw new BadRequestException("Subdomain must be at least 3 characters.");
		}

		if (subdomain.length > 63) {
			throw new BadRequestException(
				"Subdomain cannot exceed 63 characters (DNS limit).",
			);
		}

		if (!SUBDOMAIN_REGEX.test(subdomain)) {
			throw new BadRequestException(
				"Subdomain can only contain lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.",
			);
		}

		if (RESERVED_SUBDOMAINS.has(subdomain)) {
			throw new BadRequestException(
				`'${subdomain}' is a reserved subdomain and cannot be used.`,
			);
		}
	}
}
