import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Request, Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import { TenantMiddleware } from "./tenant.middleware";

// 🧪 TEST: TenantMiddleware — verifica que el contexto de tenant se resuelve correctamente
// antes de que la request llegue a cualquier guard o controller

describe("TenantMiddleware", () => {
	let middleware: TenantMiddleware;
	let prismaService: { tenant: { findUnique: jest.Mock } };

	const mockActiveTenant = {
		id: "tenant-abc",
		name: "Clínica Las Palmeras",
		subdomain: "laspalmeras",
		status: "ACTIVE",
	};

	const mockSuspendedTenant = {
		...mockActiveTenant,
		status: "SUSPENDED",
	};

	beforeEach(async () => {
		prismaService = {
			tenant: {
				findUnique: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [TenantMiddleware, { provide: PrismaService, useValue: prismaService }],
		}).compile();

		middleware = module.get<TenantMiddleware>(TenantMiddleware);
	});

	// 🧪 TEST: Caso normal — subdomain válido adjunta tenant a la request
	it("should attach tenant to req when subdomain is valid", async () => {
		prismaService.tenant.findUnique.mockResolvedValue(mockActiveTenant);

		const req = { hostname: "laspalmeras.vetary.app" } as unknown as Request;
		const res = {} as Response;
		const next = jest.fn();

		await middleware.use(req, res, next);

		expect(req.tenant).toEqual(mockActiveTenant);
		expect(next).toHaveBeenCalledWith(); // sin error
		expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
			where: { subdomain: "laspalmeras" },
		});
	});

	// 🧪 TEST: Subdomain desconocido → 404
	it("should throw NotFoundException when subdomain does not exist", async () => {
		prismaService.tenant.findUnique.mockResolvedValue(null);

		const req = { hostname: "clinicadesconocida.vetary.app" } as unknown as Request;
		const res = {} as Response;
		const next = jest.fn();

		await expect(middleware.use(req, res, next)).rejects.toThrow(NotFoundException);
	});

	// 🧪 TEST: Tenant suspendido → 403
	it("should throw ForbiddenException when tenant is suspended", async () => {
		prismaService.tenant.findUnique.mockResolvedValue(mockSuspendedTenant);

		const req = { hostname: "laspalmeras.vetary.app" } as unknown as Request;
		const res = {} as Response;
		const next = jest.fn();

		await expect(middleware.use(req, res, next)).rejects.toThrow(ForbiddenException);
	});

	// 🧪 TEST: Sin subdomain (localhost sin variable de entorno) → 400
	it("should throw BadRequestException when no subdomain and no DEFAULT_TENANT_SUBDOMAIN", async () => {
		Reflect.deleteProperty(process.env, "DEFAULT_TENANT_SUBDOMAIN");

		const req = { hostname: "localhost" } as unknown as Request;
		const res = {} as Response;
		const next = jest.fn();

		await expect(middleware.use(req, res, next)).rejects.toThrow(BadRequestException);
	});

	// 🧪 TEST: Localhost con DEFAULT_TENANT_SUBDOMAIN en dev → usa el fallback
	it("should use DEFAULT_TENANT_SUBDOMAIN when hostname is localhost", async () => {
		process.env.DEFAULT_TENANT_SUBDOMAIN = "dev-clinic";
		prismaService.tenant.findUnique.mockResolvedValue(mockActiveTenant);

		const req = { hostname: "localhost" } as unknown as Request;
		const res = {} as Response;
		const next = jest.fn();

		await middleware.use(req, res, next);

		expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
			where: { subdomain: "dev-clinic" },
		});
		expect(next).toHaveBeenCalledWith();

		Reflect.deleteProperty(process.env, "DEFAULT_TENANT_SUBDOMAIN");
	});
});
