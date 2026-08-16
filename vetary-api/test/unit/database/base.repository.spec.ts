// 🧪 TEST: BaseRepository tenant filtering enforcement (Strict TDD - RED phase)
// 🔒 SEGURIDAD: Este test garantiza que NINGÚN query se ejecute sin tenantId
// ⚡ PRINCIPIO: Fail-Safe — si falta tenantId, throw exception, no retornar vacío

import "reflect-metadata";
import { UnauthorizedException } from "@nestjs/common";
import { BaseRepository } from "../../../src/database/base.repository";
import { PrismaService } from "../../../src/database/prisma.service";

// Mock repository para testing (no se puede instanciar BaseRepository directamente)
class TestRepository extends BaseRepository<any> {
	// Store delegate as instance property so spies can be attached
	private mockDelegate = {
		findMany: jest.fn().mockResolvedValue([]),
		findFirst: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockResolvedValue({}),
		updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
	};

	protected getDelegate() {
		return this.mockDelegate;
	}

	// Public wrappers to test protected methods
	public async testFindByTenant(tenantId: string, where: any = {}) {
		return this.findByTenant(tenantId, where);
	}

	public async testFindOneByTenant(tenantId: string, where: any) {
		return this.findOneByTenant(tenantId, where);
	}

	public async testCreateForTenant(tenantId: string, data: any) {
		return this.createForTenant(tenantId, data);
	}

	public async testUpdateForTenant(tenantId: string, id: string, data: any) {
		return this.updateForTenant(tenantId, id, data);
	}

	public async testDeleteForTenant(tenantId: string, id: string) {
		return this.deleteForTenant(tenantId, id);
	}
}

describe("BaseRepository (RED → GREEN → REFACTOR)", () => {
	let repository: TestRepository;
	let prismaService: PrismaService;

	beforeEach(() => {
		prismaService = new PrismaService();
		repository = new TestRepository(prismaService);
	});

	describe("🔒 SEGURIDAD: Fail-safe when tenantId is missing", () => {
		it("❌ findByTenant with null tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testFindByTenant(null as any, {})).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(repository.testFindByTenant(null as any, {})).rejects.toThrow(
				/Tenant context is missing/,
			);
		});

		it("❌ findByTenant with undefined tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testFindByTenant(undefined as any, {})).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("❌ findOneByTenant with null tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testFindOneByTenant(null as any, {})).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("❌ createForTenant with null tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testCreateForTenant(null as any, {})).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("❌ updateForTenant with null tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testUpdateForTenant(null as any, "some-id", {})).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("❌ deleteForTenant with null tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testDeleteForTenant(null as any, "some-id")).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("❌ empty string tenantId should throw UnauthorizedException", async () => {
			await expect(repository.testFindByTenant("", {})).rejects.toThrow(UnauthorizedException);
		});
	});

	describe("✅ Valid tenantId passes validation", () => {
		const validTenantId = "valid-tenant-id-123";

		it("✅ findByTenant with valid tenantId should call Prisma with tenantId filter", async () => {
			await repository.testFindByTenant(validTenantId, { status: "active" });

			const delegate = repository["getDelegate"]();
			expect(delegate.findMany).toHaveBeenCalledWith({
				where: {
					tenantId: validTenantId,
					status: "active",
				},
			});
		});

		it("✅ findOneByTenant with valid tenantId should call Prisma with tenantId filter", async () => {
			await repository.testFindOneByTenant(validTenantId, { id: "some-id" });

			const delegate = repository["getDelegate"]();
			expect(delegate.findFirst).toHaveBeenCalledWith({
				where: {
					tenantId: validTenantId,
					id: "some-id",
				},
			});
		});

		it("✅ createForTenant with valid tenantId should call Prisma with tenantId in data", async () => {
			await repository.testCreateForTenant(validTenantId, { name: "Test" });

			const delegate = repository["getDelegate"]();
			expect(delegate.create).toHaveBeenCalledWith({
				data: {
					tenantId: validTenantId,
					name: "Test",
				},
			});
		});

		it("✅ updateForTenant with valid tenantId should filter by id AND tenantId", async () => {
			await repository.testUpdateForTenant(validTenantId, "record-id", {
				name: "Updated",
			});

			const delegate = repository["getDelegate"]();
			expect(delegate.updateMany).toHaveBeenCalledWith({
				where: {
					id: "record-id",
					tenantId: validTenantId,
				},
				data: {
					name: "Updated",
				},
			});
		});

		it("✅ deleteForTenant with valid tenantId should filter by id AND tenantId", async () => {
			await repository.testDeleteForTenant(validTenantId, "record-id");

			const delegate = repository["getDelegate"]();
			expect(delegate.deleteMany).toHaveBeenCalledWith({
				where: {
					id: "record-id",
					tenantId: validTenantId,
				},
			});
		});
	});

	describe("📐 PATRÓN: Template Method — getDelegate() must be implemented", () => {
		it("should require subclasses to implement getDelegate()", () => {
			// TestRepository implements it, so it should work
			const delegate = repository["getDelegate"]();
			expect(delegate).toBeDefined();
			expect(delegate.findMany).toBeDefined();
		});
	});
});
