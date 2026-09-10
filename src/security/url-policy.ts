/**
 * Latch — URL safety policy (§6.4).
 *
 * All normal-action URL handling (link display, one-click open) goes through this
 * module. Never judge a URL by substring checks against a hostname — deceptive
 * values such as `github.com.evil.example` or `github.com@evil.example` are valid
 * URLs whose true hostname must be read via `URL.hostname` and compared with the
 * registrable-domain helpers in `@/src/matching/domain`, not this module.
 */

import { isIpLiteral, isPunycode } from '@/src/matching/domain';

/** Schemes explicitly called out as unsafe/unsupported for the normal one-click flow. */
const REJECTED_SCHEMES = new Set([
  'javascript:',
  'data:',
  'file:',
  'blob:',
  'chrome:',
  'chrome-extension:',
  'http:',
  'mailto:',
  'tel:',
]);

export interface UrlPolicy {
  /** True only when the URL parses and uses the `https:` scheme. */
  valid: boolean;
  /** The URL's scheme (including trailing colon), or '' if unparseable. */
  scheme: string;
  /** The canonical ASCII hostname, when parseable. */
  hostname?: string;
  /** Reasons for rejection/caution. Non-fatal flags ('ip_literal', 'punycode') may
   *  be present alongside valid: true. */
  reasons: string[];
}

/** Safe wrapper over `new URL()` — never throws. */
export function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Evaluate a raw URL string against Latch's URL safety policy. `valid` is true
 * only for well-formed `https:` URLs. The returned hostname is always the true
 * parsed hostname — never derived from substring matching.
 */
export function evaluateUrl(raw: string): UrlPolicy {
  const parsed = parseUrl(raw);

  if (!parsed) {
    return { valid: false, scheme: '', reasons: ['malformed_url'] };
  }

  const scheme = parsed.protocol;
  const hostname = parsed.hostname || undefined;
  const reasons: string[] = [];

  if (REJECTED_SCHEMES.has(scheme)) {
    reasons.push(`rejected_scheme:${scheme}`);
  } else if (scheme !== 'https:') {
    reasons.push(`rejected_scheme:${scheme}`);
  }

  if (hostname) {
    if (isIpLiteral(hostname)) {
      reasons.push('ip_literal');
    }
    if (isPunycode(hostname)) {
      reasons.push('punycode');
    }
  }

  const valid = scheme === 'https:' && !reasons.some((r) => r.startsWith('rejected_scheme:'));

  return { valid, scheme, hostname, reasons };
}

/** True iff the raw string parses and uses `https:` — the gate for the one-click flow. */
export function isAllowedForOneClick(raw: string): boolean {
  const parsed = parseUrl(raw);
  return parsed !== null && parsed.protocol === 'https:';
}
