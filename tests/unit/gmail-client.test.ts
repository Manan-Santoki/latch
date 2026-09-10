import { GmailApiError } from '@/src/auth/auth-errors';
import { getMessage, getProfile, listHistoryPage, listRecentInboxIds } from '@/src/gmail/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const TOKEN = 'test-token';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('getProfile', () => {
  it('GETs /profile and returns emailAddress + historyId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { emailAddress: 'me@example.com', historyId: '1000' }),
    );

    const result = await getProfile(TOKEN);

    expect(result).toEqual({ emailAddress: 'me@example.com', historyId: '1000' });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('throws GmailApiError(401) on an unauthorized response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { error: 'invalid_token' }));

    const pending = getProfile(TOKEN);
    await expect(pending).rejects.toBeInstanceOf(GmailApiError);
    await expect(pending).rejects.toMatchObject({ status: 401 });
  });

  it('throws GmailApiError(429) on rate limiting', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(429, {}));
    await expect(getProfile(TOKEN)).rejects.toMatchObject({ status: 429 });
  });

  it('throws GmailApiError(500) on server errors', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, {}));
    await expect(getProfile(TOKEN)).rejects.toMatchObject({ status: 500 });
  });
});

describe('listHistoryPage', () => {
  it('returns no message ids when history has no messageAdded entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { historyId: '1010' }));

    const result = await listHistoryPage(TOKEN, '1000');

    expect(result).toEqual({ messageIds: [], historyId: '1010', nextPageToken: undefined });
  });

  it('extracts a single added message id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        history: [{ id: '1005', messagesAdded: [{ message: { id: 'm1' } }] }],
        historyId: '1010',
      }),
    );

    const result = await listHistoryPage(TOKEN, '1000');

    expect(result.messageIds).toEqual(['m1']);
    expect(result.historyId).toBe('1010');
  });

  it('extracts multiple added message ids across history entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        history: [
          { id: '1005', messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm2' } }] },
          { id: '1006', messagesAdded: [{ message: { id: 'm3' } }] },
        ],
        historyId: '1010',
      }),
    );

    const result = await listHistoryPage(TOKEN, '1000');

    expect(result.messageIds).toEqual(['m1', 'm2', 'm3']);
  });

  it('dedupes duplicate message ids within a single page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        history: [
          { id: '1005', messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm1' } }] },
          { id: '1006', messagesAdded: [{ message: { id: 'm2' } }] },
        ],
        historyId: '1010',
      }),
    );

    const result = await listHistoryPage(TOKEN, '1000');

    expect(result.messageIds).toEqual(['m1', 'm2']);
  });

  it('passes pageToken through and returns nextPageToken', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        history: [{ id: '1005', messagesAdded: [{ message: { id: 'm1' } }] }],
        historyId: '1010',
        nextPageToken: 'page2',
      }),
    );

    const result = await listHistoryPage(TOKEN, '1000', 'page1');

    expect(result.nextPageToken).toBe('page2');
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('pageToken=page1');
    expect(url).toContain('startHistoryId=1000');
    expect(url).toContain('historyTypes=messageAdded');
    expect(url).toContain('labelId=INBOX');
  });

  it('throws GmailApiError(404) for a stale history id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(404, { error: 'not_found' }));

    await expect(listHistoryPage(TOKEN, 'stale')).rejects.toMatchObject({ status: 404 });
  });
});

describe('getMessage', () => {
  it('GETs the full message by id', async () => {
    const message = { id: 'm1', threadId: 't1', payload: { mimeType: 'text/plain' } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, message));

    const result = await getMessage(TOKEN, 'm1');

    expect(result).toEqual(message);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1?format=full');
  });
});

describe('listRecentInboxIds', () => {
  it('returns message ids from the list response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { messages: [{ id: 'a' }, { id: 'b' }] }),
    );

    const result = await listRecentInboxIds(TOKEN, 10);

    expect(result).toEqual(['a', 'b']);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('labelIds=INBOX');
    expect(url).toContain('maxResults=10');
  });

  it('returns an empty array when there are no messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, {}));

    const result = await listRecentInboxIds(TOKEN, 10);

    expect(result).toEqual([]);
  });
});
