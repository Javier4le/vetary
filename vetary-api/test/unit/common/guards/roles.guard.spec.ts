import { Role } from "@/database/prisma";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../../../../src/common/guards/roles.guard";

// 🧪 TEST: RolesGuard — TDD Cycle
// Layer: Unit
// Verifica que req.user.role esté dentro de los roles permitidos por @Roles(...).

describe("RolesGuard (unit)", () => {
	let guard: RolesGuard;
	let reflector: Reflector;

	beforeEach(() => {
		reflector = new Reflector();
		guard = new RolesGuard(reflector);
	});

	function createContext(userRole: Role | null): ExecutionContext {
		return {
			switchToHttp: () => ({
				getRequest: () => ({
					user: userRole
						? { userId: "u1", tenantId: "t1", role: userRole, email: "a@b.com" }
						: undefined,
				}),
			}),
			getHandler: jest.fn(),
			getClass: jest.fn(),
		} as unknown as ExecutionContext;
	}

	// ─── 1. RED / GREEN: sin @Roles() → permite ───
	it("✅ No @Roles() decorator → returns true (no role requirement)", () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);

		const result = guard.canActivate(createContext(Role.ADMIN));

		expect(result).toBe(true);
	});

	// ─── 2. RED / GREEN: rol del usuario en la lista ───
	it("✅ User role in required roles → returns true", () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN, Role.VET]);

		const result = guard.canActivate(createContext(Role.ADMIN));

		expect(result).toBe(true);
	});

	// ─── 3. TRIANGULATE: rol del usuario NO está en la lista ───
	it("❌ User role NOT in required roles → throws 403 'Insufficient permissions'", () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN, Role.VET]);

		expect(() => guard.canActivate(createContext(Role.STAFF))).toThrow(ForbiddenException);
		expect(() => guard.canActivate(createContext(Role.STAFF))).toThrow("Insufficient permissions");
	});

	// ─── 4. TRIANGULATE: falta req.user ───
	it("❌ Missing req.user → throws 403 'User context missing'", () => {
		jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);

		expect(() => guard.canActivate(createContext(null))).toThrow(ForbiddenException);
		expect(() => guard.canActivate(createContext(null))).toThrow("User context missing");
	});
});
