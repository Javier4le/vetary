// 🧪 E2E TEST: Cross-Tenant Isolation (T18) — Security Boundary
// Layer: E2E (full HTTP pipeline)
// Verifies: TenantGuard blocks cross-tenant access attempts
//
// ⚡ PRINCIPIO: Defence in Depth — el aislamiento multi-tenant se testea
// en el pipeline completo, no solo en la lógica del guard.

import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestingApp, seedClinic, resetDb } from "../utils/test-helper";

describe("E2E — Cross-Tenant Isolation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetDb();
  });

  // ─── Helper: login and return access token ────────────────────────────────
  async function login(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password, tenantId });

    if (response.status !== 200) {
      throw new Error(
        `Login failed: ${response.status} — ${JSON.stringify(response.body)}`,
      );
    }
    return response.body.accessToken;
  }

  // ─── 1. Clinic A user CANNOT access Clinic B data ─────────────────────────
  it("❌ Clinic A token rejected on Clinic B subdomain (GET /users)", async () => {
    // Setup: Clinic A with admin
    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash("SecurePass123!", 10);
    const { tenant: clinicA } = await seedClinic(
      "Clínica A",
      "clinica-a",
      "admin@clinica-a.com",
      passwordHash,
      "ADMIN",
    );

    // Setup: Clinic B (no users needed)
    await seedClinic(
      "Clínica B",
      "clinica-b",
      "admin@clinica-b.com",
      passwordHash,
      "ADMIN",
    );

    // Login as Clinic A admin
    const tokenA = await login("admin@clinica-a.com", "SecurePass123!", clinicA.id);

    // Attempt: use Clinic A token on Clinic B subdomain
    const response = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Host", "clinica-b.localhost")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("different clinic");
  });

  // ─── 2. Clinic A admin CANNOT create users in Clinic B ────────────────────
  it("❌ Clinic A admin cannot create users in Clinic B (POST /users)", async () => {
    // Setup: Clinic A with admin
    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash("SecurePass123!", 10);
    const { tenant: clinicA } = await seedClinic(
      "Clínica A",
      "clinica-a",
      "admin@clinica-a.com",
      passwordHash,
      "ADMIN",
    );

    // Setup: Clinic B
    await seedClinic(
      "Clínica B",
      "clinica-b",
      "admin@clinica-b.com",
      passwordHash,
      "ADMIN",
    );

    // Login as Clinic A admin
    const tokenA = await login("admin@clinica-a.com", "SecurePass123!", clinicA.id);

    // Attempt: create user in Clinic B using Clinic A token
    const response = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Host", "clinica-b.localhost")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        email: "intruder@clinica-b.com",
        password: "SecurePass123!",
        firstName: "Intruder",
        lastName: "User",
        role: "VET",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("different clinic");
  });
});
