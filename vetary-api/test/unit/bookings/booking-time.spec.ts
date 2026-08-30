// 🧪 TEST: BookingTime — tenant-local wall-clock to normalized UTC instants
// ⚡ PRINCIPIO: Time is hard — isolate timezone/DST logic in one pure, exhaustively-tested helper.

import { checkAvailabilityFit, fromWallClock } from "@/modules/bookings/services/booking-time";

describe("BookingTime.fromWallClock (T-006)", () => {
	it("parses a valid HH:mm startTime and derives the endTime from duration", () => {
		const result = fromWallClock({
			date: "2026-09-07", // Monday
			startTime: "09:00",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(result.isValid).toBe(true);
		// Sep 7 is after spring-forward; Santiago is UTC-3, so 09:00 local = 12:00 UTC.
		expect(result.startInstant.toISOString()).toBe("2026-09-07T12:00:00.000Z");
		expect(result.endInstant.toISOString()).toBe("2026-09-07T12:30:00.000Z");
		expect(result.endTime).toBe("09:30");
	});

	it("interprets date + startTime in the tenant IANA timezone", () => {
		const result = fromWallClock({
			date: new Date(Date.UTC(2026, 8, 6, 0, 0, 0)), // Sep 6 2026
			startTime: "12:00",
			durationMinutes: 60,
			timezone: "America/Santiago",
		});

		expect(result.isValid).toBe(true);
		// Sep 6 is spring-forward day; by 12:00 the zone is already UTC-3, so local = UTC+3.
		expect(result.startInstant.toISOString()).toBe("2026-09-06T15:00:00.000Z");
		expect(result.endInstant.toISOString()).toBe("2026-09-06T16:00:00.000Z");
	});

	it("rejects an invalid HH:mm format", () => {
		for (const bad of ["9:00", "09:60", "24:00", "09-00", "", "09:00:00"]) {
			const result = fromWallClock({
				date: "2026-09-07",
				startTime: bad,
				durationMinutes: 30,
				timezone: "America/Santiago",
			});
			expect(result.isValid).toBe(false);
			expect(result.error).toMatch(/HH:mm|startTime/i);
		}
	});

	it("rejects a non-existent IANA timezone", () => {
		const result = fromWallClock({
			date: "2026-09-07",
			startTime: "09:00",
			durationMinutes: 30,
			timezone: "Mars/Phobos",
		});

		expect(result.isValid).toBe(false);
		expect(result.error).toMatch(/timezone|zone/i);
	});

	it("rejects a negative or zero duration", () => {
		for (const duration of [-30, 0]) {
			const result = fromWallClock({
				date: "2026-09-07",
				startTime: "09:00",
				durationMinutes: duration,
				timezone: "America/Santiago",
			});
			expect(result.isValid).toBe(false);
			expect(result.error).toMatch(/duration/i);
		}
	});

	it("rejects a spring-forward gap time in America/Santiago", () => {
		// Sep 6 2026 spring-forward: the local hour 00:00-00:59 does not exist.
		const result = fromWallClock({
			date: "2026-09-06",
			startTime: "00:30",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(result.isValid).toBe(false);
		expect(result.error).toMatch(/gap|non-existent|invalid/i);
	});

	it("rejects a fall-back ambiguous wall time in America/Santiago", () => {
		// Apr 4 2026 fall-back: the local hour 23:00-23:59 occurs twice (UTC-3 and UTC-4).
		const result = fromWallClock({
			date: "2026-04-04",
			startTime: "23:30",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(result.isValid).toBe(false);
		expect(result.error).toMatch(/ambiguous|invalid/i);
	});

	it("returns tenant-local weekday for availability fit checks", () => {
		const result = fromWallClock({
			date: "2026-09-07", // Monday
			startTime: "09:00",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(result.isValid).toBe(true);
		expect(result.weekday).toBe(1); // Luxon Monday
	});

	it("produces instants that are normalized for comparison (UTC Date objects)", () => {
		const result = fromWallClock({
			date: "2026-09-07",
			startTime: "09:00",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(result.startInstant).toBeInstanceOf(Date);
		expect(result.endInstant).toBeInstanceOf(Date);
		expect(result.endInstant.getTime()).toBeGreaterThan(result.startInstant.getTime());
	});
});

describe("BookingTime adjacency semantics", () => {
	it("treats adjacent intervals as non-overlapping (half-open)", () => {
		const first = fromWallClock({
			date: "2026-09-07",
			startTime: "09:00",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});
		const second = fromWallClock({
			date: "2026-09-07",
			startTime: "09:30",
			durationMinutes: 30,
			timezone: "America/Santiago",
		});

		expect(first.isValid && second.isValid).toBe(true);
		// Half-open: first.end === second.start, so they do NOT overlap.
		expect(first.endInstant.getTime()).toBe(second.startInstant.getTime());
		const overlap =
			first.startInstant < second.endInstant && first.endInstant > second.startInstant;
		expect(overlap).toBe(false);
	});
});

describe("BookingTime.checkAvailabilityFit", () => {
	it("returns true when the booking interval fits inside a block for the same weekday", () => {
		const fits = checkAvailabilityFit(1, "09:00", "09:30", [
			{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
		]);
		expect(fits).toBe(true);
	});

	it("returns false when the booking starts before the block", () => {
		const fits = checkAvailabilityFit(1, "08:30", "09:30", [
			{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
		]);
		expect(fits).toBe(false);
	});

	it("returns false when the booking ends after the block", () => {
		const fits = checkAvailabilityFit(1, "12:30", "13:30", [
			{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
		]);
		expect(fits).toBe(false);
	});

	it("returns false when no block matches the weekday", () => {
		const fits = checkAvailabilityFit(2, "09:00", "09:30", [
			{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
		]);
		expect(fits).toBe(false);
	});

	it("returns true when the booking fits any matching block", () => {
		const fits = checkAvailabilityFit(1, "10:00", "10:30", [
			{ dayOfWeek: 1, startTime: "09:00", endTime: "11:00" },
			{ dayOfWeek: 1, startTime: "14:00", endTime: "18:00" },
		]);
		expect(fits).toBe(true);
	});

	it("returns false for an empty block list", () => {
		expect(checkAvailabilityFit(1, "09:00", "09:30", [])).toBe(false);
	});
});
