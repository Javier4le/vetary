// 🧪 E2E TEST: Clinic Configuration Workflows (T-014)
// Layer: E2E (full HTTP pipeline)
// Verifies: ADMIN creates vets, manages availability, RBAC, tenant isolation

import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
	createAccessToken,
	createTestingApp,
	db,
	resetDb,
	seedClinic,
	seedUser,
} from "./utils/test-helper";

describe("E2E — Clinic Configuration (/users/vets + /availability)", () => {
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

	async function seedClinicWithAdminAndVet(subdomain: string): Promise<{
		tenant: { id: string; subdomain: string };
		admin: { id: string; email: string };
		vet: { id: string; email: string };
	}> {
		const bcrypt = require("bcrypt");
		const passwordHash = await bcrypt.hash("SecurePass123!", 10);
		const { tenant, user: admin } = await seedClinic(
			`Clínica ${subdomain}`,
			subdomain,
			`admin@${subdomain}.com`,
			passwordHash,
			"ADMIN",
		);
		const vet = await seedUser(tenant.id, `vet@${subdomain}.com`, passwordHash, "VET");
		return { tenant, admin, vet };
	}

	function adminToken(tenant: { id: string }, admin: { id: string; email: string }): string {
		return createAccessToken(admin.id, tenant.id, "ADMIN", admin.email);
	}

	it("✅ ADMIN creates a vet via POST /users/vets", async () => {
		const bcrypt = require("bcrypt");
		const passwordHash = await bcrypt.hash("SecurePass123!", 10);
		const { tenant, user: admin } = await seedClinic(
			"Clínica A",
			"clinica-a",
			"admin@clinica-a.com",
			passwordHash,
			"ADMIN",
		);

		const response = await request(app.getHttpServer())
			.post("/api/v1/users/vets")
			.set("Host", "clinica-a.localhost")
			.set(
				"Authorization",
				`Bearer ${createAccessToken(admin.id, tenant.id, "ADMIN", admin.email)}`,
			)
			.send({
				email: "vet@clinica-a.com",
				firstName: "María",
				lastName: "López",
				specialty: "Cirugía",
			});

		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({
			email: "vet@clinica-a.com",
			firstName: "María",
			lastName: "López",
			role: "VET",
			specialty: "Cirugía",
		});
		expect(db.users).toHaveLength(2);
		expect(db.userTenants.filter((ut: { role: string }) => ut.role === "VET")).toHaveLength(1);
		expect(db.vetProfiles).toHaveLength(1);
	});

	it("✅ ADMIN creates and lists availability slots", async () => {
		const { tenant, admin, vet } = await seedClinicWithAdminAndVet("clinica-a");

		const token = adminToken(tenant, admin);

		const createResponse = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`)
			.send({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" });

		expect(createResponse.status).toBe(201);
		expect(createResponse.body).toMatchObject({
			vetId: vet.id,
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "13:00",
		});

		const listResponse = await request(app.getHttpServer())
			.get(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`);

		expect(listResponse.status).toBe(200);
		expect(listResponse.body).toHaveLength(1);
	});

	it("❌ rejects overlapping availability slots with 409", async () => {
		const { tenant, admin, vet } = await seedClinicWithAdminAndVet("clinica-a");

		const token = adminToken(tenant, admin);

		await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`)
			.send({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" })
			.expect(201);

		const response = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`)
			.send({ dayOfWeek: 1, startTime: "12:00", endTime: "14:00" });

		expect(response.status).toBe(409);
		expect(db.vetAvailabilities).toHaveLength(1);
	});

	it("❌ rejects cross-midnight blocks with 400", async () => {
		const { tenant, admin, vet } = await seedClinicWithAdminAndVet("clinica-a");

		const response = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${adminToken(tenant, admin)}`)
			.send({ dayOfWeek: 1, startTime: "22:00", endTime: "02:00" });

		expect(response.status).toBe(400);
		expect(db.vetAvailabilities).toHaveLength(0);
	});

	it("❌ STAFF cannot create availability slots", async () => {
		const bcrypt = require("bcrypt");
		const passwordHash = await bcrypt.hash("SecurePass123!", 10);
		const { tenant, vet } = await seedClinicWithAdminAndVet("clinica-a");
		const staff = await seedUser(tenant.id, "staff@clinica-a.com", passwordHash, "STAFF");

		const token = createAccessToken(staff.id, tenant.id, "STAFF", staff.email);

		const response = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`)
			.send({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" });

		expect(response.status).toBe(403);
		expect(db.vetAvailabilities).toHaveLength(0);
	});

	it("✅ ADMIN deletes an availability slot", async () => {
		const { tenant, admin, vet } = await seedClinicWithAdminAndVet("clinica-a");

		const token = adminToken(tenant, admin);

		const createResponse = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`)
			.send({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" });

		const slotId = createResponse.body.id;

		const deleteResponse = await request(app.getHttpServer())
			.delete(`/api/v1/availability/slots/${slotId}`)
			.set("Host", "clinica-a.localhost")
			.set("Authorization", `Bearer ${token}`);

		expect(deleteResponse.status).toBe(200);
		expect(db.vetAvailabilities).toHaveLength(0);
	});

	it("❌ ADMIN from another tenant cannot create availability for this vet", async () => {
		const bcrypt = require("bcrypt");
		const passwordHash = await bcrypt.hash("SecurePass123!", 10);
		const { tenant: tenantA, vet } = await seedClinicWithAdminAndVet("clinica-a");
		const { tenant: tenantB, user: adminB } = await seedClinic(
			"Clínica B",
			"clinica-b",
			"admin@clinica-b.com",
			passwordHash,
			"ADMIN",
		);

		const tokenB = createAccessToken(adminB.id, tenantB.id, "ADMIN", adminB.email);

		const response = await request(app.getHttpServer())
			.post(`/api/v1/availability/vets/${vet.id}/slots`)
			.set("Host", "clinica-b.localhost")
			.set("Authorization", `Bearer ${tokenB}`)
			.send({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" });

		expect(response.status).toBe(404);
		expect(db.vetAvailabilities).toHaveLength(0);
		expect(db.tenants.map((t) => t.id).sort()).toEqual([tenantA.id, tenantB.id].sort());
	});
});
