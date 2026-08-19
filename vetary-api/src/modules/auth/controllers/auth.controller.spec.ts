import { Role } from "@/database/prisma";
import { Test, type TestingModule } from "@nestjs/testing";
import { AuthService } from "../services/auth.service";
import { AuthController } from "./auth.controller";

// 🧪 TEST: AuthController — capa HTTP de autenticación
// Verifica: rutas correctas, delegación a AuthService, estructura de responses
//
// ⚡ PRINCIPIO: Test behavior, not implementation — verificamos QUÉ devuelve, no CÓMO

describe("AuthController", () => {
	let controller: AuthController;
	let authService: {
		login: jest.Mock;
		logout: jest.Mock;
		refresh: jest.Mock;
	};

	beforeEach(async () => {
		authService = {
			login: jest.fn(),
			logout: jest.fn(),
			refresh: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: authService,
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("POST /auth/login", () => {
		it("should call authService.login with email, password, tenantId", async () => {
			const dto = {
				email: "vet@clinica.com",
				password: "SecurePass123!",
				tenantId: "tenant-a",
			};

			authService.login.mockResolvedValue({
				accessToken: "mock-access-token",
				refreshToken: "mock-refresh-token",
			});

			const result = await controller.login(dto);

			expect(authService.login).toHaveBeenCalledWith(
				"vet@clinica.com",
				"SecurePass123!",
				"tenant-a",
			);
			expect(result).toEqual({
				accessToken: "mock-access-token",
				refreshToken: "mock-refresh-token",
			});
		});
	});

	describe("POST /auth/logout", () => {
		it("should call authService.logout with refresh token", async () => {
			const dto = { refreshToken: "some-refresh-token" };

			authService.logout.mockResolvedValue(undefined);

			await controller.logout(dto);

			expect(authService.logout).toHaveBeenCalledWith("some-refresh-token");
		});
	});

	describe("POST /auth/refresh", () => {
		it("should call authService.refresh with refresh token", async () => {
			const dto = { refreshToken: "old-refresh-token" };

			authService.refresh.mockResolvedValue({
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
			});

			const result = await controller.refresh(dto);

			expect(authService.refresh).toHaveBeenCalledWith("old-refresh-token");
			expect(result).toEqual({
				accessToken: "new-access-token",
				refreshToken: "new-refresh-token",
			});
		});
	});

	describe("GET /auth/me", () => {
		it("should return user identity from CurrentUser decorator", async () => {
			const mockUser = {
				userId: "user-1",
				tenantId: "tenant-a",
				role: Role.VET,
				email: "vet@clinica.com",
			};
			const mockTenant = {
				id: "tenant-a",
				name: "Clínica A",
				subdomain: "clinica-a",
				status: "ACTIVE",
			};

			const result = await controller.me(mockUser, mockTenant);

			expect(result).toEqual({
				userId: "user-1",
				email: "vet@clinica.com",
				role: Role.VET,
				tenantId: "tenant-a",
				tenant: mockTenant,
			});
		});

		it("should handle null tenant gracefully", async () => {
			const mockUser = {
				userId: "user-1",
				tenantId: "tenant-a",
				role: Role.VET,
				email: "vet@clinica.com",
			};

			const result = await controller.me(mockUser, null);

			expect(result.tenant).toBeNull();
		});
	});
});
