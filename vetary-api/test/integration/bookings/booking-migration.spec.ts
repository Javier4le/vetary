// 🧪 TEST: Additive booking migration created the table and enum (Strict TDD - RED phase)
// ⚡ PRINCIPIO: Migrations are code — their effect must be observable in the real database.

import { PrismaService } from "@/database/prisma.service";

describe("Booking migration (T-003)", () => {
	let prisma: PrismaService;

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.$connect();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("created the bookings table", async () => {
		const result = await prisma.$queryRaw<{ table_name: string }[]>`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			  AND table_name = 'bookings'
		`;

		expect(result).toHaveLength(1);
		expect(result[0]?.table_name).toBe("bookings");
	});

	it("created the BookingStatus enum", async () => {
		const result = await prisma.$queryRaw<{ typname: string }[]>`
			SELECT typname
			FROM pg_type
			WHERE typname = 'BookingStatus'
		`;

		expect(result).toHaveLength(1);
		expect(result[0]?.typname).toBe("BookingStatus");
	});

	it("created the two baseline indexes", async () => {
		const result = await prisma.$queryRaw<{ indexname: string }[]>`
			SELECT indexname
			FROM pg_indexes
			WHERE tablename = 'bookings'
			  AND indexname IN ('bookings_tenantId_vet_id_date_idx', 'bookings_tenantId_vet_id_start_instant_idx')
		`;

		expect(result).toHaveLength(2);
	});
});
