import {
  combinedConfidence,
  scoreSiteMatch,
  shouldAutoOverlay,
} from '@/src/matching/score-site-match';
import type { CurrentSite, SiteMatchResult } from '@/src/matching/types';
import { AUTO_OVERLAY_TOTAL_THRESHOLD } from '@/src/shared/constants';
import type { DetectedEvent } from '@/src/verification/types';
import { describe, expect, it } from 'vitest';

function buildEvent(overrides: Partial<DetectedEvent> = {}): DetectedEvent {
  return {
    type: 'verification_link',
    intentScore: 8,
    actionScore: 6,
    risk: { level: 'normal', reasons: [] },
    ...overrides,
  };
}

function site(overrides: Partial<CurrentSite> = {}): CurrentSite {
  return {
    origin: 'https://example.com',
    hostname: 'example.com',
    registrableDomain: 'example.com',
    ...overrides,
  };
}

describe('scoreSiteMatch — §14 scenarios', () => {
  it('GitHub email + GitHub tab: high level, normal risk, auto-overlay eligible', () => {
    const event = buildEvent({
      service: 'GitHub',
      link: { exactUrl: 'https://github.com/verify?t=abc', hostname: 'github.com' },
    });
    const currentSite = site({
      origin: 'https://github.com',
      hostname: 'github.com',
      registrableDomain: 'github.com',
    });

    const match = scoreSiteMatch(event, 'github.com', currentSite);

    expect(match.level).toBe('high');
    expect(match.risk).toBe('normal');
    expect(match.score).toBeGreaterThanOrEqual(6);
    expect(match.reasons).toContain('link_domain_matches_site');
    expect(match.reasons).toContain('sender_domain_matches_site');

    const combined = combinedConfidence(event.intentScore, event.actionScore, match.score);
    expect(combined).toBeGreaterThanOrEqual(AUTO_OVERLAY_TOTAL_THRESHOLD);
    expect(shouldAutoOverlay(match, combined)).toBe(true);
  });

  it('accounts.github.com sender/link vs github.com tab still counts as a site match', () => {
    const event = buildEvent({
      service: 'GitHub',
      link: { exactUrl: 'https://mail.github.com/verify', hostname: 'mail.github.com' },
    });
    const currentSite = site({
      origin: 'https://accounts.github.com',
      hostname: 'accounts.github.com',
      registrableDomain: 'github.com',
    });

    const match = scoreSiteMatch(event, 'notifications.github.com', currentSite);

    expect(match.level).toBe('high');
    expect(match.risk).toBe('normal');
  });

  it('GitHub email + unrelated tab: no strong site signal, not auto-overlaid', () => {
    const event = buildEvent({
      service: 'GitHub',
      link: { exactUrl: 'https://github.com/verify?t=abc', hostname: 'github.com' },
    });
    const currentSite = site({
      origin: 'https://unrelated-example.com',
      hostname: 'unrelated-example.com',
      registrableDomain: 'unrelated-example.com',
    });

    const match = scoreSiteMatch(event, 'github.com', currentSite);

    // Sender/link are internally coherent (real GitHub email+link) but that
    // does not establish relevance to the current, unrelated site.
    expect(match.level).not.toBe('high');
    expect(['low', 'medium']).toContain(match.level);
    expect(match.risk).toBe('normal');

    const combined = combinedConfidence(event.intentScore, event.actionScore, match.score);
    expect(shouldAutoOverlay(match, combined)).toBe(false);
  });

  it('no link, no sender, no service: low level, zero-ish score', () => {
    const event = buildEvent({});
    const currentSite = site();

    const match = scoreSiteMatch(event, undefined, currentSite);

    expect(match.level).toBe('low');
    expect(match.risk).toBe('normal');
    expect(match.score).toBe(0);
    expect(match.reasons).toEqual([]);
  });

  it('mismatched link (link domain != sender != site): blocked, not auto-overlaid', () => {
    const event = buildEvent({
      service: 'GitHub',
      link: { exactUrl: 'https://evil-phish.example/verify', hostname: 'evil-phish.example' },
    });
    const currentSite = site({
      origin: 'https://accounts.google.com',
      hostname: 'accounts.google.com',
      registrableDomain: 'google.com',
    });

    const match = scoreSiteMatch(event, 'github.com', currentSite);

    expect(match.risk).toBe('blocked');
    expect(match.reasons).toContain('link_conflicts_site_and_sender');

    const combined = combinedConfidence(event.intentScore, event.actionScore, match.score);
    expect(shouldAutoOverlay(match, combined)).toBe(false);
  });

  it('link conflicts only with sender (site unknown/unrelated): caution, not blocked', () => {
    const event = buildEvent({
      service: 'GitHub',
      link: { exactUrl: 'https://evil-phish.example/verify', hostname: 'evil-phish.example' },
    });
    const currentSite = site({
      origin: 'https://evil-phish.example',
      hostname: 'evil-phish.example',
      registrableDomain: 'evil-phish.example',
    });

    // Link matches the (also unrelated) current site but conflicts with the
    // claimed sender — a phishing-style disagreement, not a full 3-way
    // conflict, so it should be a caution rather than a hard block.
    const match = scoreSiteMatch(event, 'github.com', currentSite);

    expect(match.risk).toBe('caution');
    expect(match.reasons).not.toContain('link_conflicts_site_and_sender');
  });

  it('IP-literal link destination triggers caution and a negative signal', () => {
    const event = buildEvent({
      link: { exactUrl: 'http://203.0.113.5/verify', hostname: '203.0.113.5' },
    });
    const currentSite = site();

    const match = scoreSiteMatch(event, undefined, currentSite);

    expect(match.risk).toBe('caution');
    expect(match.reasons).toContain('ip_literal_link');
  });

  it('punycode link host triggers caution and a negative signal', () => {
    const event = buildEvent({
      link: { exactUrl: 'https://xn--pple-43d.com/verify', hostname: 'xn--pple-43d.com' },
    });
    const currentSite = site();

    const match = scoreSiteMatch(event, undefined, currentSite);

    expect(match.risk).toBe('caution');
    expect(match.reasons).toContain('punycode_link_host');
  });

  it('never treats github.com.evil.example as matching github.com', () => {
    const event = buildEvent({
      link: {
        exactUrl: 'https://github.com.evil.example/verify',
        hostname: 'github.com.evil.example',
      },
    });
    const currentSite = site({
      origin: 'https://github.com',
      hostname: 'github.com',
      registrableDomain: 'github.com',
    });

    const match = scoreSiteMatch(event, 'github.com', currentSite);

    expect(match.reasons).not.toContain('link_domain_matches_site');
    // Link conflicts with the (real) site and does not conflict with the
    // sender because no sender domain is known to compare against here —
    // provide one to exercise the full 3-way conflict/blocked path too.
    const matchWithSender = scoreSiteMatch(
      buildEvent({
        link: {
          exactUrl: 'https://github.com.evil.example/verify',
          hostname: 'github.com.evil.example',
        },
      }),
      'notifications.github.com',
      currentSite,
    );
    expect(matchWithSender.risk).toBe('blocked');
  });
});

