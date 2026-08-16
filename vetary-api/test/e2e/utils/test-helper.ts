// 🏗️ ARQUITECTURA: E2E Test Helper — creates a real NestJS app with mocked Prisma
// 📐 PATRÓN: Test Double — reemplazamos solo la capa de infraestructura (DB)
// Todo el pipeline HTTP corre real: Middleware → Guards → Controllers → Services
//
// ⚡ PRINCIPIO: Test the real pipeline, not just pieces
// A diferencia de tests unitarios que mockean servicios, aquí testeamos la integración
// completa del request lifecycle.

import { randomUUID } from "node:crypto";
import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type {
	RefreshToken,
	Role,
	Tenant,
	TenantStatus,
	User,
	UserTenant,
	VetAvailability,
	VetProfile,
} from "@prisma/client";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/database/prisma.service";

// ═════════════════════════════════════════════════════════════════════════════
// In-memory Prisma mock for E2E testing
// Stores all tables in memory with Prisma-like query interface
// ═════════════════════════════════════════════════════════════════════════════

interface InMemoryDb {
	tenants: Tenant[];
	users: User[];
	userTenants: UserTenant[];
	refreshTokens: RefreshToken[];
	vetProfiles: VetProfile[];
	vetAvailabilities: VetAvailability[];
}

function required<T>(value: T | undefined, field: string): T {
	if (value === undefined) {
		throw new Error(`Missing required test fixture field: ${field}`);
	}
	return value;
}

function createEmptyDb(): InMemoryDb {
	return {
		tenants: [],
		users: [],
		userTenants: [],
		refreshTokens: [],
		vetProfiles: [],
		vetAvailabilities: [],
	};
}

export let db: InMemoryDb = createEmptyDb();

export function resetDb(): void {
	db = createEmptyDb();
}

// Simula PrismaClient.$transaction()
type MockPrismaClient = typeof mockPrismaClient;

async function inMemoryTransaction<T>(fn: (tx: MockPrismaClient) => Promise<T>): Promise<T> {
	return fn(mockPrismaClient);
}

