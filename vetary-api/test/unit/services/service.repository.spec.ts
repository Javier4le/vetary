import { Test, TestingModule } from "@nestjs/testing";
import type { Service } from "@prisma/client";
import { PrismaService } from "../../../src/database/prisma.service";
import { ServiceRepository } from "../../../src/modules/services/repositories/service.repository";

describe("ServiceRepository", () => {
	let repository: ServiceRepository;

	const mockPrismaService = {
		service: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			updateMany: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ServiceRepository, { provide: PrismaService, useValue: mockPrismaService }],
		}).compile();

		repository = module.get<ServiceRepository>(ServiceRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should be defined", () => {
		expect(repository).toBeDefined();
	});

	describe("findAllByTenant", () => {
		it("should return services scoped to tenant", async () => {
			const mockServices: Service[] = [
				{
					id: "1",
					name: "Consulta General",
					tenantId: "tenant-1",
					description: null,
					durationMinutes: 30,
					priceClp: 25000,
					isActive: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			] as Service[];
			mockPrismaService.service.findMany.mockResolvedValue(mockServices);
			const result = await repository.findAllByTenant("tenant-1");
			expect(result).toEqual(mockServices);
			expect(mockPrismaService.service.findMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-1" },
			});
		});
	});

	describe("findByIdAndTenant", () => {
		it("should find service by id within tenant", async () => {
			const mockService: Service = {
				id: "1",
				name: "Consulta General",
				tenantId: "tenant-1",
				description: null,
				durationMinutes: 30,
				priceClp: 25000,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			} as Service;
			mockPrismaService.service.findFirst.mockResolvedValue(mockService);
			const result = await repository.findByIdAndTenant("tenant-1", "1");
			expect(result).toEqual(mockService);
			expect(mockPrismaService.service.findFirst).toHaveBeenCalledWith({
				where: { id: "1", tenantId: "tenant-1" },
			});
		});
	});

	describe("createService", () => {
		it("should create service with tenantId automatically injected", async () => {
			const data = {
				name: "Consulta General",
				description: null as string | null,
				durationMinutes: 30,
				priceClp: 25000,
				isActive: true,
			};
			const mockService: Service = {
				id: "1",
				...data,
				tenantId: "tenant-1",
				createdAt: new Date(),
				updatedAt: new Date(),
			} as Service;
			mockPrismaService.service.create.mockResolvedValue(mockService);
			const result = await repository.createService("tenant-1", data);
			expect(result).toEqual(mockService);
			expect(mockPrismaService.service.create).toHaveBeenCalledWith({
				data: { tenantId: "tenant-1", ...data },
			});
		});
	});

	describe("softDisable", () => {
		it("should set isActive to false", async () => {
			const mockService: Service = {
				id: "1",
				name: "Consulta General",
				tenantId: "tenant-1",
				description: null,
				durationMinutes: 30,
				priceClp: 25000,
				isActive: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			} as Service;
			mockPrismaService.service.updateMany.mockResolvedValue({ count: 1 });
			mockPrismaService.service.findFirst.mockResolvedValue(mockService);
			const result = await repository.softDisable("tenant-1", "1");
			expect(result).toEqual(mockService);
			expect(mockPrismaService.service.updateMany).toHaveBeenCalledWith({
				where: { id: "1", tenantId: "tenant-1" },
				data: { isActive: false },
			});
		});
	});

	describe("tenant isolation", () => {
		it("should throw when tenantId is missing", async () => {
			await expect(repository.findAllByTenant("")).rejects.toThrow();
		});
	});
});
