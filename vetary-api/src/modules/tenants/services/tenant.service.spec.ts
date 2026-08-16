import { PrismaService } from "@/database/prisma.service";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { RegisterTenantDto } from "../dto/register-tenant.dto";
import { TenantRepository } from "../repositories/tenant.repository";
import { TenantService } from "./tenant.service";

// 🧪 TEST: TenantService — verifica la lógica de registro de clínicas
// Strict TDD: estos tests se escriben ANTES de la implementación
//
// ⚡ PRINCIPIO: Un test por comportamiento (no por método)
// Cada describe anida los casos del mismo escenario para legibilidad

describe("TenantService", () => {
	let service: TenantService;
	let tenantRepository: {
		existsBySubdomain: jest.Mock;
		create: jest.Mock;
		findBySubdomain: jest.Mock;
	};
	let prismaService: { $transaction: jest.Mock };

	const validDto: RegisterTenantDto = {
		tenantName: "Clínica Las Palmeras",
		subdomain: "laspalmeras",
		adminEmail: "admin@laspalmeras.com",
		adminPassword: "SecurePass123",
		adminFirstName: "Juan",
		adminLastName: "Pérez",
	} as RegisterTenantDto;

	beforeEach(async () => {
		tenantRepository = {
			existsBySubdomain: jest.fn().mockResolvedValue(false),
			create: jest.fn(),
			findBySubdomain: jest.fn(),
		};

		// Prisma $transaction ejecuta el callback con un cliente transaccional
		// En tests, lo simulamos ejecutando el callback directamente con un mock
		prismaService = {
			$transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
				const txMock = {
					tenant: {
						create: jest.fn().mockResolvedValue({
							id: "tenant-1",
							subdomain: "laspalmeras",
							name: "Clínica Las Palmeras",
							status: "ACTIVE",
							createdAt: new Date(),
							updatedAt: new Date(),
						}),
					},
					user: {
						create: jest.fn().mockResolvedValue({
							id: "user-1",
							email: "admin@laspalmeras.com",
							firstName: "Juan",
							lastName: "Pérez",
							passwordHash: "hashed",
							createdAt: new Date(),
							updatedAt: new Date(),
						}),
					},
					userTenant: {
						create: jest.fn().mockResolvedValue({
							id: "ut-1",
							userId: "user-1",
							tenantId: "tenant-1",
							role: "ADMIN",
						}),
					},
				};
				return callback(txMock);
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TenantService,
				{ provide: TenantRepository, useValue: tenantRepository },
				{ provide: PrismaService, useValue: prismaService },
			],
		}).compile();

		service = module.get<TenantService>(TenantService);
	});

	// ─── Registro exitoso ──────────────────────────────────────────────────────

	describe("register()", () => {
		it("should register tenant, user, and userTenant in a single transaction", async () => {
			const result = await service.register(validDto);

			// 🧪 La transacción se ejecutó
			expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
			// 🧪 El resultado contiene el tenant creado
			expect(result.tenant.subdomain).toBe("laspalmeras");
			// 🧪 El password no se expone en la respuesta
			expect(result).not.toHaveProperty("password");
		});

		// ─── Validación de subdominio ──────────────────────────────────────────

		it("should throw ConflictException when subdomain already exists", async () => {
			tenantRepository.existsBySubdomain.mockResolvedValue(true);

			await expect(service.register(validDto)).rejects.toThrow(ConflictException);
		});

		it.each([
			["admin", "admin"],
			["api", "api"],
			["www", "www"],
			["app", "app"],
			["auth", "auth"],
			["super", "super"],
			["root", "root"],
			["vetary", "vetary"],
		])("should throw BadRequestException for reserved subdomain '%s'", async (subdomain) => {
			const dto = { ...validDto, subdomain } as RegisterTenantDto;
			await expect(service.register(dto)).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for subdomain shorter than 3 chars", async () => {
			const dto = { ...validDto, subdomain: "ab" } as RegisterTenantDto;
			await expect(service.register(dto)).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for subdomain longer than 63 chars", async () => {
			const longSubdomain = "a".repeat(64);
			const dto = {
				...validDto,
				subdomain: longSubdomain,
			} as RegisterTenantDto;
			await expect(service.register(dto)).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for invalid subdomain format (uppercase)", async () => {
			const dto = {
				...validDto,
				subdomain: "LasPalmeras",
			} as RegisterTenantDto;
			await expect(service.register(dto)).rejects.toThrow(BadRequestException);
		});

		it("should throw BadRequestException for invalid subdomain format (special chars)", async () => {
			const dto = {
				...validDto,
				subdomain: "las_palmeras",
			} as RegisterTenantDto;
			await expect(service.register(dto)).rejects.toThrow(BadRequestException);
		});

		// ─── Atomicidad de la transacción ──────────────────────────────────────

		it("should rollback entire transaction when user creation fails", async () => {
			// Simulamos que la creación del user falla dentro de la transacción
			prismaService.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
				const txMock = {
					tenant: { create: jest.fn().mockResolvedValue({ id: "tenant-1" }) },
					user: {
						create: jest.fn().mockRejectedValue(new Error("Unique constraint violation on email")),
					},
					userTenant: { create: jest.fn() },
				};
				return callback(txMock); // Prisma hace rollback automático si el callback lanza
			});

			await expect(service.register(validDto)).rejects.toThrow();
			// El $transaction se llamó (intento), pero el callback falló → rollback automático
			expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
		});
	});
});
