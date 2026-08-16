import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";
import { UserController } from "../../../src/modules/users/controllers/user.controller";
import type { CreateStaffDto } from "../../../src/modules/users/dto/create-staff.dto";
import type { CreateVetDto } from "../../../src/modules/users/dto/create-vet.dto";
import { UserService } from "../../../src/modules/users/services/user.service";

// 🧪 INTEGRATION TEST: UserController vets/staff endpoints
// Verifica que los endpoints deleguen correctamente al servicio y apliquen RBAC vía metadata

describe("UserController — vets/staff endpoints", () => {
	let controller: UserController;
	let userService: {
		createUser: jest.Mock;
		createVet: jest.Mock;
	};

	const tenant = { id: "tenant-1", name: "Clínica Test", subdomain: "clinica-test" };

	beforeEach(async () => {
		userService = {
			createUser: jest.fn(),
			createVet: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [UserController],
			providers: [{ provide: UserService, useValue: userService }],
		}).compile();

		controller = module.get<UserController>(UserController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /users/vets", () => {
		it("should delegate to createVet service with tenant and DTO", async () => {
			const dto: CreateVetDto = {
				email: "vet@example.com",
				firstName: "María",
				lastName: "López",
				specialty: "Cirugía",
			};
			const expectedResult = {
				id: "user-1",
				email: dto.email,
				role: "VET",
				specialty: dto.specialty,
			};

			userService.createVet.mockResolvedValue(expectedResult);

			const result = await controller.createVet(tenant, dto);

			expect(userService.createVet).toHaveBeenCalledWith(tenant.id, dto);
			expect(result).toEqual(expectedResult);
		});

		it("should require ADMIN role via @Roles metadata", () => {
			const roles = Reflect.getMetadata("roles", controller.createVet);
			expect(roles).toEqual([Role.ADMIN]);
		});
	});

	describe("POST /users/staff", () => {
		it("should delegate to createUser service with role STAFF", async () => {
			const dto: CreateStaffDto = {
				email: "staff@example.com",
				password: "SecurePass123!",
				firstName: "Ana",
				lastName: "Torres",
			};
			const expectedResult = {
				id: "user-2",
				email: dto.email,
				role: "STAFF",
			};

			userService.createUser.mockResolvedValue(expectedResult);

			const result = await controller.createStaff(tenant, dto);

			expect(userService.createUser).toHaveBeenCalledWith(tenant.id, {
				...dto,
				role: Role.STAFF,
			});
			expect(result).toEqual(expectedResult);
		});

		it("should require ADMIN role via @Roles metadata", () => {
			const roles = Reflect.getMetadata("roles", controller.createStaff);
			expect(roles).toEqual([Role.ADMIN]);
		});
	});
});
