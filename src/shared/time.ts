/**
 * Latch — time helpers.
 *
 * Relative receipt-time formatting for the overlay/popup (§3.2: "Received 40
 * seconds ago"). We never claim a code expires at a particular time unless the
 * email explicitly provided it (§3.2, §16).
 */

/** Current epoch millis. Wrapped so tests can stub deterministically. */
export function now(): number {
  return Date.now();
}

/**
 * Format an elapsed duration as a coarse, human "… ago" phrase.
 * Returns just the relative portion, e.g. "40 seconds ago", "3 minutes ago".
 */
export function relativeAgo(fromMs: number, nowMs: number = now()): string {
  const deltaMs = Math.max(0, nowMs - fromMs);
  const sec = Math.round(deltaMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.round(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "Received 40 seconds ago" convenience for receipt timestamps. */
export function receivedAgo(receivedAtMs: number, nowMs: number = now()): string {
  const rel = relativeAgo(receivedAtMs, nowMs);
  return rel === 'just now' ? 'Received just now' : `Received ${rel}`;
}
