import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { PrismaService } from "@/database/prisma.service";
import type { Role, User } from "@prisma/client";

// 📐 PATRÓN Repository: encapsula todo el acceso a datos relacionados con User
// ⚠️ DECISIÓN: UserRepository NO extiende BaseRepository
// Por qué: User es global (no tiene tenantId propio) — el scope por tenant se resuelve vía UserTenant join
// BaseRepository es para entidades DENTRO de un tenant con campo tenantId directo

@Injectable()
export class UserRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Busca un usuario por email (email es globalmente único)
	 */
	async findByEmail(email: string): Promise<User | null> {
		return this.prisma.user.findUnique({
			where: { email },
		});
	}

	/**
	 * Busca el UserTenant para un par (userId, tenantId)
	 */
	async findUserTenant(
		userId: string,
		tenantId: string,
	): Promise<{ id: string; userId: string; tenantId: string; role: Role } | null> {
		return this.prisma.userTenant.findFirst({
			where: { userId, tenantId },
		});
	}

	/**
	 * 🔒 SEGURIDAD: Devuelve usuarios de UN tenant específico
	 * Usa la relación UserTenant para filtrar — nunca devuelve usuarios de otros tenants
	 *
	 * El join con UserTenant garantiza aislamiento:
	 * WHERE userTenants.tenantId = X → solo usuarios del tenant X
	 */
	async findUsersInTenant(tenantId: string) {
		return this.prisma.userTenant.findMany({
			where: { tenantId },
			include: {
				user: true,
			},
		});
	}

	/**
	 * Crea un nuevo usuario (no transaccional — para uso dentro de $transaction)
	 */
	async createUser(data: {
		email: string;
		passwordHash: string;
		firstName: string;
		lastName: string;
	}): Promise<User> {
		return this.prisma.user.create({
			data: {
				email: data.email,
				passwordHash: data.passwordHash,
				firstName: data.firstName,
				lastName: data.lastName,
			},
		});
	}

	/**
	 * Crea un UserTenant (asociación usuario-tenant)
	 */
	async createUserTenant(data: {
		userId: string;
		tenantId: string;
		role: Role;
	}) {
		return this.prisma.userTenant.create({
			data,
		});
	}
}
