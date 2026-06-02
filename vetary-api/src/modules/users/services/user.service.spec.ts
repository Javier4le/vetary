import { ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../database/prisma.service";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "./user.service";
import type { CreateUserDto } from "../dto/create-user.dto";
import type { Role } from "@prisma/client";

// 🧪 TEST: UserService — gestión de usuarios con scope por tenant
// Strict TDD: estos tests SE ESCRIBEN ANTES de la implementación
//
// ⚡ PRINCIPIO: Un test por comportamiento (no por método)
// La seguridad del aislamiento de datos se testea explícitamente

describe("UserService", () => {
	let service: UserService;
	let userRepository: {
		findByEmail: jest.Mock;
		findUserTenant: jest.Mock;
		findUsersInTenant: jest.Mock;
		createUser: jest.Mock;
		createUserTenant: jest.Mock;
	};
	let prismaService: { $transaction: jest.Mock };

	const tenantA = { id: "tenant-a", name: "Clínica A", subdomain: "clinica-a" };
	const tenantB = { id: "tenant-b", name: "Clínica B", subdomain: "clinica-b" };

	beforeEach(async () => {
		userRepository = {
			findByEmail: jest.fn(),
			findUserTenant: jest.fn(),
			findUsersInTenant: jest.fn(),
			createUser: jest.fn(),
			createUserTenant: jest.fn(),
		};

		prismaService = {
			$transaction: jest
				.fn()
				.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
					const txMock = {
						user: { create: jest.fn() },
						userTenant: { create: jest.fn() },
					};
					return callback(txMock);
				}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserService,
				{ provide: UserRepository, useValue: userRepository },
				{ provide: PrismaService, useValue: prismaService },
			],
		}).compile();

		service = module.get<UserService>(UserService);
	});

	describe("findUsersInTenant()", () => {
		it("should return users scoped to the specified tenant via UserTenant join", async () => {
			// 🔧 MOCK: findUsersInTenant returns UserTenant[] with user included
			const mockUserTenants = [
				{
					id: "ut-1",
					userId: "user-1",
					tenantId: tenantA.id,
					role: "ADMIN" as Role,
					user: { id: "user-1", email: "admin@clinica-a.com", firstName: "Juan", lastName: "Pérez", createdAt: new Date(), updatedAt: new Date() },
				},
				{
					id: "ut-2",
					userId: "user-2",
					tenantId: tenantA.id,
					role: "VET" as Role,
					user: { id: "user-2", email: "vet@clinica-a.com", firstName: "María", lastName: "López", createdAt: new Date(), updatedAt: new Date() },
				},
			];

			userRepository.findUsersInTenant.mockResolvedValue(mockUserTenants);

			const result = await service.findUsersInTenant(tenantA.id);

			expect(userRepository.findUsersInTenant).toHaveBeenCalledWith(tenantA.id);
			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("user-1");
			expect(result[0].role).toBe("ADMIN");
			expect(result[1].id).toBe("user-2");
			expect(result[1].role).toBe("VET");
		});

		it("should NOT return users from tenantB when querying tenantA (cross-tenant isolation)", async () => {
			const tenantAUserTenants = [
				{
					id: "ut-a1", userId: "user-a1", tenantId: tenantA.id, role: "ADMIN" as Role,
					user: { id: "user-a1", email: "admin@clinica-a.com", firstName: "Juan", lastName: "Pérez", createdAt: new Date(), updatedAt: new Date() },
				},
				{
					id: "ut-a2", userId: "user-a2", tenantId: tenantA.id, role: "VET" as Role,
					user: { id: "user-a2", email: "vet@clinica-a.com", firstName: "María", lastName: "López", createdAt: new Date(), updatedAt: new Date() },
				},
			];

			const tenantBUserTenants = [
				{
					id: "ut-b1", userId: "user-b1", tenantId: tenantB.id, role: "ADMIN" as Role,
					user: { id: "user-b1", email: "admin@clinica-b.com", firstName: "Carlos", lastName: "Gómez", createdAt: new Date(), updatedAt: new Date() },
				},
			];

			userRepository.findUsersInTenant.mockImplementation((tenantId: string) => {
				if (tenantId === tenantA.id) return Promise.resolve(tenantAUserTenants);
				if (tenantId === tenantB.id) return Promise.resolve(tenantBUserTenants);
				return Promise.resolve([]);
			});

			const resultA = await service.findUsersInTenant(tenantA.id);
			const resultB = await service.findUsersInTenant(tenantB.id);

			// 🔒 SEGURIDAD: Tenant A users should not appear in Tenant B results
			expect(resultA).toHaveLength(2);
			expect(resultB).toHaveLength(1);
			expect(resultA.map((u: any) => u.id)).toEqual(["user-a1", "user-a2"]);
			expect(resultB.map((u: any) => u.id)).toEqual(["user-b1"]);
		});

		it("should show same user in two tenants with different roles", async () => {
			const userId = "user-maria";
			const tenantAUserTenants = [
				{
					id: "ut-a", userId, tenantId: tenantA.id, role: "ADMIN" as Role,
					user: { id: userId, email: "maria@vet.com", firstName: "María", lastName: "López", createdAt: new Date(), updatedAt: new Date() },
				},
			];
			const tenantBUserTenants = [
				{
					id: "ut-b", userId, tenantId: tenantB.id, role: "VET" as Role,
					user: { id: userId, email: "maria@vet.com", firstName: "María", lastName: "López", createdAt: new Date(), updatedAt: new Date() },
				},
			];

			userRepository.findUsersInTenant.mockImplementation((tenantId: string) => {
				if (tenantId === tenantA.id) return Promise.resolve(tenantAUserTenants);
				if (tenantId === tenantB.id) return Promise.resolve(tenantBUserTenants);
				return Promise.resolve([]);
			});

			const resultA = await service.findUsersInTenant(tenantA.id);
			const resultB = await service.findUsersInTenant(tenantB.id);

			// 🔒 SEGURIDAD: Same user, different roles in different tenants
			expect(resultA[0].role).toBe("ADMIN");
			expect(resultB[0].role).toBe("VET");
		});
	});

	describe("createUser()", () => {
		const newUserDto: CreateUserDto = {
			email: "newvet@example.com",
			password: "SecurePass123",
			firstName: "Carlos",
			lastName: "Gómez",
			role: "VET" as Role,
		};

		it("should create User + UserTenant atomically when email is NEW", async () => {
			const mockUser = {
				id: "user-new",
				email: "newvet@example.com",
				firstName: "Carlos",
				lastName: "Gómez",
				passwordHash: "hashed-pass",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const mockUserTenant = {
				id: "ut-new",
				userId: "user-new",
				tenantId: tenantA.id,
				role: "VET",
			};

			userRepository.findByEmail.mockResolvedValue(null); // No existing user

			prismaService.$transaction.mockImplementation(
				async (callback: (tx: any) => Promise<any>) => {
					const txMock = {
						user: { create: jest.fn().mockResolvedValue(mockUser) },
						userTenant: { create: jest.fn().mockResolvedValue(mockUserTenant) },
					};
					return callback(txMock);
				},
			);

			const result = await service.createUser(tenantA.id, newUserDto);

			// User was created (because email was new)
			expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
			expect(result).toBeDefined();
			expect(result.id).toBe("user-new");
		});

		it("should reuse existing User and create new UserTenant when email exists but not in this tenant", async () => {
			const existingUser = {
				id: "user-existing",
				email: "maria@vet.com",
				firstName: "María",
				lastName: "López",
				passwordHash: "existing-hash",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUserTenant = {
				id: "ut-reused",
				userId: existingUser.id,
				tenantId: tenantB.id,
				role: "VET",
			};

			// User exists (created for Tenant A)
			userRepository.findByEmail.mockResolvedValue(existingUser);
			// But no UserTenant for THIS tenant (Tenant B)
			userRepository.findUserTenant.mockResolvedValue(null);
			// The repository creates the UserTenant and returns it
			userRepository.createUserTenant.mockResolvedValue(mockUserTenant);

			const dto: CreateUserDto = {
				email: "maria@vet.com",
				password: "SomePass123", // Will be ignored for existing user
				firstName: "María",
				lastName: "López",
				role: "VET" as Role,
			};

			const result = await service.createUser(tenantB.id, dto);

			expect(result).toBeDefined();
			expect(result.id).toBe("user-existing");
			expect(result.role).toBe("VET");
		});

		it("should throw ConflictException when user with email already has UserTenant in this tenant", async () => {
			const existingUser = {
				id: "user-existing",
				email: "maria@vet.com",
				firstName: "María",
				lastName: "López",
				passwordHash: "existing-hash",
			};

			const existingUserTenant = {
				id: "ut-existing",
				userId: existingUser.id,
				tenantId: tenantA.id,
				role: "ADMIN",
			};

			// User exists
			userRepository.findByEmail.mockResolvedValue(existingUser);
			// AND already has UserTenant in THIS tenant
			userRepository.findUserTenant.mockResolvedValue(existingUserTenant);

			const dto: CreateUserDto = {
				email: "maria@vet.com",
				password: "SomePass123",
				firstName: "María",
				lastName: "López",
				role: "VET" as Role,
			};

			await expect(service.createUser(tenantA.id, dto)).rejects.toThrow(
				ConflictException,
			);
		});
	});
});