// Simula PrismaClient con operaciones CRUD en memoria
const mockPrismaClient = {
	tenant: {
		create: async ({ data }: { data: Partial<Tenant> }) => {
			const tenant: Tenant = {
				id: data.id || randomUUID(),
				name: data.name || "Test Clinic",
				subdomain: required(data.subdomain, "subdomain"),
				status: (data.status || "ACTIVE") as TenantStatus,
				timezone: data.timezone || "America/Santiago",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db.tenants.push(tenant);
			return tenant;
		},
		findUnique: async ({ where }: { where: { id?: string; subdomain?: string } }) => {
			if (where.subdomain) {
				return db.tenants.find((t) => t.subdomain === where.subdomain) || null;
			}
			return db.tenants.find((t) => t.id === where.id) || null;
		},
		count: async ({ where }: { where: { subdomain?: string } }) => {
			if (where.subdomain) {
				return db.tenants.filter((t) => t.subdomain === where.subdomain).length;
			}
			return db.tenants.length;
		},
	},
	user: {
		create: async ({ data }: { data: Partial<User> }) => {
			const user: User = {
				id: data.id || randomUUID(),
				email: required(data.email, "email"),
				passwordHash: required(data.passwordHash, "passwordHash"),
				firstName: required(data.firstName, "firstName"),
				lastName: required(data.lastName, "lastName"),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db.users.push(user);
			return user;
		},
		findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
			if (where.email) {
				return db.users.find((u) => u.email === where.email) || null;
			}
			return db.users.find((u) => u.id === where.id) || null;
		},
	},
	userTenant: {
		create: async ({ data }: { data: Partial<UserTenant> }) => {
			const ut: UserTenant = {
				id: data.id || randomUUID(),
				userId: required(data.userId, "userId"),
				tenantId: required(data.tenantId, "tenantId"),
				role: (data.role || "STAFF") as Role,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db.userTenants.push(ut);
			return ut;
		},
		findFirst: async ({ where }: { where: { userId?: string; tenantId?: string } }) => {
			return (
				db.userTenants.find(
					(ut) =>
						(!where.userId || ut.userId === where.userId) &&
						(!where.tenantId || ut.tenantId === where.tenantId),
				) || null
			);
		},
		findMany: async ({ where }: { where: { tenantId?: string } }) => {
			if (where.tenantId) {
				return db.userTenants
					.filter((ut) => ut.tenantId === where.tenantId)
					.map((ut) => ({
						...ut,
						user: required(
							db.users.find((u) => u.id === ut.userId),
							`user:${ut.userId}`,
						),
					}));
			}
			return [];
		},
	},
	refreshToken: {
		create: async ({ data }: { data: Partial<RefreshToken> }) => {
			const token: RefreshToken = {
				id: data.id || randomUUID(),
				token: required(data.token, "token"),
				userId: required(data.userId, "userId"),
				tenantId: required(data.tenantId, "tenantId"),
				expiresAt: required(data.expiresAt, "expiresAt"),
				revokedAt: data.revokedAt ?? null,
				createdAt: new Date(),
			};
			db.refreshTokens.push(token);
			return token;
		},
		findUnique: async ({ where }: { where: { token?: string; id?: string } }) => {
			if (where.token) {
				return db.refreshTokens.find((t) => t.token === where.token) || null;
			}
			return db.refreshTokens.find((t) => t.id === where.id) || null;
		},
		update: async ({
			where,
			data,
		}: {
			where: { id?: string };
			data: Partial<RefreshToken>;
		}) => {
			const token = db.refreshTokens.find((t) => t.id === where.id);
			if (!token) return null;
			Object.assign(token, data);
			return token;
		},
		findFirst: async ({ where }: { where: { userId?: string; tenantId?: string } }) => {
			return (
				db.refreshTokens.find(
					(rt) =>
						(!where.userId || rt.userId === where.userId) &&
						(!where.tenantId || rt.tenantId === where.tenantId),
				) || null
			);
		},
	},
	vetProfile: {
		create: async ({ data }: { data: Partial<VetProfile> }) => {
			const profile: VetProfile = {
				id: data.id || randomUUID(),
				userId: required(data.userId, "userId"),
				tenantId: required(data.tenantId, "tenantId"),
				specialty: data.specialty ?? null,
				registrationNumber: data.registrationNumber ?? null,
				bio: data.bio ?? null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db.vetProfiles.push(profile);
			return profile;
		},
		findFirst: async ({ where }: { where: { userId?: string; tenantId?: string } }) => {
			return (
				db.vetProfiles.find(
					(profile) =>
						(!where.userId || profile.userId === where.userId) &&
						(!where.tenantId || profile.tenantId === where.tenantId),
				) || null
			);
		},
	},
	vetAvailability: {
		create: async ({ data }: { data: Partial<VetAvailability> }) => {
			const slot: VetAvailability = {
				id: data.id || randomUUID(),
				vetId: required(data.vetId, "vetId"),
				tenantId: required(data.tenantId, "tenantId"),
				dayOfWeek: required(data.dayOfWeek, "dayOfWeek"),
				startTime: required(data.startTime, "startTime"),
				endTime: required(data.endTime, "endTime"),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db.vetAvailabilities.push(slot);
			return slot;
		},
		findMany: async ({
			where,
		}: { where: { tenantId?: string; vetId?: string; dayOfWeek?: number } }) => {
			return db.vetAvailabilities.filter(
				(slot) =>
					(!where.tenantId || slot.tenantId === where.tenantId) &&
					(!where.vetId || slot.vetId === where.vetId) &&
					(where.dayOfWeek === undefined || slot.dayOfWeek === where.dayOfWeek),
			);
		},
		deleteMany: async ({ where }: { where: { id?: string; tenantId?: string } }) => {
			const beforeCount = db.vetAvailabilities.length;
			db.vetAvailabilities = db.vetAvailabilities.filter(
				(slot) => !(slot.id === where.id && slot.tenantId === where.tenantId),
			);
			return { count: beforeCount - db.vetAvailabilities.length };
		},
	},
};

// ═════════════════════════════════════════════════════════════════════════════
// Throttler bypass for E2E tests — prevents 429 Too Many Requests under test load
// ═════════════════════════════════════════════════════════════════════════════

@Module({
	providers: [{ provide: ThrottlerGuard, useValue: { canActivate: () => true } }],
	exports: [ThrottlerGuard],
})
class NoOpThrottlerModule {}

// ═════════════════════════════════════════════════════════════════════════════
// Create E2E Testing Application
// ═════════════════════════════════════════════════════════════════════════════

export async function createTestingApp(): Promise<INestApplication> {
	// Reset database before each test suite
	resetDb();

	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideModule(ThrottlerModule)
		.useModule(NoOpThrottlerModule)
		.overrideProvider(PrismaService)
		.useValue({
			$connect: async () => {
				// No external database is used by the in-memory E2E fixture.
			},
			$disconnect: async () => {
				// No external database is used by the in-memory E2E fixture.
			},
			$transaction: inMemoryTransaction,
			...mockPrismaClient,
		})
		.compile();

	const app = moduleFixture.createNestApplication();

	// Apply same configuration as main.ts
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	app.setGlobalPrefix("api/v1");

	await app.init();

	return app;
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper: seed a clinic (tenant) with admin user
// Returns the created tenant, user, and UserTenant for test setup
// ═════════════════════════════════════════════════════════════════════════════

export async function seedClinic(
	name: string,
	subdomain: string,
	adminEmail: string,
	passwordHash: string,
	role: Role = "ADMIN",
): Promise<{
	tenant: Tenant;
	user: User;
	userTenant: UserTenant;
}> {
	const tenant = await mockPrismaClient.tenant.create({
		data: { name, subdomain, status: "ACTIVE" },
	});

	const user = await mockPrismaClient.user.create({
		data: {
			email: adminEmail,
			passwordHash,
			firstName: "Test",
			lastName: "Admin",
		},
	});

	const userTenant = await mockPrismaClient.userTenant.create({
		data: { userId: user.id, tenantId: tenant.id, role },
	});

	return { tenant, user, userTenant };
}

// Helper: seed an additional user into an existing clinic
export async function seedUser(
	tenantId: string,
	email: string,
	passwordHash: string,
	role: Role,
): Promise<User> {
	const user = await mockPrismaClient.user.create({
		data: { email, passwordHash, firstName: "Test", lastName: "User" },
	});
	await mockPrismaClient.userTenant.create({
		data: { userId: user.id, tenantId, role },
	});
	return user;
}

// Helper: create a signed JWT access token for an existing userTenant
export function createAccessToken(
	userId: string,
	tenantId: string,
	role: Role,
	email: string,
): string {
	const jwtService = new JwtService({
		secret:
			process.env.JWT_SECRET || "local-dev-secret-change-in-production-min-32-characters-required",
	});
	return jwtService.sign({ sub: userId, tenantId, role, email });
}

// Helper para esperar promises (evitar flakiness en tests asíncronos)
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
