/**
 * Latch — Gmail header helpers (§10).
 */

import type { EmailAddress, GmailHeader } from '@/src/gmail/types';

/** Case-insensitive header lookup. */
export function getHeader(headers: GmailHeader[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const header of headers) {
    if (header.name.toLowerCase() === target) {
      return header.value;
    }
  }
  return undefined;
}

/** Strip a single layer of matching surrounding quotes, if present. */
function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

// Matches `Display Name <addr@host>` allowing the display name to be optional.
const ANGLE_ADDR_RE = /^(.*)<([^<>]+)>\s*$/;

/**
 * Parse a `From` header value into structured parts. Handles `Display Name
 * <addr@host>` and bare `addr@host` forms. `raw` always preserves the input
 * verbatim.
 */
export function parseFromHeader(raw: string): EmailAddress {
  const result: EmailAddress = { raw };
  const trimmed = raw.trim();
  if (!trimmed) {
    return result;
  }

  const match = ANGLE_ADDR_RE.exec(trimmed);
  let address: string | undefined;
  let displayName: string | undefined;

  if (match) {
    const namePart = (match[1] ?? '').trim();
    const addrPart = (match[2] ?? '').trim();
    if (namePart) {
      displayName = stripQuotes(namePart);
    }
    if (addrPart) {
      address = addrPart;
    }
  } else if (trimmed.includes('@')) {
    address = trimmed;
  }

  if (displayName) {
    result.displayName = displayName;
  }
  if (address) {
    result.address = address;
    const atIndex = address.lastIndexOf('@');
    if (atIndex !== -1 && atIndex < address.length - 1) {
      result.domain = address.slice(atIndex + 1).toLowerCase();
    }
  }

  return result;
}

/** Gmail `internalDate` is epoch-ms as a string. Returns 0 if missing/invalid. */
export function decodeInternalDate(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
