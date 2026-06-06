import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Role } from "@prisma/client";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { CreateUserDto } from "../dto/create-user.dto";
import { UserService } from "../services/user.service";

// 🏗️ ARQUITECTURA: UserController — solo recibe, delega, responde
// Cero lógica de negocio. El controller es un conector HTTP → Service
// ⚡ PRINCIPIO: Thin Controller — delegar al máximo, no calcular aquí

@ApiTags("Users")
@Controller("users")
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get()
	@UseGuards(AuthGuard("jwt"))
	@ApiOperation({ summary: "List all users in current clinic" })
	@ApiResponse({ status: 200, description: "Users in current clinic" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 403, description: "Forbidden" })
	async findUsersInTenant(@CurrentTenant() tenant: any) {
		return this.userService.findUsersInTenant(tenant.id);
	}

	@Post()
	@Roles(Role.ADMIN)
	@UseGuards(AuthGuard("jwt"))
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Create a new user in current clinic" })
	@ApiResponse({ status: 201, description: "User created successfully" })
	@ApiResponse({ status: 409, description: "User already exists in this clinic" })
	@ApiResponse({ status: 403, description: "Only ADMIN can create users" })
	async createUser(
		@CurrentTenant() tenant: any,
		@Body() dto: CreateUserDto,
	) {
		return this.userService.createUser(tenant.id, dto);
	}

	@Get("me")
	@UseGuards(AuthGuard("jwt"))
	@ApiOperation({ summary: "Get current user info" })
	@ApiResponse({ status: 200, description: "Current user" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	async getCurrentUser(
		@CurrentUser() user: any,
		@CurrentTenant() tenant: any,
	) {
		return this.userService.findUsersInTenant(tenant.id).then((users) => {
			const current = users.find((u) => u.id === user.userId);
			return current ?? user;
		});
	}
}
