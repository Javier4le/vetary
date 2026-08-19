import { BaseRepository } from "@/database/base.repository";
import type { VetProfile } from "@/database/prisma";
import { PrismaService } from "@/database/prisma.service";
import { Injectable } from "@nestjs/common";

// 📐 PATRÓN Repository: encapsula todo el acceso a datos relacionados con VetProfile
// ⚡ PRINCIPIO: Single Responsibility — solo gestión de perfiles de veterinarios, nada más
// 🔒 SEGURIDAD: Extends BaseRepository → TODAS las queries incluyen tenantId automáticamente

@Injectable()
export class VetProfileRepository extends BaseRepository<VetProfile> {
	constructor(protected readonly prisma: PrismaService) {
		super(prisma, prisma.vetProfile);
	}

	async findAllByTenant(tenantId: string): Promise<VetProfile[]> {
		return this.findByTenant(tenantId);
	}

	async findByIdAndTenant(tenantId: string, id: string): Promise<VetProfile | null> {
		return this.findOneByTenant(tenantId, { id });
	}

	async findByUserIdAndTenant(tenantId: string, userId: string): Promise<VetProfile | null> {
		return this.findOneByTenant(tenantId, { userId });
	}

	async createVetProfile(
		tenantId: string,
		data: Omit<VetProfile, "id" | "tenantId" | "createdAt" | "updatedAt">,
	): Promise<VetProfile> {
		return super.createForTenant(tenantId, data);
	}

	async updateVetProfile(
		tenantId: string,
		id: string,
		data: Partial<Omit<VetProfile, "id" | "tenantId" | "createdAt" | "updatedAt">>,
	): Promise<{ count: number }> {
		return super.updateForTenant(tenantId, id, data);
	}

	async deleteVetProfile(tenantId: string, id: string): Promise<{ count: number }> {
		return super.deleteForTenant(tenantId, id);
	}
}
