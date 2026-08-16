import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CustomAuthGuard } from "../../../../src/common/guards/auth.guard";

// 🧪 TEST: AuthGuard — TDD Cycle
// Layer: Unit
// Guarda que solo usuarios autenticados (JWT válido) accedan a rutas protegidas.
// @Public() las saltea completamente (evita overhead de verificación JWT).

jest.mock("@nestjs/passport", () => ({
	AuthGuard: jest.fn().mockImplementation((_strategy: string) => {
		return class MockPassportAuthGuard {
			async canActivate(_context: ExecutionContext): Promise<boolean> {
				// Mock: simula que Passport verificó JWT y lo dejó pasar
				return true;
			}
			handleRequest<TUser = unknown>(err: unknown, user: unknown): TUser {
				if (err || !user) {
					throw err || new UnauthorizedException("Invalid token");
				}
				return user as TUser;
			}
		};
	}),
}));

describe("AuthGuard (unit)", () => {
	let guard: CustomAuthGuard;
	let reflector: Reflector;
	let mockContext: ExecutionContext;

	beforeEach(() => {
		reflector = new Reflector();
		guard = new CustomAuthGuard(reflector);
		mockContext = {
			switchToHttp: () => ({
				getRequest: () => ({
					user: { userId: "user-1", tenantId: "tenant-1", role: "ADMIN", email: "a@b.com" },
					tenant: { id: "tenant-1", name: "Clinic A", subdomain: "clinic-a", status: "ACTIVE" },
				}),
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		} as unknown as ExecutionContext;
	});

	// ─── 1. RED → GREEN: @Public() salta autenticación ───
	it("✅ @Public() route → returns true without checking JWT", async () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);

		const result = await guard.canActivate(mockContext);

		expect(result).toBe(true);
	});

	// ─── 2. RED → GREEN: JWT válido → permite acceso ───
	it("✅ Valid JWT → calls Passport strategy and returns true", async () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

		const result = await guard.canActivate(mockContext);

		expect(result).toBe(true);
	});

	// ─── 3. TRIANGULATE: JWT inválido → 401 Unauthorized ───
	it("❌ Invalid JWT → throws 401 Unauthorized", async () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

		// Simular que handleRequest lanza error (JWT inválido o expirado)
		expect(() => guard.handleRequest(new UnauthorizedException("Invalid token"), null)).toThrow(
			UnauthorizedException,
		);
		expect(() => guard.handleRequest(new UnauthorizedException("Invalid token"), null)).toThrow(
			"Invalid token",
		);
	});

	// ─── 4. TRIANGULATE: falta usuario (JWT ausente) → 401 ───
	it("❌ Missing user → throws 401", () => {
		expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
		expect(() => guard.handleRequest(null, null)).toThrow("Invalid token");
	});
});
