import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";

import { UserRepository } from "@/modules/users/repositories/user.repository";
import type { VetAvailability } from "@prisma/client";
import type { CreateAvailabilityDto } from "../dto/create-availability.dto";
import { AvailabilityRepository } from "../repositories/availability.repository";

// 📐 PATRÓN: Service — orquesta la lógica de disponibilidad sin conocer HTTP
// ⚡ PRINCIPIO: Single Responsibility — solo reglas de horarios veterinarios
// 🔒 SEGURIDAD: Verifica que el veterinario pertenece al tenant antes de actuar

@Injectable()
export class AvailabilityService {
	constructor(
		private readonly availabilityRepository: AvailabilityRepository,
		private readonly userRepository: UserRepository,
	) {}

	/**
	 * Crea un bloque de disponibilidad semanal recurrente
	 * Rechaza bloques traslapados, rangos inválidos y veterinarios de otros tenants
	 */
	async create(
		tenantId: string,
		vetId: string,
		dto: CreateAvailabilityDto,
	): Promise<VetAvailability> {
		const membership = await this.userRepository.findUserTenant(vetId, tenantId);
		if (!membership) {
			throw new NotFoundException(`Vet with id '${vetId}' not found in this clinic`);
		}

		if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
			throw new BadRequestException("End time must be after start time");
		}

		const existingSlots = await this.availabilityRepository.findByVetAndDay(
			tenantId,
			vetId,
			dto.dayOfWeek,
		);

		if (this.hasOverlap(existingSlots, dto.startTime, dto.endTime)) {
			throw new ConflictException("This availability block overlaps with an existing one");
		}

		return this.availabilityRepository.createAvailability(tenantId, {
			vetId,
			dayOfWeek: dto.dayOfWeek,
			startTime: dto.startTime,
			endTime: dto.endTime,
		});
	}

	/**
	 * Lista todos los bloques de disponibilidad de un veterinario en el tenant
	 */
	async findAllForVet(tenantId: string, vetId: string): Promise<VetAvailability[]> {
		return this.availabilityRepository.findByVetAndDay(tenantId, vetId);
	}

	/**
	 * Elimina un bloque de disponibilidad del tenant
	 */
	async delete(tenantId: string, id: string): Promise<{ count: number }> {
		const result = await this.availabilityRepository.deleteAvailability(tenantId, id);
		if (result.count === 0) {
			throw new NotFoundException(`Availability slot with id '${id}' not found`);
		}
		return result;
	}

	/**
	 * Valida que el rango horario no cruce la medianoche
	 */
	private isValidTimeRange(startTime: string, endTime: string): boolean {
		return this.timeToMinutes(endTime) > this.timeToMinutes(startTime);
	}

	/**
	 * Detecta si un nuevo bloque se traslapa con alguno existente
	 */
	private hasOverlap(
		existingSlots: VetAvailability[],
		startTime: string,
		endTime: string,
	): boolean {
		const start = this.timeToMinutes(startTime);
		const end = this.timeToMinutes(endTime);

		return existingSlots.some((slot) => {
			const slotStart = this.timeToMinutes(slot.startTime);
			const slotEnd = this.timeToMinutes(slot.endTime);
			return start < slotEnd && end > slotStart;
		});
	}

	/**
	 * Convierte "HH:mm" a minutos desde medianoche
	 */
	private timeToMinutes(time: string): number {
		const [hours, minutes] = time.split(":").map(Number);
		return hours * 60 + minutes;
	}
}
