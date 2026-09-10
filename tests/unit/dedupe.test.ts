import { isProcessed, markProcessed } from '@/src/actions/dedupe';
import { DEDUPE_MAX_AGE_MS, DEDUPE_MAX_ENTRIES } from '@/src/shared/constants';
import { getDedupe } from '@/src/storage/local';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('dedupe', () => {
  beforeEach(() => fakeBrowser.reset());

  it('marks and detects processed digests', async () => {
    expect(await isProcessed('d1')).toBe(false);
    await markProcessed('d1');
    expect(await isProcessed('d1')).toBe(true);
    expect(await isProcessed('d2')).toBe(false);
  });

  it('is idempotent for the same digest', async () => {
    await markProcessed('d1', 1000);
    await markProcessed('d1', 2000);
    expect((await getDedupe()).filter((e) => e.digest === 'd1')).toHaveLength(1);
  });

  it('prunes entries older than the max age', async () => {
    const nowMs = 1_000_000_000;
    await markProcessed('old', nowMs - DEDUPE_MAX_AGE_MS - 1);
    await markProcessed('fresh', nowMs);
    // marking 'fresh' at nowMs prunes anything older than the cutoff
    expect(await isProcessed('old')).toBe(false);
    expect(await isProcessed('fresh')).toBe(true);
  });

  it('caps the number of retained entries, keeping the most recent', async () => {
    const base = 1_000_000;
    for (let i = 0; i < DEDUPE_MAX_ENTRIES + 25; i++) {
      await markProcessed(`d${i}`, base + i);
    }
    const entries = await getDedupe();
    expect(entries.length).toBeLessThanOrEqual(DEDUPE_MAX_ENTRIES);
    // the newest digest survives; a very old one is evicted
    expect(await isProcessed(`d${DEDUPE_MAX_ENTRIES + 24}`)).toBe(true);
    expect(await isProcessed('d0')).toBe(false);
  });
});
