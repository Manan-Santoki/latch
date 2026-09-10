/**
 * Latch — Gmail REST client (§8, §9, §30).
 *
 * Thin, typed wrappers around the Gmail v1 REST endpoints Latch needs. Every
 * non-2xx response throws `GmailApiError(status)`; callers (src/gmail/sync-engine.ts,
 * the background) decide how to recover. This module never logs response bodies,
 * tokens, or URLs — only status codes ever leave a caught error here.
 */

import { GmailApiError } from '@/src/auth/auth-errors';
import type { GmailMessage } from '@/src/gmail/types';

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Raw shape of a `users.history.list` response (subset used by Latch). */
interface GmailHistoryListResponse {
  history?: Array<{
    id?: string;
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
  historyId?: string;
  nextPageToken?: string;
}

/** Raw shape of a `users.messages.list` response (subset used by Latch). */
interface GmailMessagesListResponse {
  messages?: Array<{ id?: string }>;
}

/** Raw shape of a `users.getProfile` response (subset used by Latch). */
interface GmailProfileResponse {
  emailAddress: string;
  historyId: string;
}

/** GET against the Gmail API with bearer auth; throws `GmailApiError` on non-2xx. */
async function gmailGet(path: string, token: string): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new GmailApiError(response.status);
  }
  return response;
}

/** `GET /profile` — the connected account's address and current history checkpoint. */
export async function getProfile(
  token: string,
): Promise<{ emailAddress: string; historyId: string }> {
  const response = await gmailGet('/profile', token);
  const data = (await response.json()) as GmailProfileResponse;
  return { emailAddress: data.emailAddress, historyId: data.historyId };
}

/**
 * `GET /history` for a single page of `messageAdded` events on `INBOX`, starting
 * after `startHistoryId`. Pass a prior page's `nextPageToken` to continue.
 * Message ids are deduped within this page only — callers dedupe across pages.
 */
export async function listHistoryPage(
  token: string,
  startHistoryId: string,
  pageToken?: string,
): Promise<{ messageIds: string[]; historyId?: string; nextPageToken?: string }> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: 'messageAdded',
    labelId: 'INBOX',
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await gmailGet(`/history?${params.toString()}`, token);
  const data = (await response.json()) as GmailHistoryListResponse;

  const seen = new Set<string>();
  const messageIds: string[] = [];
  for (const entry of data.history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      const id = added.message?.id;
      if (id !== undefined && !seen.has(id)) {
        seen.add(id);
        messageIds.push(id);
      }
    }
  }

  return {
    messageIds,
    historyId: data.historyId,
    nextPageToken: data.nextPageToken,
  };
}

/** `GET /messages/{id}?format=full` — the full message payload. */
export async function getMessage(token: string, id: string): Promise<GmailMessage> {
  const response = await gmailGet(`/messages/${encodeURIComponent(id)}?format=full`, token);
  return (await response.json()) as GmailMessage;
}

/** `GET /messages?labelIds=INBOX&maxResults=…` — candidate ids for recovery sync. */
export async function listRecentInboxIds(token: string, maxResults: number): Promise<string[]> {
  const params = new URLSearchParams({
    labelIds: 'INBOX',
    maxResults: String(maxResults),
  });

  const response = await gmailGet(`/messages?${params.toString()}`, token);
  const data = (await response.json()) as GmailMessagesListResponse;

  const ids: string[] = [];
  for (const message of data.messages ?? []) {
    if (message.id !== undefined) {
      ids.push(message.id);
    }
  }
  return ids;
}
