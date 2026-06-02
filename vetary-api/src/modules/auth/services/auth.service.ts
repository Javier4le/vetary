import {
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { ConfigService } from "../../../config/config.service";
import { PrismaService } from "../../../database/prisma.service";
import type { JwtPayload } from "../interfaces/jwt-payload.interface";

// 🔒 SEGURIDAD: AuthService — ORQUESTA toda la lógica de autenticación
// 📐 PATRÓN: Service — contiene lógica de negocio sin conocer HTTP
// ⚡ PRINCIPIO: Single Responsibility — solo autenticación, nada más
//
// ⚠️ DECISIÓN: No usamos UserRepository aquí
// Por qué: AuthService necesita queries directas a User, UserTenant y RefreshToken.
// Las queries son específicas de auth (find by email, find by token, etc.)
// y no encajan en UserRepository que es solo para gestión de usuarios.
// PrismaService mantiene control total para las operaciones de auth.

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService,
	) {}

	/**
	 * 🔒 SEGURIDAD: Hashea una contraseña con bcrypt y salt rounds configurado
	 */
	async hashPassword(password: string): Promise<string> {
		return bcrypt.hash(password, this.configService.bcryptRounds);
	}

	/**
	 * 🔒 SEGURIDAD: Compara una contraseña contra su hash bcrypt
	 */
	async comparePasswords(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	/**
	 * Autentica un usuario y genera par de tokens (access + refresh)
	 *
	 * Flujo:
	 * 1. Buscar usuario por email
	 * 2. Verificar que el usuario pertenezca al tenant (UserTenant)
	 * 3. Comprobar contraseña
	 * 4. Generar JWT access token
	 * 5. Generar y almacenar refresh token
	 *
	 * ⚡ PRINCIPIO: Fail fast — validar credenciales antes de generar tokens
	 * 🔒 SEGURIDAD: Devolver Unauthorized (no NotFound) para no revelar si el email existe
	 */
	async login(
		email: string,
		password: string,
		tenantId: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		// 1. Buscar usuario por email
		const user = await this.prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			// 🔒 SEGURIDAD: Mismo mensaje/error para usuario no encontrado y contraseña incorrecta
			// Evita reconocimiento de emails existentes (enumeración)
			throw new UnauthorizedException("Invalid credentials");
		}

		// 2. Verificar que el usuario tiene UserTenant para este tenant
		const userTenant = await this.prisma.userTenant.findFirst({
			where: { userId: user.id, tenantId },
		});

		if (!userTenant) {
			throw new ForbiddenException("User does not have access to this clinic");
		}

		// 3. Verificar contraseña
		const isPasswordValid = await this.comparePasswords(
			password,
			user.passwordHash,
		);

		if (!isPasswordValid) {
			throw new UnauthorizedException("Invalid credentials");
		}

		// 4. Generar JWT access token
		const payload: JwtPayload = {
			sub: user.id,
			tenantId,
			role: userTenant.role,
			email: user.email,
		};

		const accessToken = this.jwtService.sign(payload);

		// 5. Generar y almacenar refresh token (UUID, 7 días de expiración)
		const refreshToken = randomUUID();
		const refreshTokenExpiresIn = parseExpiration(
			this.configService.refreshTokenExpiration,
		);
		const expiresAt = new Date(Date.now() + refreshTokenExpiresIn);

		await this.prisma.refreshToken.create({
			data: {
				token: refreshToken,
				userId: user.id,
				tenantId,
				expiresAt,
			},
		});

		return { accessToken, refreshToken };
	}

	/**
	 * Refresca un access token usando un refresh token válido
	 *
	 * Flujo (Token Rotation):
	 * 1. Buscar refresh token por su string
	 * 2. Verificar que no esté revocado ni expirado
	 * 3. Revocar el token antiguo
	 * 4. Generar nuevo par de tokens
	 * 5. Guardar nuevo refresh token
	 *
	 * 🔒 SEGURIDAD: Token Rotation — cada refresh revoca el token anterior
	 * Mitiga riesgo de robo: si alguien intercepta un token usado, ya no sirve.
	 */
	async refresh(
		refreshToken: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		// 1. Buscar refresh token
		const tokenRecord = await this.prisma.refreshToken.findUnique({
			where: { token: refreshToken },
		});

		if (!tokenRecord) {
			throw new UnauthorizedException("Invalid refresh token");
		}

		// 2. Verificar que no esté revocado ni expirado
		if (tokenRecord.revokedAt) {
			throw new UnauthorizedException("Refresh token has been revoked");
		}

		if (new Date() > tokenRecord.expiresAt) {
			throw new UnauthorizedException("Refresh token has expired");
		}

		// 3. Revocar el token antiguo
		await this.prisma.refreshToken.update({
			where: { id: tokenRecord.id },
			data: { revokedAt: new Date() },
		});

		// 4. Buscar UserTenant para reconstruir payload
		const userTenant = await this.prisma.userTenant.findFirst({
			where: {
				userId: tokenRecord.userId,
				tenantId: tokenRecord.tenantId,
			},
		});

		if (!userTenant) {
			throw new UnauthorizedException("User membership not found");
		}

		// 5. Generar nuevo access token
		const user = await this.prisma.user.findUnique({
			where: { id: tokenRecord.userId },
		});

		if (!user) {
			throw new UnauthorizedException("User not found");
		}

		const payload: JwtPayload = {
			sub: user.id,
			tenantId: tokenRecord.tenantId,
			role: userTenant.role,
			email: user.email,
		};

		const accessToken = this.jwtService.sign(payload);

		// 6. Generar y almacenar NUEVO refresh token
		const newRefreshToken = randomUUID();
		const refreshTokenExpiresIn = parseExpiration(
			this.configService.refreshTokenExpiration,
		);
		const expiresAt = new Date(Date.now() + refreshTokenExpiresIn);

		await this.prisma.refreshToken.create({
			data: {
				token: newRefreshToken,
				userId: user.id,
				tenantId: tokenRecord.tenantId,
				expiresAt,
			},
		});

		return { accessToken, refreshToken: newRefreshToken };
	}

	/**
	 * Cierra sesión revocando el refresh token
	 *
	 * 🔒 SEGURIDAD: Revocación inmediata — el token ya no sirve para refresh
	 */
	async logout(refreshToken: string): Promise<void> {
		const tokenRecord = await this.prisma.refreshToken.findUnique({
			where: { token: refreshToken },
		});

		if (!tokenRecord) {
			throw new UnauthorizedException("Invalid refresh token");
		}

		await this.prisma.refreshToken.update({
			where: { id: tokenRecord.id },
			data: { revokedAt: new Date() },
		});
	}
}

/**
 * Convierte un string de expiración tipo "15m", "7d", "2h" a milisegundos
 * 🔒 SEGURIDAD: Overflow protection mediante validación
 */
function parseExpiration(exp: string): number {
	const match = exp.match(/^(\d+)([smhd])$/);
	if (!match) {
		return 7 * 24 * 60 * 60 * 1000; // Default 7 días
	}

	const [, value, unit] = match;
	const num = Number.parseInt(value, 10);
	const multipliers: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};

	return num * multipliers[unit];
}
