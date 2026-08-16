import { Injectable } from "@nestjs/common";

import { BaseRepository } from "@/database/base.repository";
import { PrismaService } from "@/database/prisma.service";
import type { VetAvailability } from "@prisma/client";

// 📐 PATRÓN Repository: encapsula todo el acceso a datos de disponibilidad
// ⚡ PRINCIPIO: Single Responsibility — solo horarios de veterinarios
// 🔒 SEGURIDAD: Extends BaseRepository → TODAS las queries incluyen tenantId

@Injectable()
export class AvailabilityRepository extends BaseRepository<VetAvailability> {
	constructor(protected readonly prisma: PrismaService) {
		super(prisma, prisma.vetAvailability);
	}

	/**
	 * 🔒 SEGURIDAD: Encuentra los bloques de un veterinario para un día específico
	 */
	async findByVetAndDay(
		tenantId: string,
		vetId: string,
		dayOfWeek?: number,
	): Promise<VetAvailability[]> {
		const where: Record<string, unknown> = { vetId };
		if (dayOfWeek !== undefined) {
			where.dayOfWeek = dayOfWeek;
		}
		return this.findByTenant(tenantId, where);
	}

	/**
	 * 🔒 SEGURIDAD: Crea un bloque de disponibilidad asociado a un tenant
	 */
	async createAvailability(
		tenantId: string,
		data: Omit<VetAvailability, "id" | "tenantId" | "createdAt" | "updatedAt">,
	): Promise<VetAvailability> {
		return super.createForTenant(tenantId, data);
	}

	/**
	 * 🔒 SEGURIDAD: Elimina un bloque solo si pertenece al tenant
	 */
	async deleteAvailability(tenantId: string, id: string): Promise<{ count: number }> {
		return super.deleteForTenant(tenantId, id);
	}
}
