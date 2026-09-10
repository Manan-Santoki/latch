/**
 * Latch — deduplication (§25).
 * Bounded set of opaque SHA-256 digests so a repeated Gmail history record or a
 * retried sync doesn't re-surface the same email event. Digests only — never code
 * or link content.
 */

import { DEDUPE_MAX_AGE_MS, DEDUPE_MAX_ENTRIES } from '../shared/constants';
import { now } from '../shared/time';
import { getDedupe, setDedupe } from '../storage/local';

export async function isProcessed(digest: string): Promise<boolean> {
  const entries = await getDedupe();
  return entries.some((e) => e.digest === digest);
}

export async function markProcessed(digest: string, nowMs: number = now()): Promise<void> {
  const entries = await getDedupe();
  if (entries.some((e) => e.digest === digest)) return;
  entries.push({ digest, seenAt: nowMs });

  // Prune by age, then cap the count (keep the most recent).
  const cutoff = nowMs - DEDUPE_MAX_AGE_MS;
  let pruned = entries.filter((e) => e.seenAt >= cutoff);
  if (pruned.length > DEDUPE_MAX_ENTRIES) {
    pruned = pruned
      .slice()
      .sort((a, b) => b.seenAt - a.seenAt)
      .slice(0, DEDUPE_MAX_ENTRIES);
  }
  await setDedupe(pruned);
}
