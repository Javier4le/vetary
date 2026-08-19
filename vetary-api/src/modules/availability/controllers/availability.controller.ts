import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/prisma";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { TenantContext } from "../../../common/types/request-context";
import { CreateAvailabilityDto } from "../dto/create-availability.dto";
import { AvailabilityService } from "../services/availability.service";

// 🏗️ ARQUITECTURA: AvailabilityController — solo recibe, delega, responde
// Cero lógica de negocio. Conector HTTP → AvailabilityService
// ⚡ PRINCIPIO: Thin Controller — delegar al máximo

@ApiTags("Availability")
@Controller("availability")
export class AvailabilityController {
	constructor(private readonly availabilityService: AvailabilityService) {}

	@Get("vets/:vetId/slots")
	@UseGuards(AuthGuard("jwt"))
	@ApiBearerAuth()
	@ApiOperation({ summary: "List availability slots for a vet" })
	@ApiResponse({ status: 200, description: "Availability slots" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	async findAllForVet(@CurrentTenant() tenant: TenantContext, @Param("vetId") vetId: string) {
		return this.availabilityService.findAllForVet(tenant.id, vetId);
	}

	@Post("vets/:vetId/slots")
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@HttpCode(HttpStatus.CREATED)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a weekly availability slot for a vet" })
	@ApiResponse({ status: 201, description: "Availability slot created" })
	@ApiResponse({ status: 400, description: "Invalid time range" })
	@ApiResponse({ status: 403, description: "Only ADMIN can create slots" })
	@ApiResponse({ status: 404, description: "Vet not found in this clinic" })
	@ApiResponse({ status: 409, description: "Overlapping slot" })
	async create(
		@CurrentTenant() tenant: TenantContext,
		@Param("vetId") vetId: string,
		@Body() dto: CreateAvailabilityDto,
	) {
		return this.availabilityService.create(tenant.id, vetId, dto);
	}

	@Delete("slots/:slotId")
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@ApiBearerAuth()
	@ApiOperation({ summary: "Delete an availability slot" })
	@ApiResponse({ status: 200, description: "Availability slot deleted" })
	@ApiResponse({ status: 403, description: "Only ADMIN can delete slots" })
	@ApiResponse({ status: 404, description: "Slot not found" })
	async delete(@CurrentTenant() tenant: TenantContext, @Param("slotId") slotId: string) {
		return this.availabilityService.delete(tenant.id, slotId);
	}
}
