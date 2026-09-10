/**
 * Latch — registrable-domain primitives (§6.4, §14).
 *
 * Shared CONTRACT (owned centrally because link scoring, site matching, and URL
 * display all need identical domain semantics). Built on `tldts` for correct
 * eTLD+1 / public-suffix handling. NEVER compare hostnames with substring checks —
 * `github.com.evil.example` and `github.com@evil.example` must not match github.com.
 * Always compare the registrable domain returned here.
 */

import { getDomain, getHostname, parse } from 'tldts';

/** Registrable domain (eTLD+1) of a hostname or URL, lower-cased, or null. */
export function registrableDomain(input: string): string | null {
  return getDomain(input);
}

/** Canonical ASCII hostname of a hostname or URL, or null. */
export function hostname(input: string): string | null {
  return getHostname(input);
}

/**
 * True when both inputs resolve to the same non-null registrable domain.
 * e.g. accounts.github.com vs mail.github.com → true; github.com.evil.example
 * vs github.com → false.
 */
export function sameRegistrableDomain(a: string, b: string): boolean {
  const da = getDomain(a);
  const db = getDomain(b);
  return da !== null && da === db;
}

/** True when the input host is an IP literal (no registrable domain). */
export function isIpLiteral(input: string): boolean {
  return parse(input).isIp === true;
}

/** True when any hostname label is punycode (xn--…), which warrants caution. */
export function isPunycode(input: string): boolean {
  const host = getHostname(input);
  if (!host) return false;
  return host.split('.').some((label) => label.startsWith('xn--'));
}
