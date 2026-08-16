import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "./prisma.service";

// 🏗️ ARQUITECTURA: BaseRepository — Template para todos los repositorios tenant-scoped
// 📐 PATRÓN: Template Method Pattern — la clase base define el esqueleto, las subclases los detalles
// 🔒 SEGURIDAD: Enforces tenantId filtering — si falta tenantId, throw exception (fail-safe)

// ⚡ PRINCIPIO: Defense in Depth — múltiples capas de seguridad (middleware, guards, repository)
// Incluso si falla TenantMiddleware o TenantGuard, este repository NO permite queries sin tenantId

export abstract class BaseRepository<T> {
	constructor(protected readonly prisma: PrismaService) {}

	/**
	 * 🔒 SEGURIDAD: Find records scoped to tenant
	 * @param tenantId - REQUIRED. Throws if null/undefined/empty
	 * @param where - Additional filters (optional)
	 * @returns Array of records belonging to the tenant
	 *
	 * 📐 PATRÓN: Fail-Safe — mejor fallar explícitamente que retornar data incorrecta
	 */
	protected async findByTenant(tenantId: string, where: any = {}): Promise<T[]> {
		this.validateTenantId(tenantId);

		return this.getDelegate().findMany({
			where: { tenantId, ...where },
		});
	}

	/**
	 * 🔒 SEGURIDAD: Find one record scoped to tenant
	 * @param tenantId - REQUIRED. Throws if null/undefined/empty
	 * @param where - Filters (required, e.g., { id: 'xxx' })
	 * @returns Single record or null if not found
	 */
	protected async findOneByTenant(tenantId: string, where: any): Promise<T | null> {
		this.validateTenantId(tenantId);

		return this.getDelegate().findFirst({
			where: { tenantId, ...where },
		});
	}

	/**
	 * 🔒 SEGURIDAD: Create record with tenantId automatically injected
	 * @param tenantId - REQUIRED. Throws if null/undefined/empty
	 * @param data - Record data (tenantId will be added automatically)
	 * @returns Created record
	 */
	protected async createForTenant(tenantId: string, data: any): Promise<T> {
		this.validateTenantId(tenantId);

		return this.getDelegate().create({
			data: { tenantId, ...data },
		});
	}

	/**
	 * 🔒 SEGURIDAD: Update record with double filter (id AND tenantId)
	 * @param tenantId - REQUIRED. Throws if null/undefined/empty
	 * @param id - Record ID
	 * @param data - Update data
	 * @returns Update result
	 *
	 * ⚠️ DECISIÓN: Usamos updateMany en vez de update para filtrar por tenantId + id
	 * update() solo acepta unique constraint, updateMany() acepta cualquier where
	 */
	protected async updateForTenant(tenantId: string, id: string, data: any): Promise<any> {
		this.validateTenantId(tenantId);

		return this.getDelegate().updateMany({
			where: { id, tenantId }, // ← Double filter: prevent cross-tenant updates
			data,
		});
	}

	/**
	 * 🔒 SEGURIDAD: Delete record with double filter (id AND tenantId)
	 * @param tenantId - REQUIRED. Throws if null/undefined/empty
	 * @param id - Record ID
	 * @returns Delete result
	 */
	protected async deleteForTenant(tenantId: string, id: string): Promise<any> {
		this.validateTenantId(tenantId);

		return this.getDelegate().deleteMany({
			where: { id, tenantId }, // ← Double filter: prevent cross-tenant deletes
		});
	}

	/**
	 * 🔒 SEGURIDAD: Validation helper — centraliza la lógica de validación
	 * @param tenantId - Tenant ID to validate
	 * @throws UnauthorizedException if tenantId is null, undefined, or empty string
	 *
	 * 📐 PATRÓN: Fail-Fast — si algo está mal, fallar ANTES de tocar la base de datos
	 */
	private validateTenantId(tenantId: string): void {
		if (!tenantId || tenantId.trim() === "") {
			throw new UnauthorizedException(
				"Tenant context is missing. All queries must include a tenant ID.",
			);
		}
	}

	/**
	 * 📐 PATRÓN: Template Method — subclasses MUST implement this
	 * @returns Prisma model delegate (e.g., prisma.booking, prisma.pet)
	 *
	 * Example implementation in BookingRepository:
	 * ```typescript
	 * protected getDelegate() {
	 *   return this.prisma.booking;
	 * }
	 * ```
	 */
	protected abstract getDelegate(): any;
}
