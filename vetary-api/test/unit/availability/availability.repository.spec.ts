import type { VetAvailability } from "@/database/prisma";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../src/database/prisma.service";
import { AvailabilityRepository } from "../../../src/modules/availability/repositories/availability.repository";

describe("AvailabilityRepository", () => {
	let repository: AvailabilityRepository;

	const mockPrismaService = {
		vetAvailability: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			deleteMany: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AvailabilityRepository, { provide: PrismaService, useValue: mockPrismaService }],
		}).compile();

		repository = module.get<AvailabilityRepository>(AvailabilityRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should be defined", () => {
		expect(repository).toBeDefined();
	});

	describe("findByVetAndDay", () => {
		it("should return availability slots scoped to tenant, vet and day", async () => {
			const mockSlots: VetAvailability[] = [
				{
					id: "slot-1",
					vetId: "vet-1",
					tenantId: "tenant-1",
					dayOfWeek: 1,
					startTime: "09:00",
					endTime: "13:00",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			] as VetAvailability[];
			mockPrismaService.vetAvailability.findMany.mockResolvedValue(mockSlots);

			const result = await repository.findByVetAndDay("tenant-1", "vet-1", 1);

			expect(result).toEqual(mockSlots);
			expect(mockPrismaService.vetAvailability.findMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-1", vetId: "vet-1", dayOfWeek: 1 },
			});
		});
	});

	describe("createAvailability", () => {
		it("should create an availability slot with tenantId automatically injected", async () => {
			const data = {
				vetId: "vet-1",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			};
			const mockSlot: VetAvailability = {
				id: "slot-1",
				...data,
				tenantId: "tenant-1",
				createdAt: new Date(),
				updatedAt: new Date(),
			} as VetAvailability;
			mockPrismaService.vetAvailability.create.mockResolvedValue(mockSlot);

			const result = await repository.createAvailability("tenant-1", data);

			expect(result).toEqual(mockSlot);
			expect(mockPrismaService.vetAvailability.create).toHaveBeenCalledWith({
				data: { tenantId: "tenant-1", ...data },
			});
		});
	});

	describe("deleteAvailability", () => {
		it("should delete an availability slot within tenant", async () => {
			mockPrismaService.vetAvailability.deleteMany.mockResolvedValue({ count: 1 });

			const result = await repository.deleteAvailability("tenant-1", "slot-1");

			expect(result).toEqual({ count: 1 });
			expect(mockPrismaService.vetAvailability.deleteMany).toHaveBeenCalledWith({
				where: { id: "slot-1", tenantId: "tenant-1" },
			});
		});
	});

	describe("tenant isolation", () => {
		it("should throw when tenantId is missing", async () => {
			await expect(repository.findByVetAndDay("", "vet-1", 1)).rejects.toThrow();
		});
	});
});
