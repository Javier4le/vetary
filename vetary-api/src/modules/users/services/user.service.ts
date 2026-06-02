import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { PrismaService } from "../../../database/prisma.service";
// biome-ignore lint/style/useImportType: NestJS DI requires value import
import { UserRepository } from "../repositories/user.repository";
import type { CreateUserDto } from "../dto/create-user.dto";

// 📐 PATRÓN: Service — orquesta la lógica de negocio sin conocer HTTP
// ⚡ PRINCIPIO: Single Responsibility — solo gestión de usuarios, nada más
// 🔒 SEGURIDAD: Todo usuario se crea en contexto de un tenant vía UserTenant

@Injectable()
export class UserService {
	constructor(
		private readonly userRepository: UserRepository,
		// 🏗️ ARQUITECTURA: PrismaService se inyecta SOLO aquí para $transaction
		private readonly prisma: PrismaService,
	) {}

	/**
	 * Encuentra todos los usuarios de un tenant específico
	 * 🔒 SEGURIDAD: Scoping por tenantId vía UserTenant join
	 */
	async findUsersInTenant(tenantId: string): Promise<any[]> {
		const userTenants = await this.userRepository.findUsersInTenant(tenantId);

		// Transforma los resultados para devolver usuarios con su rol
		return userTenants.map((ut) => ({
			id: ut.user.id,
			email: ut.user.email,
			firstName: ut.user.firstName,
			lastName: ut.user.lastName,
			role: ut.role,
			createdAt: ut.user.createdAt,
		}));
	}

	/**
	 * Crea un usuario en el contexto de un tenant
	 *
	 * Casos:
	 * 1. Email NUEVO → crea User + UserTenant (transacción atómica)
	 * 2. Email EXISTENTE, sin UserTenant en este tenant → reusa User, crea UserTenant
	 * 3. Email EXISTENTE + UserTenant en este tenant → ConflictException
	 *
	 * ⚡ PRINCIPIO: Email es globalmente único, pero la pertenencia a tenant es a través de UserTenant
	 */
	async createUser(tenantId: string, dto: CreateUserDto) {
		// 1. Buscar si ya existe un usuario con este email (email es globalmente único)
		const existingUser = await this.userRepository.findByEmail(dto.email);

		// 2. Si existe, verificar que NO tenga UserTenant en ESTE tenant
		if (existingUser) {
			const existingUserTenant = await this.userRepository.findUserTenant(
				existingUser.id,
				tenantId,
			);

			if (existingUserTenant) {
				// El usuario ya existe en este tenant → conflicto
				throw new ConflictException(
					`User with email '${dto.email}' already belongs to this clinic`,
				);
			}

			// Reusar el usuario existente → solo crear UserTenant
			const userTenant = await this.userRepository.createUserTenant({
				userId: existingUser.id,
				tenantId,
				role: dto.role,
			});

			return {
				id: existingUser.id,
				email: existingUser.email,
				firstName: existingUser.firstName,
				lastName: existingUser.lastName,
				role: userTenant.role,
				createdAt: existingUser.createdAt,
			};
		}

		// 3. Email es NUEVO → crear User + UserTenant atómicamente
		const bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
		const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

		// Transacción atómica: Si falla UserTenant, User se deshace
		const result = await this.prisma.$transaction(async (tx: any) => {
			const user = await tx.user.create({
				data: {
					email: dto.email,
					passwordHash,
					firstName: dto.firstName,
					lastName: dto.lastName,
				},
			});

			const userTenant = await tx.userTenant.create({
				data: {
					userId: user.id,
					tenantId,
					role: dto.role,
				},
			});

			return { user, userTenant };
		});

		return {
			id: result.user.id,
			email: result.user.email,
			firstName: result.user.firstName,
			lastName: result.user.lastName,
			role: result.userTenant.role,
			createdAt: result.user.createdAt,
		};
	}
}
