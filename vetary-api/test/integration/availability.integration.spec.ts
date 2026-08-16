import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../src/database/prisma.service";
import type { CreateAvailabilityDto } from "../../src/modules/availability/dto/create-availability.dto";
import { AvailabilityRepository } from "../../src/modules/availability/repositories/availability.repository";
import { AvailabilityService } from "../../src/modules/availability/services/availability.service";
import { UserRepository } from "../../src/modules/users/repositories/user.repository";
import { UserService } from "../../src/modules/users/services/user.service";

describe("AvailabilityService — PostgreSQL integration", () => {
	let prisma: PrismaService;
	let availabilityService: AvailabilityService;
	let tenantIds: string[];
	let tenantA: { id: string };
	let tenantB: { id: string };
	let vetAId: string;

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.$connect();

		const userRepository = new UserRepository(prisma);
		const userService = new UserService(userRepository, prisma);
		const availabilityRepository = new AvailabilityRepository(prisma);
		availabilityService = new AvailabilityService(availabilityRepository, userRepository);

		const tenants = await Promise.all(
			["a", "b"].map((suffix) =>
				prisma.tenant.create({
					data: {
						name: `PR-3 Availability Tenant ${suffix}`,
						subdomain: `pr3-availability-${suffix}-${randomUUID()}`,
					},
				}),
			),
		);

		[tenantA, tenantB] = tenants;
		tenantIds = tenants.map((tenant) => tenant.id);

		const vetA = await userService.createVet(tenantA.id, {
			email: `pr3.availability.vet@${randomUUID()}.test`,
			firstName: "Vet",
			lastName: "A",
		});
		vetAId = vetA.id;
	});

	afterEach(async () => {
		await prisma.vetAvailability.deleteMany({ where: { tenantId: { in: tenantIds } } });
	});

	afterAll(async () => {
		await prisma.vetAvailability.deleteMany({ where: { tenantId: { in: tenantIds } } });
		await prisma.vetProfile.deleteMany({ where: { tenantId: { in: tenantIds } } });
		await prisma.userTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
		const testUsers = await prisma.user.findMany({
			where: { email: { contains: "pr3.availability." } },
			select: { id: true },
		});
		await prisma.user.deleteMany({ where: { id: { in: testUsers.map((user) => user.id) } } });
		await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
		await prisma.$disconnect();
	});

	it("persists a valid availability slot", async () => {
		const dto: CreateAvailabilityDto = { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" };

		const result = await availabilityService.create(tenantA.id, vetAId, dto);

		expect(result).toMatchObject({
			vetId: vetAId,
			tenantId: tenantA.id,
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});
		const persisted = await prisma.vetAvailability.findUnique({ where: { id: result.id } });
		expect(persisted).not.toBeNull();
	});

	it("lists all slots for a vet regardless of day", async () => {
		await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});
		await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 3,
			startTime: "14:00",
			endTime: "18:00",
		});

		const slots = await availabilityService.findAllForVet(tenantA.id, vetAId);

		expect(slots).toHaveLength(2);
		expect(slots.map((slot) => slot.dayOfWeek).sort()).toEqual([1, 3]);
	});

	it("rejects cross-midnight blocks", async () => {
		const dto: CreateAvailabilityDto = { dayOfWeek: 1, startTime: "22:00", endTime: "02:00" };

		await expect(availabilityService.create(tenantA.id, vetAId, dto)).rejects.toThrow(
			BadRequestException,
		);
		expect(await prisma.vetAvailability.count({ where: { tenantId: tenantA.id } })).toBe(0);
	});

	it("rejects overlapping slots", async () => {
		await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});
		const dto: CreateAvailabilityDto = { dayOfWeek: 1, startTime: "12:00", endTime: "14:00" };

		await expect(availabilityService.create(tenantA.id, vetAId, dto)).rejects.toThrow(
			ConflictException,
		);
		expect(await prisma.vetAvailability.count({ where: { tenantId: tenantA.id } })).toBe(1);
	});

	it("allows touching but not overlapping slots", async () => {
		await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});
		const touching: CreateAvailabilityDto = { dayOfWeek: 1, startTime: "13:00", endTime: "15:00" };

		const result = await availabilityService.create(tenantA.id, vetAId, touching);

		expect(result.endTime).toBe("15:00");
		expect(await prisma.vetAvailability.count({ where: { tenantId: tenantA.id } })).toBe(2);
	});

	it("rejects creating availability for a vet in a different tenant", async () => {
		const dto: CreateAvailabilityDto = { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" };

		await expect(availabilityService.create(tenantB.id, vetAId, dto)).rejects.toThrow(
			NotFoundException,
		);
		expect(await prisma.vetAvailability.count({ where: { tenantId: tenantB.id } })).toBe(0);
	});

	it("deletes a slot only within the tenant", async () => {
		const slot = await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});

		await availabilityService.delete(tenantA.id, slot.id);

		expect(await prisma.vetAvailability.findUnique({ where: { id: slot.id } })).toBeNull();
		await expect(availabilityService.delete(tenantA.id, slot.id)).rejects.toThrow(
			NotFoundException,
		);
	});

	it("isolates slots by tenant", async () => {
		const userRepository = new UserRepository(prisma);
		const userService = new UserService(userRepository, prisma);
		const vetB = await userService.createVet(tenantB.id, {
			email: `pr3.availability.vetb@${randomUUID()}.test`,
			firstName: "Vet",
			lastName: "B",
		});

		await availabilityService.create(tenantA.id, vetAId, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});
		await availabilityService.create(tenantB.id, vetB.id, {
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});

		const slotsA = await availabilityService.findAllForVet(tenantA.id, vetAId);
		const slotsB = await availabilityService.findAllForVet(tenantB.id, vetB.id);

		expect(slotsA).toHaveLength(1);
		expect(slotsB).toHaveLength(1);
		expect(slotsA[0].tenantId).toBe(tenantA.id);
		expect(slotsB[0].tenantId).toBe(tenantB.id);
	});
});
