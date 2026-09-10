/**
 * Latch — Gmail sync orchestration (§9, §30, §36).
 *
 * Sits on top of src/gmail/client.ts: pages through history, dedupes across pages,
 * tracks the history checkpoint, and falls back to a narrow recovery sync when the
 * checkpoint goes stale (404). Does no parsing/classification — callers take the
 * returned message ids and fetch/parse them separately (§10+).
 */

import { GmailApiError, classifyStatus } from '@/src/auth/auth-errors';
import { getProfile, listHistoryPage, listRecentInboxIds } from '@/src/gmail/client';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS } from '@/src/shared/constants';

/**
 * Page through `history.list` from `startHistoryId` until `nextPageToken` runs
 * out, unioning added message ids (order-preserving, deduped across pages) and
 * tracking the newest top-level `historyId` seen.
 *
 * On a 404 (stale history — §9.4) this returns an empty result with
 * `needsRecovery: true` and the checkpoint unchanged, rather than throwing. Any
 * other error propagates for the caller to handle (backoff/reauth, §9.5).
 */
export async function incrementalScan(
  token: string,
  startHistoryId: string,
): Promise<{ newMessageIds: string[]; latestHistoryId: string; needsRecovery: boolean }> {
  const seen = new Set<string>();
  const newMessageIds: string[] = [];
  let latestHistoryId = startHistoryId;
  let pageToken: string | undefined;

  try {
    do {
      const page = await listHistoryPage(token, startHistoryId, pageToken);
      for (const id of page.messageIds) {
        if (!seen.has(id)) {
          seen.add(id);
          newMessageIds.push(id);
        }
      }
      if (page.historyId) {
        latestHistoryId = page.historyId;
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  } catch (err) {
    if (err instanceof GmailApiError && classifyStatus(err.status) === 'stale_history') {
      return { newMessageIds: [], latestHistoryId: startHistoryId, needsRecovery: true };
    }
    throw err;
  }

  return { newMessageIds, latestHistoryId, needsRecovery: false };
}

/**
 * Narrow recovery sync (§9.4): used after a stale-history 404 or on bootstrap.
 * Lists recent inbox message ids as candidates and fetches a fresh `historyId`
 * checkpoint to resume incremental polling from.
 */
export async function recoverySync(
  token: string,
  maxResults = 20,
): Promise<{ newMessageIds: string[]; latestHistoryId: string }> {
  const [newMessageIds, profile] = await Promise.all([
    listRecentInboxIds(token, maxResults),
    getProfile(token),
  ]);
  return { newMessageIds, latestHistoryId: profile.historyId };
}

/**
 * Truncated exponential backoff with jitter for 429/5xx retries (§9.5).
 * `attempt` is 0-based. Never exceeds `BACKOFF_MAX_MS`.
 */
export function computeBackoffMs(attempt: number): number {
  const exponential = BACKOFF_BASE_MS * 2 ** Math.max(0, attempt);
  const capped = Math.min(exponential, BACKOFF_MAX_MS);
  const jitterFactor = 1 + (Math.random() * 0.4 - 0.2); // ±20%
  return Math.min(Math.max(0, Math.round(capped * jitterFactor)), BACKOFF_MAX_MS);
}
