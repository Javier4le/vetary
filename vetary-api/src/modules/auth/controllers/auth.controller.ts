import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentTenant } from "../../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { LoginDto } from "../dto/login.dto";
import { RefreshTokenDto } from "../dto/refresh-token.dto";
import { AuthService } from "../services/auth.service";

// 🏗️ ARQUITECTURA: AuthController — capa HTTP de autenticación
// Solo traduce HTTP ↔ Service. No lógica de negocio aquí.
// 📐 PATRÓN: Controller — recibe requests, delega a Service, devuelve responses
// ⚡ PRINCIPIO: Separation of Concerns — HTTP aquí, lógica en AuthService

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	/**
	 * POST /auth/login
	 * Autentica un usuario y devuelve par de tokens (access + refresh)
	 *
	 * 🔒 SEGURIDAD: @Public() — no requiere JWT (es el punto de entrada)
	 */
	@Post("login")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Authenticate user and get tokens" })
	@ApiResponse({
		status: 200,
		description: "Login successful — returns access and refresh tokens",
		schema: {
			example: {
				accessToken: "eyJhbGciOiJIUzI1NiIs...",
				refreshToken: "550e8400-e29b-41d4-a716-446655440000",
			},
		},
	})
	@ApiResponse({ status: 401, description: "Invalid credentials" })
	@ApiResponse({ status: 403, description: "User not member of this clinic" })
	async login(@Body() dto: LoginDto) {
		return this.authService.login(dto.email, dto.password, dto.tenantId);
	}

	/**
	 * POST /auth/logout
	 * Revoca el refresh token (cierra sesión)
	 *
	 * 🔒 SEGURIDAD: Requiere JWT válido + refresh token en body
	 */
	@Post("logout")
	@UseGuards(AuthGuard("jwt"))
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Logout — revoke refresh token" })
	@ApiResponse({ status: 204, description: "Logout successful" })
	@ApiResponse({ status: 401, description: "Invalid or expired token" })
	async logout(@Body() dto: RefreshTokenDto): Promise<void> {
		await this.authService.logout(dto.refreshToken);
	}

	/**
	 * POST /auth/refresh
	 * Genera nuevo par de tokens usando un refresh token válido
	 *
	 * 🔒 SEGURIDAD: @Public() — no requiere JWT (el refresh token es la credencial)
	 * Token Rotation: el refresh token anterior se revoca automáticamente
	 */
	@Post("refresh")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Refresh access token using refresh token" })
	@ApiResponse({
		status: 200,
		description: "New token pair generated",
		schema: {
			example: {
				accessToken: "eyJhbGciOiJIUzI1NiIs...",
				refreshToken: "new-uuid-refresh-token",
			},
		},
	})
	@ApiResponse({
		status: 401,
		description: "Invalid, expired or revoked refresh token",
	})
	async refresh(@Body() dto: RefreshTokenDto) {
		return this.authService.refresh(dto.refreshToken);
	}

	/**
	 * GET /auth/me
	 * Devuelve la identidad del usuario autenticado
	 *
	 * 🔒 SEGURIDAD: Requiere JWT válido
	 * @CurrentUser() inyecta el payload del JWT (userId, tenantId, role, email)
	 * @CurrentTenant() inyecta el tenant resuelto por TenantMiddleware
	 */
	@Get("me")
	@UseGuards(AuthGuard("jwt"))
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get current authenticated user" })
	@ApiResponse({
		status: 200,
		description: "Current user identity",
		schema: {
			example: {
				userId: "user-uuid",
				email: "vet@clinica.com",
				role: "VET",
				tenantId: "tenant-uuid",
			},
		},
	})
	@ApiResponse({ status: 401, description: "Unauthorized" })
	async me(
		@CurrentUser()
		user: {
			userId: string;
			tenantId: string;
			role: string;
			email: string;
		},
		@CurrentTenant() tenant: unknown,
	) {
		return {
			userId: user.userId,
			email: user.email,
			role: user.role,
			tenantId: user.tenantId,
			tenant: tenant || null,
		};
	}
}
