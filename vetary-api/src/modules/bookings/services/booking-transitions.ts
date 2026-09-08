import type { BookingStatus } from "@/database/prisma";

// 🏗️ ARQUITECTURA: Pure transition policy — no domain entity, no infrastructure dependency
// 📐 PATRÓN: Strategy-as-data — the allowed targets are a plain record keyed by source status
// ⚡ PRINCIPIO: Single Source of Truth — B06 lives in one place; services/controllers read it

/**
 * Exhaustive allowed transitions aligned with SPEC B06:
 * PENDING → {CONFIRMED, CANCELLED}
 * CONFIRMED → {IN_PROGRESS, CANCELLED}
 * IN_PROGRESS → {COMPLETED}
 * COMPLETED → {}
 * CANCELLED → {}
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
	PENDING: ["CONFIRMED", "CANCELLED"],
	CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
	IN_PROGRESS: ["COMPLETED"],
	COMPLETED: [],
	CANCELLED: [],
};

/**
 * Returns true iff `to` is a valid target status for `from`.
 * Pure function — deterministic, side-effect free, trivially unit-testable.
 */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
	return BOOKING_TRANSITIONS[from].includes(to);
}
