import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Role } from "@prisma/client";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { CreateServiceDto } from "../dto/create-service.dto";
import { UpdateServiceDto } from "../dto/update-service.dto";
import { ServicesService } from "../services/service.service";

// 🏗️ ARQUITECTURA: ServiceController — solo recibe, delega, responde
// Cero lógica de negocio. El controller es un conector HTTP → Service
// ⚡ PRINCIPIO: Thin Controller — delegar al máximo, no calcular aquí

@ApiTags("Services")
@Controller("services")
export class ServiceController {
	constructor(private readonly servicesService: ServicesService) {}

	@Get()
	@UseGuards(AuthGuard("jwt"))
	@ApiOperation({ summary: "List all services in current clinic" })
	@ApiResponse({ status: 200, description: "Services in current clinic" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	async findAll(@CurrentTenant() tenant: any) {
		return this.servicesService.findAll(tenant.id);
	}

	@Post()
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Create a new service in current clinic" })
	@ApiResponse({ status: 201, description: "Service created successfully" })
	@ApiResponse({ status: 400, description: "Validation error" })
	@ApiResponse({ status: 403, description: "Only ADMIN can create services" })
	async create(
		@CurrentTenant() tenant: any,
		@Body() dto: CreateServiceDto,
	) {
		return this.servicesService.create(tenant.id, dto);
	}

	@Get(":id")
	@UseGuards(AuthGuard("jwt"))
	@ApiOperation({ summary: "Get a service by ID" })
	@ApiResponse({ status: 200, description: "Service found" })
	@ApiResponse({ status: 404, description: "Service not found" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	async findOne(
		@CurrentTenant() tenant: any,
		@Param("id") id: string,
	) {
		return this.servicesService.findOne(tenant.id, id);
	}

	@Patch(":id")
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@ApiOperation({ summary: "Update a service" })
	@ApiResponse({ status: 200, description: "Service updated successfully" })
	@ApiResponse({ status: 404, description: "Service not found" })
	@ApiResponse({ status: 403, description: "Only ADMIN can update services" })
	async update(
		@CurrentTenant() tenant: any,
		@Param("id") id: string,
		@Body() dto: UpdateServiceDto,
	) {
		return this.servicesService.update(tenant.id, id, dto);
	}

	@Delete(":id")
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Soft disable a service" })
	@ApiResponse({ status: 200, description: "Service disabled successfully" })
	@ApiResponse({ status: 404, description: "Service not found" })
	@ApiResponse({ status: 403, description: "Only ADMIN can disable services" })
	async disable(
		@CurrentTenant() tenant: any,
		@Param("id") id: string,
	) {
		return this.servicesService.disable(tenant.id, id);
	}
}
