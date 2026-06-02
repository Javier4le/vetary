import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "../../../config/config.service";
import { PrismaService } from "../../../database/prisma.service";
import { AuthService } from "./auth.service";
import type { Role } from "@prisma/client";

// 🧪 TEST: AuthService — autenticación, tokens y seguridad
// Strict TDD: estos tests SE ESCRIBEN ANTES de la implementación
//
// ⚡ PRINCIPIO: Un test por comportamiento (no por método)
// La seguridad de tokens, hashing y aislamiento se testea explícitamente

describe("AuthService", () => {
	let service: AuthService;
	let prismaService: {
		refreshToken: {
			findUnique: jest.Mock;
			create: jest.Mock;
			update: jest.Mock;
			findFirst: jest.Mock;
		};
		user: {
			findUnique: jest.Mock;
		};
		userTenant: {
			findFirst: jest.Mock;
		};
	};
	let jwtService: { sign: jest.Mock };
	let configService: {
		bcryptRounds: number;
		jwtSecret: string;
		jwtExpiration: string;
		refreshTokenExpiration: string;
	};

	const mockUser = {
		id: "user-1",
		email: "vet@clinica.com",
		passwordHash: "$2b$10$abcdefghijklmnopqrstuvwx1234567890abcdefghijklmn",
		firstName: "Juan",
		lastName: "Pérez",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUserTenant = {
		id: "ut-1",
		userId: "user-1",
		tenantId: "tenant-a",
		role: "VET" as Role,
	};

	const mockRefreshToken = {
		id: "rt-1",
		token: "550e8400-e29b-41d4-a716-446655440000",
		userId: "user-1",
		tenantId: "tenant-a",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		revokedAt: null,
		createdAt: new Date(),
	};

	beforeEach(async () => {
		prismaService = {
			refreshToken: {
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				findFirst: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
			userTenant: {
				findFirst: jest.fn(),
			},
		};

		jwtService = {
			sign: jest.fn(),
		};

		configService = {
			bcryptRounds: 10,
			jwtSecret: "test-secret",
			jwtExpiration: "15m",
			refreshTokenExpiration: "7d",
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: PrismaService, useValue: prismaService },
				{ provide: ConfigService, useValue: configService },
				{ provide: JwtService, useValue: jwtService },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	describe("hashPassword()", () => {
		it("should return a bcrypt hash starting with $2b$", async () => {
			const password = "SecurePass123!";
			const hash = await service.hashPassword(password);

			// 🔒 SEGURIDAD: bcrypt hashes empiezan con $2b$ (versión bcrypt)
			expect(hash).toMatch(/^\$2b\$/);
			expect(hash.length).toBeGreaterThan(20); // bcrypt hashes son largos
		});

		it("should produce different hashes for same password (salted)", async () => {
			const password = "SecurePass123!";
			const hash1 = await service.hashPassword(password);
			const hash2 = await service.hashPassword(password);

			// 🔒 SEGURIDAD: Salts únicos → hashes diferentes cada vez
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("comparePasswords()", () => {
		it("should return true for matching password and hash", async () => {
			const password = "SecurePass123!";
			const hash = await service.hashPassword(password);

			const result = await service.comparePasswords(password, hash);
			expect(result).toBe(true);
		});

		it("should return false for wrong password", async () => {
			const password = "SecurePass123!";
			const hash = await service.hashPassword(password);

			const result = await service.comparePasswords("wrongpassword", hash);
			expect(result).toBe(false);
		});
	});

	describe("login()", () => {
		beforeEach(() => {
			// Use a real bcrypt hash for the mock user so comparePasswords works
			// We'll override this in each test that needs it
			prismaService.user.findUnique.mockResolvedValue(mockUser);
			prismaService.userTenant.findFirst.mockResolvedValue(mockUserTenant);
		});

		it("should return accessToken and refreshToken for valid credentials", async () => {
			// 🔧 Create a real bcrypt hash for the mock user
			const realHash = await service.hashPassword("SecurePass123!");
			prismaService.user.findUnique.mockResolvedValue({
				...mockUser,
				passwordHash: realHash,
			});

			jwtService.sign.mockReturnValueOnce("mock-access-token");

			prismaService.refreshToken.create.mockResolvedValue({
				...mockRefreshToken,
				token: "mock-refresh-token",
			});

			const result = await service.login(
				"vet@clinica.com",
				"SecurePass123!",
				"tenant-a",
			);

			expect(result).toHaveProperty("accessToken", "mock-access-token");
			expect(prismaService.user.findUnique).toHaveBeenCalledWith({
				where: { email: "vet@clinica.com" },
			});
			expect(prismaService.userTenant.findFirst).toHaveBeenCalledWith({
				where: { userId: "user-1", tenantId: "tenant-a" },
			});

			// 🔒 SEGURIDAD: JwtService.sign called ONCE with correct payload (access token)
			expect(jwtService.sign).toHaveBeenCalledTimes(1);
			expect(jwtService.sign).toHaveBeenCalledWith(
				expect.objectContaining({
					sub: "user-1",
					tenantId: "tenant-a",
					role: "VET",
					email: "vet@clinica.com",
				}),
			);

			// 🔒 SEGURIDAD: Access token was generated
			expect(result.accessToken).toBe("mock-access-token");

			// 🔒 SEGURIDAD: Refresh token generated by randomUUID (not jwtService.sign)
			expect(result.refreshToken).toBeDefined();
			expect(typeof result.refreshToken).toBe("string");
			expect(result.refreshToken.length).toBeGreaterThan(10);

			// 🔒 SEGURIDAD: Refresh token stored in DB with expiry
			expect(prismaService.refreshToken.create).toHaveBeenCalled();
		});

		it("should throw UnauthorizedException for wrong password", async () => {
			// Use a real bcrypt hash
			const realHash = await service.hashPassword("SecurePass123!");
			prismaService.user.findUnique.mockResolvedValue({
				...mockUser,
				passwordHash: realHash,
			});

			await expect(
				service.login("vet@clinica.com", "WrongPass123!", "tenant-a"),
			).rejects.toThrow(UnauthorizedException);
		});

		it("should throw UnauthorizedException when user not found", async () => {
			prismaService.user.findUnique.mockResolvedValue(null);

			await expect(
				service.login("nonexistent@clinica.com", "anypass", "tenant-a"),
			).rejects.toThrow(UnauthorizedException);
		});

		it("should throw ForbiddenException when user has no UserTenant for tenantId", async () => {
			const realHash = await service.hashPassword("SecurePass123!");
			prismaService.user.findUnique.mockResolvedValue({
				...mockUser,
				passwordHash: realHash,
			});
			// User exists but has NO membership in this tenant
			prismaService.userTenant.findFirst.mockResolvedValue(null);

			await expect(
				service.login("vet@clinica.com", "SecurePass123!", "tenant-b"),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("refresh()", () => {
		it("should revoke old refresh token and return new pair for valid token", async () => {
			const mockToken = {
				...mockRefreshToken,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				revokedAt: null,
			};

			prismaService.refreshToken.findUnique.mockResolvedValue(mockToken);

			jwtService.sign
				.mockReturnValueOnce("new-access-token")
				.mockReturnValueOnce("new-refresh-token");

			prismaService.userTenant.findFirst.mockResolvedValue(mockUserTenant);
			prismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.refresh(
				"550e8400-e29b-41d4-a716-446655440000",
			);

			// Revocar el token anterior
			expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
				where: { id: "rt-1" },
				data: { revokedAt: expect.any(Date) },
			});

			// Crear nuevo token
			expect(prismaService.refreshToken.create).toHaveBeenCalled();

			// 🔒 SEGURIDAD: Token rotation — nuevo par generado
			expect(result).toHaveProperty("accessToken", "new-access-token");
			expect(result.refreshToken).toBeDefined();
			expect(typeof result.refreshToken).toBe("string");
			expect(result.refreshToken.length).toBeGreaterThan(10);
		});

		it("should throw UnauthorizedException for revoked token", async () => {
			const mockToken = {
				...mockRefreshToken,
				revokedAt: new Date(), // Token ya revocado
			};

			prismaService.refreshToken.findUnique.mockResolvedValue(mockToken);

			await expect(
				service.refresh("550e8400-e29b-41d4-a716-446655440000"),
			).rejects.toThrow(UnauthorizedException);
		});

		it("should throw UnauthorizedException for expired token", async () => {
			const mockToken = {
				...mockRefreshToken,
				expiresAt: new Date(Date.now() - 1000), // Ya expiró
				revokedAt: null,
			};

			prismaService.refreshToken.findUnique.mockResolvedValue(mockToken);

			await expect(
				service.refresh("550e8400-e29b-41d4-a716-446655440000"),
			).rejects.toThrow(UnauthorizedException);
		});

		it("should throw UnauthorizedException for non-existent token", async () => {
			prismaService.refreshToken.findUnique.mockResolvedValue(null);

			await expect(service.refresh("non-existent-token")).rejects.toThrow(
				UnauthorizedException,
			);
		});
	});

	describe("logout()", () => {
		it("should mark refresh token as revoked", async () => {
			const mockToken = {
				...mockRefreshToken,
				revokedAt: null,
			};

			prismaService.refreshToken.findUnique.mockResolvedValue(mockToken);
			prismaService.refreshToken.update.mockResolvedValue({
				...mockToken,
				revokedAt: new Date(),
			});

			await service.logout("550e8400-e29b-41d4-a716-446655440000");

			expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
				where: { id: "rt-1" },
				data: { revokedAt: expect.any(Date) },
			});
		});

		it("should throw UnauthorizedException for non-existent token", async () => {
			prismaService.refreshToken.findUnique.mockResolvedValue(null);

			await expect(service.logout("non-existent-token")).rejects.toThrow(
				UnauthorizedException,
			);
		});
	});
});
