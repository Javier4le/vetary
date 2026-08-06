import { Injectable } from "@nestjs/common";

// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { PrismaService } from "@/database/prisma.service";
import { BaseRepository } from "@/database/base.repository";
import type { Service } from "@prisma/client";

// 📐 PATRÓN Repository: encapsula todo el acceso a datos relacionados con Service
// ⚡ PRINCIPIO: Single Responsibility — solo gestión de servicios, nada más
// 🔒 SEGURIDAD: Extends BaseRepository → TODAS las queries incluyen tenantId automáticamente
// 🏗️ ARQUITECTURA: ServiceRepository extiende BaseRepository porque Service tiene campo tenantId directo

@Injectable()
export class ServiceRepository extends BaseRepository<Service> {
	constructor(protected readonly prisma: PrismaService) {
		super(prisma);
	}

	/**
	 * 🔒 SEGURIDAD: Devuelve el delegate de Prisma para el model Service
	 * BaseRepository usa esto para ejecutar queries con tenantId automático
	 */
	protected getDelegate() {
		return this.prisma.service;
	}

	/**
	 * 🔒 SEGURIDAD: Encuentra todos los servicios de un tenant específico
	 * BaseRepository añade tenantId al where clause
	 */
	async findAllByTenant(tenantId: string): Promise<Service[]> {
		return this.findByTenant(tenantId);
	}

	/**
	 * 🔒 SEGURIDAD: Encuentra un servicio por ID dentro de un tenant específico
	 * Doble filtro: id + tenantId — prevención de cross-tenant access
	 */
	async findByIdAndTenant(
		tenantId: string,
		id: string,
	): Promise<Service | null> {
		return this.findOneByTenant(tenantId, { id });
	}

	/**
	 * 🔒 SEGURIDAD: Crea un servicio asociado a un tenant específico
	 * BaseRepository inyecta tenantId automáticamente en los datos
	 */
	async createService(
		tenantId: string,
		data: Omit<Service, "id" | "tenantId" | "createdAt" | "updatedAt">,
	): Promise<Service> {
		return super.createForTenant(tenantId, data);
	}

	/**
	 * 🔒 SEGURIDAD: Actualiza un servicio por ID dentro de un tenant
	 * updateMany con filtro doble: id + tenantId
	 */
	async updateService(
		tenantId: string,
		id: string,
		data: Partial<Omit<Service, "id" | "tenantId" | "createdAt" | "updatedAt">>,
	): Promise<{ count: number }> {
		return super.updateForTenant(tenantId, id, data);
	}

	/**
	 * 🔒 SEGURIDAD: Soft disable — nunca borra físicamente
	 * Solo setea isActive = false, preservando historial
	 * Doble filtro: id + tenantId
	 */
	async softDisable(tenantId: string, id: string): Promise<Service | null> {
		await super.updateForTenant(tenantId, id, { isActive: false });
		return this.findByIdAndTenant(tenantId, id);
	}
}
