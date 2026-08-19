import type { VetAvailability } from "@/database/prisma";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { CreateAvailabilityDto } from "../../src/modules/availability/dto/create-availability.dto";
import { AvailabilityRepository } from "../../src/modules/availability/repositories/availability.repository";
import { AvailabilityService } from "../../src/modules/availability/services/availability.service";
import { UserRepository } from "../../src/modules/users/repositories/user.repository";

describe("AvailabilityService", () => {
	let service: AvailabilityService;
	let availabilityRepository: jest.Mocked<AvailabilityRepository>;
	let userRepository: jest.Mocked<UserRepository>;

	const mockAvailabilityRepository = {
		findByVetAndDay: jest.fn(),
		createAvailability: jest.fn(),
		deleteAvailability: jest.fn(),
	};

	const mockUserRepository = {
		findUserTenant: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AvailabilityService,
				{ provide: AvailabilityRepository, useValue: mockAvailabilityRepository },
				{ provide: UserRepository, useValue: mockUserRepository },
			],
		}).compile();

		service = module.get<AvailabilityService>(AvailabilityService);
		availabilityRepository = module.get(
			AvailabilityRepository,
		) as jest.Mocked<AvailabilityRepository>;
		userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("create", () => {
		it("should create a valid availability slot", async () => {
			userRepository.findUserTenant.mockResolvedValue({
				id: "ut-1",
				userId: "vet-1",
				tenantId: "tenant-1",
				role: "VET",
			});
			availabilityRepository.findByVetAndDay.mockResolvedValue([]);
			const dto: CreateAvailabilityDto = {
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			};
			const mockSlot: VetAvailability = {
				id: "slot-1",
				vetId: "vet-1",
				tenantId: "tenant-1",
				...dto,
				createdAt: new Date(),
				updatedAt: new Date(),
			} as VetAvailability;
			availabilityRepository.createAvailability.mockResolvedValue(mockSlot);

			const result = await service.create("tenant-1", "vet-1", dto);

			expect(result).toEqual(mockSlot);
			expect(availabilityRepository.createAvailability).toHaveBeenCalledWith("tenant-1", {
				vetId: "vet-1",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			});
		});

		it("should reject cross-midnight blocks", async () => {
			userRepository.findUserTenant.mockResolvedValue({
				id: "ut-1",
				userId: "vet-1",
				tenantId: "tenant-1",
				role: "VET",
			});
			const dto: CreateAvailabilityDto = {
				dayOfWeek: 1,
				startTime: "22:00",
				endTime: "02:00",
			};

			await expect(service.create("tenant-1", "vet-1", dto)).rejects.toThrow(BadRequestException);
			expect(availabilityRepository.createAvailability).not.toHaveBeenCalled();
		});

		it("should reject overlapping slots", async () => {
			userRepository.findUserTenant.mockResolvedValue({
				id: "ut-1",
				userId: "vet-1",
				tenantId: "tenant-1",
				role: "VET",
			});
			availabilityRepository.findByVetAndDay.mockResolvedValue([
				{
					id: "slot-1",
					vetId: "vet-1",
					tenantId: "tenant-1",
					dayOfWeek: 1,
					startTime: "09:00",
					endTime: "13:00",
					createdAt: new Date(),
					updatedAt: new Date(),
				} as VetAvailability,
			]);
			const dto: CreateAvailabilityDto = {
				dayOfWeek: 1,
				startTime: "12:00",
				endTime: "14:00",
			};

			await expect(service.create("tenant-1", "vet-1", dto)).rejects.toThrow(ConflictException);
			expect(availabilityRepository.createAvailability).not.toHaveBeenCalled();
		});

		it("should reject when vet does not belong to tenant", async () => {
			userRepository.findUserTenant.mockResolvedValue(null);
			const dto: CreateAvailabilityDto = {
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			};

			await expect(service.create("tenant-1", "vet-1", dto)).rejects.toThrow(NotFoundException);
			expect(availabilityRepository.findByVetAndDay).not.toHaveBeenCalled();
		});
	});

	describe("findAllForVet", () => {
		it("should return slots for a vet", async () => {
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
				} as VetAvailability,
			];
			availabilityRepository.findByVetAndDay.mockResolvedValue(mockSlots);

			const result = await service.findAllForVet("tenant-1", "vet-1");

			expect(result).toEqual(mockSlots);
			expect(availabilityRepository.findByVetAndDay).toHaveBeenCalledWith("tenant-1", "vet-1");
		});
	});

	describe("delete", () => {
		it("should delete an existing slot", async () => {
			availabilityRepository.deleteAvailability.mockResolvedValue({ count: 1 });

			const result = await service.delete("tenant-1", "slot-1");

			expect(result).toEqual({ count: 1 });
		});

		it("should throw NotFoundException when slot does not exist", async () => {
			availabilityRepository.deleteAvailability.mockResolvedValue({ count: 0 });

			await expect(service.delete("tenant-1", "slot-1")).rejects.toThrow(NotFoundException);
		});
	});
});
