// 🧪 TEST: Booking status transition policy — exhaustive matrix aligned with SPEC B06/B07 and D7
// ⚡ PRINCIPIO: State machine as pure data — trivially testable, no infrastructure, no surprises.

import { $Enums } from "@/database/prisma";
import {
	BOOKING_TRANSITIONS,
	canTransition,
} from "@/modules/bookings/services/booking-transitions";

const STATUSES = Object.values($Enums.BookingStatus);

describe("Booking transitions (T-004)", () => {
	it("allows PENDING → CONFIRMED", () => {
		expect(canTransition($Enums.BookingStatus.PENDING, $Enums.BookingStatus.CONFIRMED)).toBe(true);
	});

	it("allows PENDING → CANCELLED", () => {
		expect(canTransition($Enums.BookingStatus.PENDING, $Enums.BookingStatus.CANCELLED)).toBe(true);
	});

	it("allows CONFIRMED → IN_PROGRESS", () => {
		expect(canTransition($Enums.BookingStatus.CONFIRMED, $Enums.BookingStatus.IN_PROGRESS)).toBe(
			true,
		);
	});

	it("allows CONFIRMED → CANCELLED", () => {
		expect(canTransition($Enums.BookingStatus.CONFIRMED, $Enums.BookingStatus.CANCELLED)).toBe(
			true,
		);
	});

	it("allows IN_PROGRESS → COMPLETED", () => {
		expect(canTransition($Enums.BookingStatus.IN_PROGRESS, $Enums.BookingStatus.COMPLETED)).toBe(
			true,
		);
	});

	it("denies every transition from COMPLETED", () => {
		for (const to of STATUSES) {
			expect(canTransition($Enums.BookingStatus.COMPLETED, to)).toBe(false);
		}
	});

	it("denies every transition from CANCELLED", () => {
		for (const to of STATUSES) {
			expect(canTransition($Enums.BookingStatus.CANCELLED, to)).toBe(false);
		}
	});

	it("denies invalid transitions between non-terminal states", () => {
		expect(canTransition($Enums.BookingStatus.PENDING, $Enums.BookingStatus.IN_PROGRESS)).toBe(
			false,
		);
		expect(canTransition($Enums.BookingStatus.PENDING, $Enums.BookingStatus.COMPLETED)).toBe(false);
		expect(canTransition($Enums.BookingStatus.CONFIRMED, $Enums.BookingStatus.PENDING)).toBe(false);
		expect(canTransition($Enums.BookingStatus.CONFIRMED, $Enums.BookingStatus.COMPLETED)).toBe(
			false,
		);
		expect(canTransition($Enums.BookingStatus.IN_PROGRESS, $Enums.BookingStatus.PENDING)).toBe(
			false,
		);
		expect(canTransition($Enums.BookingStatus.IN_PROGRESS, $Enums.BookingStatus.CONFIRMED)).toBe(
			false,
		);
		expect(canTransition($Enums.BookingStatus.IN_PROGRESS, $Enums.BookingStatus.CANCELLED)).toBe(
			false,
		);
	});

	it("exposes terminal states with empty allowed arrays", () => {
		expect(BOOKING_TRANSITIONS[$Enums.BookingStatus.COMPLETED]).toEqual([]);
		expect(BOOKING_TRANSITIONS[$Enums.BookingStatus.CANCELLED]).toEqual([]);
	});

	it("has no automatic no-show transition or status (D7)", () => {
		expect(BOOKING_TRANSITIONS[$Enums.BookingStatus.CONFIRMED]).not.toContain("NO_SHOW");
		expect(STATUSES).not.toContain("NO_SHOW");
		expect(Object.keys(BOOKING_TRANSITIONS)).not.toContain("NO_SHOW");
	});
});
