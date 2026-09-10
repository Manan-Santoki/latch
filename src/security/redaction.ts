/**
 * Latch — redaction utilities (§21 diagnostics, §32 threat model).
 *
 * Centralized so there is exactly one place that decides how sensitive values are
 * kept out of logs, diagnostics, and error reporting. Nothing in Latch should call
 * `console.*` with a raw OTP, verification URL, message body, token, or full
 * browsing URL — route diagnostics through `scrub`/`logger` here.
 *
 * These functions must never THROW: diagnostics must not become a failure path.
 */

const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;
// Standalone 4–8 digit runs (OTP-shaped). Bounded by non-digits so we don't eat
// long ids; those are handled by the token rule.
const CODE_RE = /(?<!\d)\d{4,8}(?!\d)/g;
// Long opaque alphanumeric runs (magic-link tokens, base64-ish blobs).
const TOKEN_RE = /\b[A-Za-z0-9_-]{20,}\b/g;

/** Reduce a URL to scheme + host only (drops path/query/fragment token material). */
export function hostnameOnly(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return '[invalid-url]';
  }
}

/** Describe a code without revealing it, e.g. "6-char code". */
export function maskCode(code: string): string {
  return `${code.replace(/\s+/g, '').length}-char code`;
}

/**
 * Scrub a free-text string for safe logging: URLs collapse to host, OTP-shaped
 * digit runs and long token-like blobs are masked. Always returns a string.
 */
export function scrub(input: unknown): string {
  let text: string;
  try {
    text = typeof input === 'string' ? input : String(input);
  } catch {
    return '[unprintable]';
  }
  return text
    .replace(URL_RE, (m) => hostnameOnly(m))
    .replace(TOKEN_RE, '[token]')
    .replace(CODE_RE, '[code]');
}

/** Sanitize an unknown error into a loggable shape with no sensitive payload. */
export function sanitizeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: scrub(err.message) };
  }
  return { name: 'Error', message: scrub(err) };
}

/**
 * Logger that scrubs every argument before it reaches the console. Use this in
 * privileged/background code instead of `console.*` directly.
 */
export const logger = {
  info(...args: unknown[]): void {
    console.info('[Latch]', ...args.map(scrub));
  },
  warn(...args: unknown[]): void {
    console.warn('[Latch]', ...args.map(scrub));
  },
  error(...args: unknown[]): void {
    console.error('[Latch]', ...args.map(scrub));
  },
};
