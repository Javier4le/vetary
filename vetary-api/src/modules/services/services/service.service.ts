import { Injectable, NotFoundException } from "@nestjs/common";

import type { Service } from "@prisma/client";
import type { CreateServiceDto } from "../dto/create-service.dto";
import type { UpdateServiceDto } from "../dto/update-service.dto";
import { ServiceRepository } from "../repositories/service.repository";

// 📐 PATRÓN: Service — orquesta la lógica de negocio sin conocer HTTP
// ⚡ PRINCIPIO: Single Responsibility — solo gestión de servicios, nada más
// 🔒 SEGURIDAD: Todo servicio se crea/lee/actualiza en contexto de un tenant

@Injectable()
export class ServicesService {
	constructor(private readonly serviceRepository: ServiceRepository) {}

	/**
	 * Crea un nuevo servicio en el contexto de un tenant
	 * 🔒 SEGURIDAD: tenantId viene del contexto HTTP (CurrentTenant), no del body
	 */
	async create(tenantId: string, dto: CreateServiceDto): Promise<Service> {
		// Double-check validations (DTO already validates, but defense in depth)
		if (dto.durationMinutes < 1) {
			throw new Error("Duration must be at least 1 minute");
		}
		if (dto.priceClp < 0) {
			throw new Error("Price cannot be negative");
		}

		return this.serviceRepository.createService(tenantId, {
			name: dto.name,
			description: dto.description ?? null,
			durationMinutes: dto.durationMinutes,
			priceClp: dto.priceClp,
			isActive: true,
		});
	}

	/**
	 * Encuentra todos los servicios de un tenant
	 * 🔒 SEGURIDAD: Scoping por tenantId vía BaseRepository
	 */
	async findAll(tenantId: string): Promise<Service[]> {
		return this.serviceRepository.findAllByTenant(tenantId);
	}

	/**
	 * Encuentra un servicio por ID dentro de un tenant
	 * 🔒 SEGURIDAD: Scoping por tenantId + id vía BaseRepository
	 */
	async findOne(tenantId: string, id: string): Promise<Service> {
		const service = await this.serviceRepository.findByIdAndTenant(tenantId, id);

		if (!service) {
			throw new NotFoundException(`Service with id '${id}' not found`);
		}

		return service;
	}

	/**
	 * Actualiza un servicio existente
	 * 🔒 SEGURIDAD: updateForTenant filtra por tenantId + id
	 */
	async update(tenantId: string, id: string, dto: UpdateServiceDto): Promise<Service> {
		// Verificar que el servicio existe antes de actualizar
		await this.findOne(tenantId, id);

		await this.serviceRepository.updateService(tenantId, id, dto);

		// Retornar el servicio actualizado
		return this.findOne(tenantId, id);
	}

	/**
	 * Desactiva un servicio (soft disable)
	 * Nunca borra físicamente — preserva historial
	 * 🔒 SEGURIDAD: softDisable filtra por tenantId + id
	 */
	async disable(tenantId: string, id: string): Promise<Service> {
		const service = await this.serviceRepository.softDisable(tenantId, id);

		if (!service) {
			throw new NotFoundException(`Service with id '${id}' not found`);
		}

		return service;
	}
}