describe('combinedConfidence', () => {
  it('sums intent, action, and site scores', () => {
    expect(combinedConfidence(6, 4, 3)).toBe(13);
    expect(combinedConfidence(0, 0, 0)).toBe(0);
    expect(combinedConfidence(-2, 4, 1)).toBe(3);
  });
});

describe('shouldAutoOverlay', () => {
  function result(overrides: Partial<SiteMatchResult> = {}): SiteMatchResult {
    return {
      level: 'high',
      score: 10,
      risk: 'normal',
      reasons: [],
      ...overrides,
    };
  }

  it('is true when risk is not blocked, level is high, and combined clears the threshold', () => {
    expect(shouldAutoOverlay(result(), AUTO_OVERLAY_TOTAL_THRESHOLD)).toBe(true);
    expect(shouldAutoOverlay(result(), AUTO_OVERLAY_TOTAL_THRESHOLD + 5)).toBe(true);
  });

  it('allows caution risk to auto-overlay (only blocked is excluded)', () => {
    expect(shouldAutoOverlay(result({ risk: 'caution' }), AUTO_OVERLAY_TOTAL_THRESHOLD)).toBe(true);
  });

  it('is false when risk is blocked regardless of level/combined', () => {
    expect(shouldAutoOverlay(result({ risk: 'blocked' }), AUTO_OVERLAY_TOTAL_THRESHOLD + 100)).toBe(
      false,
    );
  });

  it('is false when level is not high, even with a very high combined score', () => {
    expect(shouldAutoOverlay(result({ level: 'medium' }), AUTO_OVERLAY_TOTAL_THRESHOLD + 100)).toBe(
      false,
    );
    expect(shouldAutoOverlay(result({ level: 'low' }), AUTO_OVERLAY_TOTAL_THRESHOLD + 100)).toBe(
      false,
    );
  });

  it('is false when combined is below the threshold', () => {
    expect(shouldAutoOverlay(result(), AUTO_OVERLAY_TOTAL_THRESHOLD - 1)).toBe(false);
  });
});
