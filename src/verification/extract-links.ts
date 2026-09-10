/**
 * Latch — verification-link extraction (§13).
 *
 * Reads only the hostname/text already present in the parsed email (§13.3):
 * never fetches, HEAD-requests, or resolves a link merely to discover its
 * destination. `email.links[].valid` already encodes url-policy's https-only
 * gate (excludes mailto:/tel:/javascript:/data:/http: and malformed URLs) —
 * this module trusts that gate and only scores + ranks what passes it.
 */

import type { ParsedEmail } from '@/src/gmail/types';
import { registrableDomain, hostname as resolveHostname } from '@/src/matching/domain';
import { MIN_ACTION_SCORE } from '@/src/shared/constants';
import type { LinkCandidate } from '@/src/verification/types';
import { scoreLink } from './score-link';

/**
 * Extract, score, and rank verification-link candidates from a parsed email
 * (§13). Only `valid` `https:` links qualify (§3.3); each candidate keeps its
 * exact original URL verbatim for the eventual user-directed open (§6.5) — query
 * parameters and fragments are never rewritten.
 */
export function extractVerificationLinks(email: ParsedEmail): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];

  for (const link of email.links) {
    if (!link.valid) continue;

    let scheme = link.scheme;
    if (!scheme) {
      try {
        scheme = new URL(link.href).protocol;
      } catch {
        continue;
      }
    }
    if (scheme !== 'https:') continue;

    const host = resolveHostname(link.href) ?? link.hostname ?? '';
    const regDomain = registrableDomain(link.href) ?? undefined;
    const { score, risk } = scoreLink(link);

    candidates.push({
      exactUrl: link.href,
      hostname: host,
      registrableDomain: regDomain,
      scheme,
      anchorText: link.anchorText,
      score,
      risk,
    });
  }

  return candidates.filter((c) => c.score >= MIN_ACTION_SCORE).sort((a, b) => b.score - a.score);
}
