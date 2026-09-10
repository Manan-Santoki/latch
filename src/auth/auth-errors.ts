/**
 * Latch — Gmail/auth error classification (§8, §9.5).
 *
 * `GmailApiError` is the single error type thrown by the Gmail REST client
 * (src/gmail/client.ts) for any non-2xx response. `classifyStatus`/`classifyError`
 * map a raw HTTP status (or unknown thrown value) onto the small set of recovery
 * strategies the sync engine and background need to pick between.
 */

/** Thrown by the Gmail REST client for any non-2xx response. */
export class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Gmail API request failed with status ${status}`);
    this.name = 'GmailApiError';
    this.status = status;
  }
}

export type GmailErrorKind =
  | 'unauthorized'
  | 'stale_history'
  | 'rate_limited'
  | 'server'
  | 'forbidden'
  | 'other';

/** Map a raw HTTP status code onto a recovery strategy (§9.5). */
export function classifyStatus(status: number): GmailErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'stale_history';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status < 600) return 'server';
  return 'other';
}

/** Classify an unknown thrown value; only `GmailApiError` carries a status. */
export function classifyError(err: unknown): GmailErrorKind {
  if (err instanceof GmailApiError) return classifyStatus(err.status);
  return 'other';
}
