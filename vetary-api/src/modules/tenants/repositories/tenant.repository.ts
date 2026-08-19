import type { Tenant } from "@/database/prisma";
import { PrismaService } from "@/database/prisma.service";
import { Injectable } from "@nestjs/common";

// 📐 PATRÓN Repository: encapsula todo el acceso a datos de Tenant
// ⚠️ DECISIÓN: TenantRepository NO extiende BaseRepository
// Por qué: Tenant ES el root entity del multi-tenant. No tiene tenantId propio.
// BaseRepository es para entidades DENTRO de un tenant (User, Booking, Pet, etc.)
// Tenant se consulta SIN filtro de tenant — es la tabla raíz del sistema.

@Injectable()
export class TenantRepository {
	constructor(private readonly prisma: PrismaService) {}

	async findBySubdomain(subdomain: string): Promise<Tenant | null> {
		return this.prisma.tenant.findUnique({
			where: { subdomain },
		});
	}

	async findById(id: string): Promise<Tenant | null> {
		return this.prisma.tenant.findUnique({
			where: { id },
		});
	}

	async existsBySubdomain(subdomain: string): Promise<boolean> {
		const count = await this.prisma.tenant.count({
			where: { subdomain },
		});
		return count > 0;
	}

	async create(data: { name: string; subdomain: string }): Promise<Tenant> {
		// 🔒 SEGURIDAD: Tenant siempre se crea en estado ACTIVE (auto-activo en v1)
		// Super admin puede suspender después desde el panel de super admin
		return this.prisma.tenant.create({
			data: {
				name: data.name,
				subdomain: data.subdomain,
				status: "ACTIVE",
			},
		});
	}
}
