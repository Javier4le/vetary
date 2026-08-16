import { Public } from "@/common/decorators/public.decorator";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { RegisterTenantDto } from "../dto/register-tenant.dto";
import { TenantService } from "../services/tenant.service";

// 🏗️ ARQUITECTURA: Controller — solo recibe la request, delega al service, devuelve respuesta
// CERO lógica de negocio aquí. Si el controller tiene un if, algo está mal.
// ⚡ PRINCIPIO: Single Responsibility — un controller, un recurso HTTP

@ApiTags("Tenants")
@Controller("tenants")
export class TenantController {
	constructor(private readonly tenantService: TenantService) {}

	// 📐 PATRÓN: @Public() — este endpoint NO requiere autenticación
	// Es el punto de entrada del sistema: una nueva clínica se registra sin estar logueada
	@Public()
	@SkipThrottle()
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new clinic (tenant)" })
	@ApiResponse({
		status: 201,
		description: "Clinic registered successfully. Admin account created.",
	})
	@ApiResponse({
		status: 400,
		description: "Invalid subdomain format or reserved subdomain",
	})
	@ApiResponse({ status: 409, description: "Subdomain already taken" })
	async register(@Body() dto: RegisterTenantDto) {
		return this.tenantService.register(dto);
	}
}
