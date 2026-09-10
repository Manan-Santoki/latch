import type { ExtractedLink, ParsedEmail } from '@/src/gmail/types';
import { MIN_ACTION_SCORE } from '@/src/shared/constants';
import { extractVerificationLinks } from '@/src/verification/extract-links';
import { describe, expect, it } from 'vitest';

function makeEmail(links: ExtractedLink[]): ParsedEmail {
  return {
    messageId: 'test-msg',
    internalDate: 1_700_000_000_000,
    from: {
      raw: 'Acme <no-reply@acme.example>',
      displayName: 'Acme',
      address: 'no-reply@acme.example',
      domain: 'acme.example',
    },
    subject: 'Action needed',
    plainText: '',
    htmlText: '',
    links,
  };
}

// ─── §31.2 positive fixtures ──────────────────────────────────────────────────

const verifyEmail: ExtractedLink = {
  href: 'https://accounts.github.com/verify?token=abc123',
  anchorText: 'Verify your email',
  surroundingText:
    'Click the button below to verify your email address and finish creating your account.',
  valid: true,
};

const confirmAccount: ExtractedLink = {
  href: 'https://app.example.com/confirm?token=xyz',
  anchorText: 'Confirm account',
  surroundingText: 'Please confirm your account to continue.',
  valid: true,
};

const activateAccount: ExtractedLink = {
  href: 'https://app.example.com/activate?token=xyz',
  anchorText: 'Activate account',
  surroundingText: 'Activate your account to get started.',
  valid: true,
};

const magicSignIn: ExtractedLink = {
  href: 'https://app.example.com/magic?token=xyz',
  anchorText: 'Sign in',
  surroundingText: 'Use this magic link to sign in instantly.',
  valid: true,
};

// ─── §31.2 negative fixtures ──────────────────────────────────────────────────

const unsubscribe: ExtractedLink = {
  href: 'https://mail.example.com/unsub?id=1',
  anchorText: 'Unsubscribe',
  surroundingText: 'Click here to unsubscribe from these emails.',
  valid: true,
};

const terms: ExtractedLink = {
  href: 'https://example.com/terms',
  anchorText: 'Terms of Service',
  surroundingText: 'By using our service you agree to our terms of service.',
  valid: true,
};

const privacy: ExtractedLink = {
  href: 'https://example.com/privacy',
  anchorText: 'Privacy Policy',
  surroundingText: 'Read our privacy policy.',
  valid: true,
};

const marketingCta: ExtractedLink = {
  href: 'https://shop.example.com/sale',
  anchorText: 'Shop now',
  surroundingText: 'Our sale ends soon, shop now and save big!',
  valid: true,
};

const socialLink: ExtractedLink = {
  href: 'https://facebook.com/example',
  anchorText: 'Follow us',
  surroundingText: 'Follow us on Facebook for updates.',
  valid: true,
};

const viewInBrowser: ExtractedLink = {
  href: 'https://example.com/view?id=1',
  anchorText: 'View in browser',
  surroundingText: 'Having trouble viewing this email? View it in your browser.',
  valid: true,
};

// ─── §31.2 security fixtures ─────────────────────────────────────────────────

const jsLink: ExtractedLink = {
  href: 'javascript:alert(1)',
  anchorText: 'Click here to verify your email',
  surroundingText: 'Verify your email now.',
  valid: false,
};

const dataLink: ExtractedLink = {
  href: 'data:text/html,<script>alert(1)</script>',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email now.',
  valid: false,
};

const httpLink: ExtractedLink = {
  href: 'http://example.com/verify',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email now.',
  valid: false,
};

const evilSubdomainSpoof: ExtractedLink = {
  href: 'https://github.com.evil.example/verify?token=abc',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email to continue using GitHub.',
  valid: true,
};

const userinfoSpoof: ExtractedLink = {
  href: 'https://github.com@evil.example/verify',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email to continue using GitHub.',
  valid: true,
};

const ipHost: ExtractedLink = {
  href: 'https://192.168.1.5/verify',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email now.',
  valid: true,
};

const punycodeHost: ExtractedLink = {
  href: 'https://xn--pypal-4ve.com/verify',
  anchorText: 'Verify your email',
  surroundingText: 'Verify your email now.',
  valid: true,
};

const malformedUrl: ExtractedLink = {
  href: 'not a valid url',
  anchorText: 'Verify',
  surroundingText: '',
  valid: false,
};

describe('extractVerificationLinks — positive fixtures (§31.2)', () => {
  it('ranks verify/confirm/activate/magic-sign-in links above the action threshold', () => {
    const results = extractVerificationLinks(
      makeEmail([verifyEmail, confirmAccount, activateAccount, magicSignIn]),
    );
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(MIN_ACTION_SCORE);
      expect(r.risk.level).toBe('normal');
    }
  });

  it('sorts candidates descending by score', () => {
    const results = extractVerificationLinks(
      makeEmail([activateAccount, verifyEmail, magicSignIn, confirmAccount]),
    );
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(prev!.score).toBeGreaterThanOrEqual(curr!.score);
    }
  });

  it('preserves the exact URL verbatim (no rewriting)', () => {
    const [result] = extractVerificationLinks(makeEmail([verifyEmail]));
    expect(result).toBeDefined();
    expect(result?.exactUrl).toBe(verifyEmail.href);
  });
});

describe('extractVerificationLinks — negative fixtures (§31.2)', () => {
  it('filters out unsubscribe, terms, privacy, marketing, social, and view-in-browser links', () => {
    const results = extractVerificationLinks(
      makeEmail([unsubscribe, terms, privacy, marketingCta, socialLink, viewInBrowser]),
    );
    expect(results).toEqual([]);
  });
});

describe('extractVerificationLinks — security fixtures (§31.2)', () => {
  it('excludes javascript:, data:, http:, and malformed URLs', () => {
    const results = extractVerificationLinks(makeEmail([jsLink, dataLink, httpLink, malformedUrl]));
    expect(results).toEqual([]);
  });

  it('reads the true registrable domain of a spoofed subdomain (github.com.evil.example), never matching github.com', () => {
    const [result] = extractVerificationLinks(makeEmail([evilSubdomainSpoof]));
    expect(result).toBeDefined();
    expect(result?.hostname).toBe('github.com.evil.example');
    expect(result?.registrableDomain).toBe('evil.example');
    expect(result?.registrableDomain).not.toBe('github.com');
  });

  it('reads the true registrable domain of a userinfo-spoofed URL (github.com@evil.example), never matching github.com', () => {
    const [result] = extractVerificationLinks(makeEmail([userinfoSpoof]));
    expect(result).toBeDefined();
    expect(result?.hostname).toBe('evil.example');
    expect(result?.registrableDomain).toBe('evil.example');
  });

  it('flags an IP-literal host as caution risk', () => {
    const [result] = extractVerificationLinks(makeEmail([ipHost]));
    expect(result).toBeDefined();
    expect(result?.risk.level).toBe('caution');
    expect(result?.risk.reasons).toContain('ip_literal');
  });

  it('flags a punycode host as caution risk', () => {
    const [result] = extractVerificationLinks(makeEmail([punycodeHost]));
    expect(result).toBeDefined();
    expect(result?.risk.level).toBe('caution');
    expect(result?.risk.reasons).toContain('punycode');
  });
});
