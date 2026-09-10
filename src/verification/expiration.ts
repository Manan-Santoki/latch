/**
 * Latch — action expiration (§16).
 *
 * Only records an explicit expiry when the email plainly states a
 * machine-parseable window ("expires in 10 minutes", "valid for 30 seconds").
 * Deliberately no clever natural-language date/time parsing — anything not in
 * this narrow shape is left unset, and the default local relevance window
 * (`DEFAULT_ACTION_TTL_MS`, applied elsewhere) governs instead.
 */

import type { ParsedEmail } from '@/src/gmail/types';
import { resolveBodyText } from './classify-message';

interface ExpiryPattern {
  regex: RegExp;
  toMs: (n: number) => number;
}

const PATTERNS: ExpiryPattern[] = [
  { regex: /\b(?:expires?|valid)\s+(?:in|for)\s+(\d{1,3})\s*seconds?\b/i, toMs: (n) => n * 1000 },
  { regex: /\b(?:expires?|valid)\s+(?:in|for)\s+(\d{1,3})\s*minutes?\b/i, toMs: (n) => n * 60_000 },
  {
    regex: /\b(?:expires?|valid)\s+(?:in|for)\s+(\d{1,2})\s*hours?\b/i,
    toMs: (n) => n * 3_600_000,
  },
];

/**
 * Extract an explicit, machine-parseable expiry window from the email and
 * return `receivedAt + window`, or `undefined` when no such plain statement is
 * present. Never guesses from ambiguous phrasing (e.g. "expires soon").
 */
export function parseExplicitExpiry(email: ParsedEmail, receivedAt: number): number | undefined {
  const subject = email.subject ?? '';
  const body = resolveBodyText(email);
  const text = `${subject}\n${body}`;

  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    const raw = match?.[1];
    if (!raw) continue;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    return receivedAt + pattern.toMs(n);
  }

  return undefined;
}
