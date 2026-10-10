/* Insight: independent implementation (see NOTICE). Apache-2.0. */
export function hasSsoSessionExceededMaxAge(createdAt: Date, maxAgeSeconds: number, now: Date = new Date()): boolean {
	return now.getTime() - createdAt.getTime() >= maxAgeSeconds * 1000;
}
