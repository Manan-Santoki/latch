import { getSettings, setSettings } from '@/src/storage/local';
import { DEFAULT_SETTINGS } from '@/src/storage/schemas';
import { getActiveActions, setActiveActions } from '@/src/storage/session';
import type { VerificationAction } from '@/src/verification/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Smoke test proving the WxtVitest fake-browser harness + storage wrappers work,
// so the parallel logic agents can rely on it.
describe('storage wrappers (fake browser)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when empty and round-trips settings', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    const next = await setSettings({ autoCopy: true });
    expect(next.autoCopy).toBe(true);
    expect((await getSettings()).autoCopy).toBe(true);
    // auto-copy default stays off unless explicitly set
    expect(DEFAULT_SETTINGS.autoCopy).toBe(false);
  });

  it('round-trips active actions through session storage', async () => {
    expect(await getActiveActions()).toEqual([]);
    const action: VerificationAction = {
      id: 'a1',
      messageDigest: 'd1',
      type: 'otp_code',
      receivedAt: 1000,
      detectedAt: 1000,
      code: { display: '824 193', copyValue: '824193' },
      localHideAfter: 999999,
      confidence: { intent: 8, action: 6, total: 14 },
      risk: { level: 'normal', reasons: [] },
      state: 'detected',
    };
    await setActiveActions([action]);
    const read = await getActiveActions();
    expect(read).toHaveLength(1);
    expect(read[0]?.code?.copyValue).toBe('824193');
  });
});
