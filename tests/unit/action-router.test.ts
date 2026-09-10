import { buildAction, worseRisk } from '@/src/actions/action-router';
import type { ParsedEmail } from '@/src/gmail/types';
import { DEFAULT_ACTION_TTL_MS } from '@/src/shared/constants';
import type { DetectedEvent } from '@/src/verification/types';
import { describe, expect, it } from 'vitest';

const event: DetectedEvent = {
  type: 'otp_code',
  code: { display: '824 193', copyValue: '824193' },
  intentScore: 12,
  actionScore: 8,
  risk: { level: 'normal', reasons: [] },
};

const email: ParsedEmail = {
  messageId: 'm1',
  internalDate: 1000,
  from: {
    raw: 'GitHub <no-reply@github.com>',
    displayName: 'GitHub',
    address: 'no-reply@github.com',
    domain: 'github.com',
  },
  subject: 'Your verification code',
  plainText: 'Your code is 824193',
  htmlText: '',
  links: [],
};

describe('worseRisk', () => {
  it('keeps the more severe level and unions reasons', () => {
    expect(worseRisk({ level: 'normal', reasons: ['a'] }, 'blocked', ['b'])).toEqual({
      level: 'blocked',
      reasons: ['a', 'b'],
    });
  });
  it('does not downgrade an existing higher risk', () => {
    expect(worseRisk({ level: 'blocked', reasons: [] }, 'caution', []).level).toBe('blocked');
    expect(worseRisk({ level: 'caution', reasons: [] }, 'normal', []).level).toBe('caution');
  });
});

describe('buildAction', () => {
  it('assembles a VerificationAction with lifecycle + confidence', () => {
    const a = buildAction(event, email, 'digest-1', 5000);
    expect(a.type).toBe('otp_code');
    expect(a.code?.copyValue).toBe('824193');
    expect(a.messageDigest).toBe('digest-1');
    expect(a.receivedAt).toBe(1000);
    expect(a.detectedAt).toBe(5000);
    expect(a.localHideAfter).toBe(5000 + DEFAULT_ACTION_TTL_MS);
    expect(a.confidence).toMatchObject({ intent: 12, action: 8, total: 20 });
    expect(a.senderDomain).toBe('github.com');
    expect(a.service).toBe('GitHub');
    expect(a.state).toBe('detected');
    expect(a.id).toBeTruthy();
  });
});
