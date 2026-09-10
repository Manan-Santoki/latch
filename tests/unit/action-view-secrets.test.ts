import { type VerificationAction, toActionView } from '@/src/verification/types';
import { describe, expect, it } from 'vitest';

// Security invariant (§17, §20): the view model handed to UI surfaces (overlay
// iframe, popup) must never carry the copy value or the exact URL. Copy/open are
// performed by the background via opaque action id.
describe('toActionView secret stripping', () => {
  const action: VerificationAction = {
    id: 'a1',
    messageDigest: 'd1',
    type: 'otp_code',
    senderDomain: 'github.com',
    receivedAt: 1000,
    detectedAt: 1000,
    code: { display: '824 193', copyValue: '824193' },
    link: {
      exactUrl: 'https://github.com/verify?token=SECRET_TOKEN_VALUE',
      hostname: 'github.com',
      registrableDomain: 'github.com',
    },
    localHideAfter: 999_999,
    confidence: { intent: 12, action: 8, total: 20 },
    risk: { level: 'normal', reasons: [] },
    state: 'detected',
  };

  it('exposes display + hostname but never copyValue or exactUrl', () => {
    const view = toActionView(action);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('824193'); // copyValue
    expect(serialized).not.toContain('SECRET_TOKEN_VALUE'); // exactUrl token
    expect(view.code?.display).toBe('824 193');
    expect(view.link?.hostname).toBe('github.com');
    // @ts-expect-error copyValue must not exist on the view's code
    expect(view.code?.copyValue).toBeUndefined();
    // @ts-expect-error exactUrl must not exist on the view's link
    expect(view.link?.exactUrl).toBeUndefined();
  });

  it('does not offer one-click open for a blocked-risk link', () => {
    const blocked = toActionView({
      ...action,
      risk: { level: 'blocked', reasons: ['mismatch'] },
    });
    expect(blocked.hasOpen).toBe(false);
  });
});
