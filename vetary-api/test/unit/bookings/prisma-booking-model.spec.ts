// 🧪 TEST: Generated Prisma client exposes BookingStatus enum and Booking delegate (Strict TDD - RED phase)
// ⚡ PRINCIPIO: Schema as Code — the data model must be reflected in the generated TypeScript client.

import { $Enums } from "@/database/prisma";
import { PrismaService } from "@/database/prisma.service";

describe("Prisma Booking model (T-002)", () => {
	it("exposes the booking delegate on the generated client", () => {
		const prisma = new PrismaService();

		expect(prisma.booking).toBeDefined();
		expect(typeof prisma.booking.findMany).toBe("function");
		expect(typeof prisma.booking.create).toBe("function");
	});

	it("exposes the BookingStatus enum values", () => {
		expect($Enums.BookingStatus.PENDING).toBe("PENDING");
		expect($Enums.BookingStatus.CONFIRMED).toBe("CONFIRMED");
		expect($Enums.BookingStatus.IN_PROGRESS).toBe("IN_PROGRESS");
		expect($Enums.BookingStatus.CANCELLED).toBe("CANCELLED");
		expect($Enums.BookingStatus.COMPLETED).toBe("COMPLETED");
	});
});
