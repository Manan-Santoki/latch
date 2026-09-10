/**
 * Latch — reduce a tab URL to the minimal current-site identity (§26).
 *
 * Privacy-preserving current-site matching: the raw tab URL is reduced to
 * `{ origin, hostname, registrableDomain }` immediately. Path, query,
 * fragment, page text, and form contents are NEVER retained.
 */

import { hostname, registrableDomain } from './domain';
import type { CurrentSite } from './types';

/**
 * Reduce a raw tab URL to `{ origin, hostname, registrableDomain }`.
 * Returns null for non-http(s) or unparseable URLs.
 */
export function toCurrentSite(rawUrl: string): CurrentSite | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = hostname(rawUrl);
  if (!host) return null;

  return {
    origin: parsed.origin,
    hostname: host,
    registrableDomain: registrableDomain(rawUrl),
  };
}
