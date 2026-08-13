process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/vetary_dev";

import { randomUUID } from "node:crypto";
import type { PrismaService as PrismaServiceType } from "../../src/database/prisma.service";
import type { UserService as UserServiceType } from "../../src/modules/users/services/user.service";
import type { CreateVetDto } from "../../src/modules/users/dto/create-vet.dto";

const { PrismaService } = require("../../src/database/prisma.service") as typeof import("../../src/database/prisma.service");
const { UserRepository } = require("../../src/modules/users/repositories/user.repository") as typeof import("../../src/modules/users/repositories/user.repository");
const { UserService } = require("../../src/modules/users/services/user.service") as typeof import("../../src/modules/users/services/user.service");
const { VetProfileRepository } = require("../../src/modules/vet-profiles/repositories/vet-profile.repository") as typeof import("../../src/modules/vet-profiles/repositories/vet-profile.repository");

describe("UserService.createVet — PostgreSQL integration", () => {
	let prisma: PrismaServiceType;
	let userService: UserServiceType;
	let vetProfileRepository: InstanceType<typeof VetProfileRepository>;
	let tenantIds: string[];
	let tenantA: { id: string };
	let tenantB: { id: string };
	let tenantC: { id: string };
	let failVetProfileCreate = false;

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.$connect();
		userService = new UserService(new UserRepository(prisma), prisma);
		vetProfileRepository = new VetProfileRepository(prisma);

		prisma.$use(async (params, next) => {
			if (failVetProfileCreate && params.model === "VetProfile" && params.action === "create") {
				throw new Error("forced VetProfile failure");
			}

			return next(params);
		});

		const tenants = await Promise.all(
			["a", "b", "c"].map((suffix) =>
				prisma.tenant.create({
					data: {
						name: `PR-2 Integration Tenant ${suffix}`,
						subdomain: `pr2-integration-${suffix}-${randomUUID()}`,
					},
				}),
			),
		);

		[tenantA, tenantB, tenantC] = tenants;
		tenantIds = tenants.map((tenant) => tenant.id);
	});

	afterEach(async () => {
		failVetProfileCreate = false;
		await prisma.vetProfile.deleteMany({ where: { tenantId: { in: tenantIds } } });
		await prisma.userTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });

		const testUsers = await prisma.user.findMany({
			where: { email: { startsWith: "pr2.integration." } },
			select: { id: true },
		});
		await prisma.user.deleteMany({ where: { id: { in: testUsers.map((user) => user.id) } } });
	});

	afterAll(async () => {
		await prisma.vetProfile.deleteMany({ where: { tenantId: { in: tenantIds } } });
		await prisma.userTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
		await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
		await prisma.$disconnect();
	});

	it("persists User, UserTenant, and VetProfile atomically on success", async () => {
		const dto: CreateVetDto = {
			email: "pr2.integration.success@example.com",
			firstName: "Integration",
			lastName: "Success",
			specialty: "Surgery",
		};

		const result = await userService.createVet(tenantA.id, dto);

		const user = await prisma.user.findUnique({ where: { email: dto.email } });
		const memberships = await prisma.userTenant.findMany({ where: { userId: user?.id } });
		const profiles = await prisma.vetProfile.findMany({ where: { userId: user?.id } });

		expect(result.id).toBe(user?.id);
		expect(memberships).toHaveLength(1);
		expect(memberships[0]).toMatchObject({ tenantId: tenantA.id, role: "VET" });
		expect(profiles).toHaveLength(1);
		expect(profiles[0]).toMatchObject({ tenantId: tenantA.id, specialty: dto.specialty });
	});

	it("allows one global User to have a VetProfile in two tenants", async () => {
		const dto: CreateVetDto = {
			email: "pr2.integration.cross-tenant@example.com",
			firstName: "Cross",
			lastName: "Tenant",
		};

		await userService.createVet(tenantA.id, dto);
		await userService.createVet(tenantB.id, dto);

		const user = await prisma.user.findUnique({ where: { email: dto.email } });
		const profiles = await prisma.vetProfile.findMany({
			where: { userId: user?.id },
			orderBy: { tenantId: "asc" },
		});

		expect(profiles).toHaveLength(2);
		expect(profiles.map((profile) => profile.tenantId).sort()).toEqual(
			[tenantA.id, tenantB.id].sort(),
		);
	});

	it("rolls back User and UserTenant when VetProfile creation fails", async () => {
		failVetProfileCreate = true;
		const dto: CreateVetDto = {
			email: "pr2.integration.rollback@example.com",
			firstName: "Rollback",
			lastName: "Failure",
		};

		await expect(userService.createVet(tenantC.id, dto)).rejects.toThrow("forced VetProfile failure");

		const user = await prisma.user.findUnique({ where: { email: dto.email } });
		expect(user).toBeNull();
		expect(await prisma.userTenant.count({ where: { tenantId: tenantC.id } })).toBe(0);
		expect(await prisma.vetProfile.count({ where: { tenantId: tenantC.id } })).toBe(0);
	});

	it("keeps VetProfile reads isolated by tenant", async () => {
		const dto: CreateVetDto = {
			email: "pr2.integration.isolation@example.com",
			firstName: "Tenant",
			lastName: "Isolation",
		};

		const result = await userService.createVet(tenantA.id, dto);

		expect(await vetProfileRepository.findByUserIdAndTenant(tenantA.id, result.id)).not.toBeNull();
		expect(await vetProfileRepository.findByUserIdAndTenant(tenantB.id, result.id)).toBeNull();
	});
});
