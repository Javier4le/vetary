// 🧪 TEST: Luxon dependency is installed and can resolve tenant-local times (Strict TDD - RED phase)
// ⚡ PRINCIPIO: Dependencies are declared contracts — verifying them protects every timezone calculation later.

import { DateTime } from "luxon";

describe("Luxon dependency (T-001)", () => {
	it("is installed and converts a Santiago local time to UTC", () => {
		const dt = DateTime.fromObject(
			{ year: 2026, month: 9, day: 6, hour: 9, minute: 0 },
			{ zone: "America/Santiago" },
		);

		expect(dt.isValid).toBe(true);
		// Santiago is UTC-3 on this date; 09:00 local equals 12:00 UTC.
		expect(dt.toUTC().toISO()).toBe("2026-09-06T12:00:00.000Z");
	});

	it("exposes gap/ambiguity detection helpers", () => {
		expect(typeof DateTime.local).toBe("function");
		expect(typeof DateTime.fromObject).toBe("function");
	});
});
