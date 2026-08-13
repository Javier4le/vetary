import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../src/database/prisma.service";
import { VetProfileRepository } from "../../../src/modules/vet-profiles/repositories/vet-profile.repository";
import type { VetProfile } from "@prisma/client";

// 🧪 TEST: VetProfileRepository — aislamiento por tenant para perfiles de veterinarios
// Strict TDD: tests escritos antes/durante la implementación

describe("VetProfileRepository", () => {
	let repository: VetProfileRepository;

	const mockPrismaService = {
		vetProfile: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			updateMany: jest.fn(),
			deleteMany: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VetProfileRepository,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		repository = module.get<VetProfileRepository>(VetProfileRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should be defined", () => {
		expect(repository).toBeDefined();
	});

	describe("findAllByTenant", () => {
		it("should return vet profiles scoped to tenant", async () => {
			const mockProfiles: VetProfile[] = [
				{
					id: "vp-1",
					userId: "user-1",
					tenantId: "tenant-1",
					specialty: "Cirugía",
					registrationNumber: "REG-123",
					bio: "Especialista en cirugía veterinaria",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			] as VetProfile[];

			mockPrismaService.vetProfile.findMany.mockResolvedValue(mockProfiles);

			const result = await repository.findAllByTenant("tenant-1");

			expect(result).toEqual(mockProfiles);
			expect(mockPrismaService.vetProfile.findMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-1" },
			});
		});
	});

	describe("findByIdAndTenant", () => {
		it("should find vet profile by id within tenant", async () => {
			const mockProfile: VetProfile = {
				id: "vp-1",
				userId: "user-1",
				tenantId: "tenant-1",
				specialty: "Dermatología",
				registrationNumber: null,
				bio: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			} as VetProfile;

			mockPrismaService.vetProfile.findFirst.mockResolvedValue(mockProfile);

			const result = await repository.findByIdAndTenant("tenant-1", "vp-1");

			expect(result).toEqual(mockProfile);
			expect(mockPrismaService.vetProfile.findFirst).toHaveBeenCalledWith({
				where: { id: "vp-1", tenantId: "tenant-1" },
			});
		});
	});

	describe("findByUserIdAndTenant", () => {
		it("should find vet profile by user id within tenant", async () => {
			const mockProfile: VetProfile = {
				id: "vp-1",
				userId: "user-1",
				tenantId: "tenant-1",
				specialty: "Cardiología",
				registrationNumber: "REG-456",
				bio: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			} as VetProfile;

			mockPrismaService.vetProfile.findFirst.mockResolvedValue(mockProfile);

			const result = await repository.findByUserIdAndTenant("tenant-1", "user-1");

			expect(result).toEqual(mockProfile);
			expect(mockPrismaService.vetProfile.findFirst).toHaveBeenCalledWith({
				where: { userId: "user-1", tenantId: "tenant-1" },
			});
		});
	});

	describe("createVetProfile", () => {
		it("should create vet profile with tenantId automatically injected", async () => {
			const data = {
				userId: "user-1",
				specialty: "Medicina interna",
				registrationNumber: "REG-789",
				bio: "Veterinaria general",
			};
			const mockProfile: VetProfile = {
				id: "vp-1",
				...data,
				tenantId: "tenant-1",
				createdAt: new Date(),
				updatedAt: new Date(),
			} as VetProfile;

			mockPrismaService.vetProfile.create.mockResolvedValue(mockProfile);

			const result = await repository.createVetProfile("tenant-1", data);

			expect(result).toEqual(mockProfile);
			expect(mockPrismaService.vetProfile.create).toHaveBeenCalledWith({
				data: { tenantId: "tenant-1", ...data },
			});
		});
	});

	describe("updateVetProfile", () => {
		it("should update vet profile with double filter", async () => {
			mockPrismaService.vetProfile.updateMany.mockResolvedValue({ count: 1 });

			const result = await repository.updateVetProfile("tenant-1", "vp-1", {
				specialty: "Nueva especialidad",
			});

			expect(result).toEqual({ count: 1 });
			expect(mockPrismaService.vetProfile.updateMany).toHaveBeenCalledWith({
				where: { id: "vp-1", tenantId: "tenant-1" },
				data: { specialty: "Nueva especialidad" },
			});
		});
	});

	describe("deleteVetProfile", () => {
		it("should delete vet profile with double filter", async () => {
			mockPrismaService.vetProfile.deleteMany.mockResolvedValue({ count: 1 });

			const result = await repository.deleteVetProfile("tenant-1", "vp-1");

			expect(result).toEqual({ count: 1 });
			expect(mockPrismaService.vetProfile.deleteMany).toHaveBeenCalledWith({
				where: { id: "vp-1", tenantId: "tenant-1" },
			});
		});
	});

	describe("tenant isolation", () => {
		it("should throw when tenantId is missing", async () => {
			await expect(repository.findAllByTenant("")).rejects.toThrow();
		});
	});
});
