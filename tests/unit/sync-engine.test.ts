import { GmailApiError } from '@/src/auth/auth-errors';
import * as client from '@/src/gmail/client';
import { computeBackoffMs, incrementalScan, recoverySync } from '@/src/gmail/sync-engine';
import { BACKOFF_MAX_MS } from '@/src/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/src/gmail/client', () => ({
  listHistoryPage: vi.fn(),
  getProfile: vi.fn(),
  listRecentInboxIds: vi.fn(),
}));

const TOKEN = 'tok';

beforeEach(() => {
  vi.mocked(client.listHistoryPage).mockReset();
  vi.mocked(client.getProfile).mockReset();
  vi.mocked(client.listRecentInboxIds).mockReset();
});

describe('incrementalScan', () => {
  it('returns no new messages and the latest historyId when history is empty', async () => {
    vi.mocked(client.listHistoryPage).mockResolvedValueOnce({
      messageIds: [],
      historyId: '1010',
      nextPageToken: undefined,
    });

    const result = await incrementalScan(TOKEN, '1000');

    expect(result).toEqual({ newMessageIds: [], latestHistoryId: '1010', needsRecovery: false });
    expect(client.listHistoryPage).toHaveBeenCalledWith(TOKEN, '1000', undefined);
  });

  it('collects a single added message', async () => {
    vi.mocked(client.listHistoryPage).mockResolvedValueOnce({
      messageIds: ['m1'],
      historyId: '1010',
    });

    const result = await incrementalScan(TOKEN, '1000');

    expect(result.newMessageIds).toEqual(['m1']);
    expect(result.needsRecovery).toBe(false);
  });

  it('collects multiple added messages', async () => {
    vi.mocked(client.listHistoryPage).mockResolvedValueOnce({
      messageIds: ['m1', 'm2', 'm3'],
      historyId: '1010',
    });

    const result = await incrementalScan(TOKEN, '1000');

    expect(result.newMessageIds).toEqual(['m1', 'm2', 'm3']);
  });

  it('dedupes message ids across pages, order-preserving', async () => {
    vi.mocked(client.listHistoryPage)
      .mockResolvedValueOnce({ messageIds: ['m1', 'm2'], historyId: '1005', nextPageToken: 'p2' })
      .mockResolvedValueOnce({
        messageIds: ['m2', 'm3'],
        historyId: '1010',
        nextPageToken: undefined,
      });

    const result = await incrementalScan(TOKEN, '1000');

    expect(result.newMessageIds).toEqual(['m1', 'm2', 'm3']);
    expect(result.latestHistoryId).toBe('1010');
  });

  it('follows nextPageToken through to completion and returns the newest historyId', async () => {
    vi.mocked(client.listHistoryPage)
      .mockResolvedValueOnce({ messageIds: ['m1'], historyId: '1005', nextPageToken: 'p2' })
      .mockResolvedValueOnce({ messageIds: ['m2'], historyId: '1008', nextPageToken: 'p3' })
      .mockResolvedValueOnce({ messageIds: ['m3'], historyId: '1010', nextPageToken: undefined });

    const result = await incrementalScan(TOKEN, '1000');

    expect(client.listHistoryPage).toHaveBeenCalledTimes(3);
    expect(client.listHistoryPage).toHaveBeenNthCalledWith(1, TOKEN, '1000', undefined);
    expect(client.listHistoryPage).toHaveBeenNthCalledWith(2, TOKEN, '1000', 'p2');
    expect(client.listHistoryPage).toHaveBeenNthCalledWith(3, TOKEN, '1000', 'p3');
    expect(result.newMessageIds).toEqual(['m1', 'm2', 'm3']);
    expect(result.latestHistoryId).toBe('1010');
  });

  it('on 404 stale history returns needsRecovery true and leaves the checkpoint unchanged', async () => {
    vi.mocked(client.listHistoryPage).mockRejectedValueOnce(new GmailApiError(404));

    const result = await incrementalScan(TOKEN, '1000');

    expect(result).toEqual({ newMessageIds: [], latestHistoryId: '1000', needsRecovery: true });
  });

  it('propagates a 401 unauthorized error', async () => {
    vi.mocked(client.listHistoryPage).mockRejectedValueOnce(new GmailApiError(401));

    await expect(incrementalScan(TOKEN, '1000')).rejects.toMatchObject({ status: 401 });
  });

  it('propagates a 429 rate-limited error', async () => {
    vi.mocked(client.listHistoryPage).mockRejectedValueOnce(new GmailApiError(429));

    await expect(incrementalScan(TOKEN, '1000')).rejects.toMatchObject({ status: 429 });
  });

  it('propagates a 500 server error', async () => {
    vi.mocked(client.listHistoryPage).mockRejectedValueOnce(new GmailApiError(500));

    await expect(incrementalScan(TOKEN, '1000')).rejects.toMatchObject({ status: 500 });
  });

  it('falls back to startHistoryId when no page reports a historyId', async () => {
    vi.mocked(client.listHistoryPage).mockResolvedValueOnce({ messageIds: [] });

    const result = await incrementalScan(TOKEN, '1000');

    expect(result.latestHistoryId).toBe('1000');
  });
});

describe('recoverySync', () => {
  it('combines recent inbox ids with a fresh profile historyId', async () => {
    vi.mocked(client.listRecentInboxIds).mockResolvedValueOnce(['a', 'b']);
    vi.mocked(client.getProfile).mockResolvedValueOnce({
      emailAddress: 'me@x.com',
      historyId: '2000',
    });

    const result = await recoverySync(TOKEN);

    expect(result).toEqual({ newMessageIds: ['a', 'b'], latestHistoryId: '2000' });
    expect(client.listRecentInboxIds).toHaveBeenCalledWith(TOKEN, 20);
  });

  it('passes a custom maxResults through', async () => {
    vi.mocked(client.listRecentInboxIds).mockResolvedValueOnce([]);
    vi.mocked(client.getProfile).mockResolvedValueOnce({
      emailAddress: 'me@x.com',
      historyId: '2000',
    });

    await recoverySync(TOKEN, 5);

    expect(client.listRecentInboxIds).toHaveBeenCalledWith(TOKEN, 5);
  });
});

describe('computeBackoffMs', () => {
  it('never exceeds BACKOFF_MAX_MS', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(computeBackoffMs(attempt)).toBeLessThanOrEqual(BACKOFF_MAX_MS);
    }
  });

  it('is never negative', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(computeBackoffMs(attempt)).toBeGreaterThanOrEqual(0);
    }
  });

  it('grows with attempt before hitting the cap (averaged over jitter)', () => {
    const average = (attempt: number) => {
      const samples = Array.from({ length: 50 }, () => computeBackoffMs(attempt));
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    };

    expect(average(2)).toBeGreaterThan(average(0));
    expect(average(4)).toBeGreaterThan(average(2));
  });

  it('caps out for large attempt numbers', () => {
    const samples = Array.from({ length: 20 }, () => computeBackoffMs(30));
    for (const sample of samples) {
      expect(sample).toBeLessThanOrEqual(BACKOFF_MAX_MS);
      expect(sample).toBeGreaterThan(BACKOFF_MAX_MS * 0.7);
    }
  });
});
