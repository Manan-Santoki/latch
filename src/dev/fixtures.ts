/**
 * Latch — developer fixtures for the fake-action harness (Phase 1 / M2).
 *
 * Lets the whole overlay + permission + copy/dismiss experience be exercised
 * WITHOUT Gmail. These are obviously-fake sample actions; not real secrets.
 */

import { DEFAULT_ACTION_TTL_MS } from '../shared/constants';
import { now } from '../shared/time';
import type { VerificationAction } from '../verification/types';

export type FixtureId = 'code' | 'link' | 'both' | 'caution' | 'blocked';

export const FIXTURE_IDS: FixtureId[] = ['code', 'link', 'both', 'caution', 'blocked'];

function base(
  nowMs: number,
): Pick<
  VerificationAction,
  'messageDigest' | 'receivedAt' | 'detectedAt' | 'localHideAfter' | 'state'
> {
  return {
    messageDigest: `dev-${nowMs}`,
    receivedAt: nowMs,
    detectedAt: nowMs,
    localHideAfter: nowMs + DEFAULT_ACTION_TTL_MS,
    state: 'detected',
  };
}

export function createFakeAction(fixtureId: FixtureId, nowMs: number = now()): VerificationAction {
  const id = `dev-${fixtureId}-${nowMs}`;
  const common = base(nowMs);
  switch (fixtureId) {
    case 'code':
      return {
        id,
        ...common,
        type: 'otp_code',
        service: 'GitHub',
        senderDisplay: 'GitHub',
        senderDomain: 'github.com',
        code: { display: '824 193', copyValue: '824193' },
        confidence: { intent: 12, action: 8, siteMatch: 6, total: 26 },
        risk: { level: 'normal', reasons: [] },
      };
    case 'link':
      return {
        id,
        ...common,
        type: 'verification_link',
        service: 'GitHub',
        senderDisplay: 'GitHub',
        senderDomain: 'github.com',
        link: {
          exactUrl: 'https://github.com/account/verify?token=DEV_FAKE_TOKEN_123',
          hostname: 'github.com',
          registrableDomain: 'github.com',
        },
        confidence: { intent: 11, action: 7, siteMatch: 6, total: 24 },
        risk: { level: 'normal', reasons: [] },
      };
    case 'both':
      return {
        id,
        ...common,
        type: 'otp_code',
        service: 'Discord',
        senderDisplay: 'Discord',
        senderDomain: 'discord.com',
        code: { display: '483 921', copyValue: '483921' },
        link: {
          exactUrl: 'https://discord.com/verify?token=DEV_FAKE_TOKEN_456',
          hostname: 'discord.com',
          registrableDomain: 'discord.com',
        },
        confidence: { intent: 12, action: 8, siteMatch: 6, total: 26 },
        risk: { level: 'normal', reasons: [] },
      };
    case 'caution':
      return {
        id,
        ...common,
        type: 'verification_link',
        service: 'GitHub',
        senderDisplay: 'GitHub',
        senderDomain: 'github.com',
        link: {
          exactUrl: 'https://email-links.example.net/r/DEV_FAKE',
          hostname: 'email-links.example.net',
          registrableDomain: 'example.net',
        },
        confidence: { intent: 10, action: 6, siteMatch: 1, total: 17 },
        risk: { level: 'caution', reasons: ['sender_link_domain_mismatch'] },
      };
    case 'blocked':
      return {
        id,
        ...common,
        type: 'verification_link',
        service: 'GitHub',
        senderDisplay: 'GitHub',
        senderDomain: 'github.com',
        link: {
          exactUrl: 'https://unrelated-example.net/claim?token=DEV_FAKE',
          hostname: 'unrelated-example.net',
          registrableDomain: 'unrelated-example.net',
        },
        confidence: { intent: 10, action: 6, siteMatch: -6, total: 10 },
        risk: {
          level: 'blocked',
          reasons: ['link_domain_conflicts_with_site_and_sender'],
        },
      };
  }
}
