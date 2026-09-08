import { DateTime } from "luxon";

// 🏗️ ARQUITECTURA: Pure timezone helper — isolates Luxon/DST complexity from services
// 📐 PATRÓN: Value-object construction without a class — pure data in, pure data out
// ⚡ PRINCIPIO: Fail-Fast — reject ambiguous or non-existent wall times before any DB work

const HHMM_REGEX = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export interface BookingTimeInput {
	date: Date | string;
	startTime: string; // "HH:mm"
	durationMinutes: number;
	timezone: string; // IANA zone, e.g. "America/Santiago"
}

export interface BookingTimeResult {
	isValid: boolean;
	startInstant: Date;
	endInstant: Date;
	endTime: string;
	weekday: number;
	error?: string;
}

export interface AvailabilityBlock {
	dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... (Luxon convention)
	startTime: string; // "HH:mm"
	endTime: string; // "HH:mm"
}

interface ParsedWallClock {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

function parseHHMM(value: string): { hour: number; minute: number } | null {
	const match = HHMM_REGEX.exec(value);
	if (!match) return null;
	return {
		hour: Number.parseInt(match[1], 10),
		minute: Number.parseInt(match[2], 10),
	};
}

function parseDate(value: Date | string): ParsedWallClock | null {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return null;
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: 0,
		minute: 0,
	};
}

function minutesFromMidnight(time: string): number {
	const parsed = parseHHMM(time);
	if (!parsed) return -1;
	return parsed.hour * 60 + parsed.minute;
}

/**
 * Find every distinct offset the IANA zone uses on the given calendar date and
 * the day before/after. For each offset, compute the UTC instant that would
 * produce the requested wall clock with that offset, then verify that instant
 * really maps back to the same wall clock in the zone with that offset.
 *
 * - 0 candidates → the wall clock is in a spring-forward gap.
 * - 1 candidate  → a unique, unambiguous instant.
 * - 2+ candidates → a fall-back ambiguous wall time.
 *
 * B15: both gap and ambiguity are rejected with a 400-friendly error.
 */
function resolveUniqueInstant(
	wallClock: ParsedWallClock & { hour: number; minute: number },
	timezone: string,
): DateTime | null {
	const candidateOffsets = new Set<number>();
	for (const delta of [-1, 0, 1]) {
		const probe = DateTime.fromObject(
			{
				year: wallClock.year,
				month: wallClock.month,
				day: wallClock.day + delta,
				hour: 12,
				minute: 0,
			},
			{ zone: timezone },
		);
		if (probe.isValid) candidateOffsets.add(probe.offset);
	}

	const naiveUtc = DateTime.utc(
		wallClock.year,
		wallClock.month,
		wallClock.day,
		wallClock.hour,
		wallClock.minute,
	);
	if (!naiveUtc.isValid) return null;

	const candidates: DateTime[] = [];
	for (const offset of candidateOffsets) {
		const candidateInstant = naiveUtc.minus({ minutes: offset });
		const inZone = candidateInstant.setZone(timezone);
		if (
			inZone.isValid &&
			inZone.hour === wallClock.hour &&
			inZone.minute === wallClock.minute &&
			inZone.offset === offset
		) {
			candidates.push(inZone);
		}
	}

	if (candidates.length !== 1) return null;
	return candidates[0];
}

/**
 * Build a booking interval from tenant-local wall clock inputs.
 *
 * - `date` + `startTime` are interpreted in `timezone`.
 * - `endTime` is derived from `durationMinutes`; callers MUST NOT supply one.
 * - Non-existent (spring-forward gap) or ambiguous (fall-back duplicate) wall
 *   times are rejected per D3.
 * - Returned instants are UTC `Date` objects ready for half-open comparison.
 */
export function fromWallClock(input: BookingTimeInput): BookingTimeResult {
	const invalid = (error: string): BookingTimeResult => ({
		isValid: false,
		startInstant: new Date(0),
		endInstant: new Date(0),
		endTime: "",
		weekday: -1,
		error,
	});

	const parsedDate = parseDate(input.date);
	if (!parsedDate) return invalid("Invalid date");

	const start = parseHHMM(input.startTime);
	if (!start) return invalid("startTime must be a valid HH:mm string");

	if (!input.timezone || typeof input.timezone !== "string") {
		return invalid("timezone must be a valid IANA string");
	}
	if (!DateTime.now().setZone(input.timezone).isValid) {
		return invalid("timezone is not a valid IANA zone");
	}

	if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
		return invalid("durationMinutes must be a positive number");
	}

	const wallClock = { ...parsedDate, hour: start.hour, minute: start.minute };
	const localStart = resolveUniqueInstant(wallClock, input.timezone);
	if (!localStart) {
		return invalid(
			"Invalid local time: the requested wall clock falls in a DST gap or is ambiguous",
		);
	}

	const localEnd = localStart.plus({ minutes: input.durationMinutes });
	const endHour = localEnd.hour;
	const endMinute = localEnd.minute;
	const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

	return {
		isValid: true,
		startInstant: localStart.toUTC().toJSDate(),
		endInstant: localEnd.toUTC().toJSDate(),
		endTime,
		weekday: localStart.weekday,
	};
}

/**
 * Returns true when the booking wall-clock interval is fully contained in at
 * least one availability block for the same tenant-local weekday.
 */
export function checkAvailabilityFit(
	bookingWeekday: number,
	bookingStartTime: string,
	bookingEndTime: string,
	blocks: AvailabilityBlock[],
): boolean {
	const bookingStartMin = minutesFromMidnight(bookingStartTime);
	const bookingEndMin = minutesFromMidnight(bookingEndTime);
	if (bookingStartMin < 0 || bookingEndMin < 0 || bookingStartMin >= bookingEndMin) {
		return false;
	}

	return blocks.some((block) => {
		if (block.dayOfWeek !== bookingWeekday) return false;
		const blockStartMin = minutesFromMidnight(block.startTime);
		const blockEndMin = minutesFromMidnight(block.endTime);
		if (blockStartMin < 0 || blockEndMin < 0 || blockStartMin >= blockEndMin) return false;
		return bookingStartMin >= blockStartMin && bookingEndMin <= blockEndMin;
	});
}
