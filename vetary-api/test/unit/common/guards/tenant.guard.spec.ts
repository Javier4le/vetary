import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TenantGuard } from "../../../../src/common/guards/tenant.guard";

// 🧪 TEST: TenantGuard — TDD Cycle
// Layer: Unit
// Última línea de defensa contra cross-tenant access.
// Compara req.tenant.id (del middleware) vs req.user.tenantId (del JWT).

describe("TenantGuard (unit)", () => {
  let guard: TenantGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new TenantGuard(reflector);
  });

  function createContext(
    tenantId: string | null,
    userTenantId: string | null,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          tenant: tenantId ? { id: tenantId, name: "Clinic", subdomain: "clinic", status: "ACTIVE" } : undefined,
          user: userTenantId ? { userId: "u1", tenantId: userTenantId, role: "ADMIN", email: "a@b.com" } : undefined,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  // ─── 1. RED / GREEN: @Public() salta verificación ───
  it("✅ @Public() route → returns true (skips tenant check)", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);

    const result = guard.canActivate(createContext("tenant-a", "tenant-b"));

    expect(result).toBe(true);
  });

  // ─── 2. RED / GREEN: tenant y JWT coinciden ───
  it("✅ req.tenant.id === req.user.tenantId → returns true", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

    const result = guard.canActivate(createContext("tenant-1", "tenant-1"));

    expect(result).toBe(true);
  });

  // ─── 3. TRIANGULATE: tenant y JWT NO coinciden ───
  it("❌ req.tenant.id !== req.user.tenantId → throws 403 'Your token belongs to a different clinic'", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

    expect(() => guard.canActivate(createContext("tenant-a", "tenant-b"))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext("tenant-a", "tenant-b"))).toThrow(
      "Your token belongs to a different clinic",
    );
  });

  // ─── 4. TRIANGULATE: falta req.tenant o req.user ───
  it("❌ Missing req.tenant or req.user → throws 403 'Tenant or user context missing'", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

    expect(() => guard.canActivate(createContext(null, "tenant-1"))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext(null, "tenant-1"))).toThrow(
      "Tenant or user context missing",
    );

    expect(() => guard.canActivate(createContext("tenant-1", null))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext("tenant-1", null))).toThrow(
      "Tenant or user context missing",
    );
  });
});
