import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ServiceRepository } from "../../../src/modules/services/repositories/service.repository";
import { ServicesService } from "../../../src/modules/services/services/service.service";
import type { CreateServiceDto } from "../../../src/modules/services/dto/create-service.dto";

describe("ServicesService (Integration)", () => {
	let service: ServicesService;
	let repository: jest.Mocked<ServiceRepository>;

	const mockRepository = {
		findAllByTenant: jest.fn(),
		findByIdAndTenant: jest.fn(),
		createService: jest.fn(),
		updateService: jest.fn(),
		softDisable: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ServicesService,
				{ provide: ServiceRepository, useValue: mockRepository },
			],
		}).compile();

		service = module.get<ServicesService>(ServicesService);
		repository = module.get(ServiceRepository) as jest.Mocked<ServiceRepository>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("create", () => {
		it("should create a service with valid data", async () => {
			const dto: CreateServiceDto = {
				name: "Consulta General",
				description: "Consulta veterinaria general",
				durationMinutes: 30,
				priceClp: 25000,
			};
			const mockService = {
				id: "1",
				...dto,
				tenantId: "tenant-1",
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			repository.createService.mockResolvedValue(mockService as any);
			const result = await service.create("tenant-1", dto);
			expect(result).toEqual(mockService);
			expect(repository.createService).toHaveBeenCalledWith("tenant-1", {
				...dto,
				isActive: true,
			});
		});

		it("should reject invalid duration", async () => {
			const dto: CreateServiceDto = {
				name: "Consulta General",
				durationMinutes: 0,
				priceClp: 25000,
			};
			await expect(service.create("tenant-1", dto)).rejects.toThrow(
				"Duration must be at least 1 minute",
			);
		});

		it("should reject negative price", async () => {
			const dto: CreateServiceDto = {
				name: "Consulta General",
				durationMinutes: 30,
				priceClp: -100,
			};
			await expect(service.create("tenant-1", dto)).rejects.toThrow("Price cannot be negative");
		});
	});

	describe("findAll", () => {
		it("should return all services for a tenant", async () => {
			const mockServices = [
				{
					id: "1",
					name: "Consulta General",
					tenantedId: "tenant-1",
					priceClp: 25000,
					isActive: true,
				},
			];
			repository.findAllByTenant.mockResolvedValue(mockServices as any);
			const result = await service.findAll("tenant-1");
			expect(result).toEqual(mockServices);
			expect(repository.findAllByTenant).toHaveBeenCalledWith("tenant-1");
		});
	});

	describe("findOne", () => {
		it("should return a service by id", async () => {
			const mockService = {
				id: "1",
				name: "Consulta General",
				tenantedId: "tenant-1",
				priceClp: 25000,
				isActive: true,
			};
			repository.findByIdAndTenant.mockResolvedValue(mockService as any);
			const result = await service.findOne("tenant-1", "1");
			expect(result).toEqual(mockService);
		});

		it("should throw NotFoundException when service not found", async () => {
			repository.findByIdAndTenant.mockResolvedValue(null);
			await expect(service.findOne("tenant-1", "999")).rejects.toThrow(NotFoundException);
		});
	});

	describe("disable", () => {
		it("should soft disable a service", async () => {
			const mockService = {
				id: "1",
				name: "Consulta General",
				tenantedId: "tenant-1",
				priceClp: 25000,
				isActive: false,
			};
			repository.softDisable.mockResolvedValue(mockService as any);
			const result = await service.disable("tenant-1", "1");
			expect(result).toEqual(mockService);
			expect(repository.softDisable).toHaveBeenCalledWith("tenant-1", "1");
		});

		it("should throw NotFoundException when service not found", async () => {
			repository.softDisable.mockResolvedValue(null);
			await expect(service.disable("tenant-1", "999")).rejects.toThrow(NotFoundException);
		});
	});
});
