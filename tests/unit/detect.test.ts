import type { ExtractedLink, ParsedEmail } from '@/src/gmail/types';
import { detectVerificationEvent } from '@/src/verification/detect';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = 1_700_000_000_000;

function makeEmail(subject: string, plainText: string, links: ExtractedLink[] = []): ParsedEmail {
  return {
    messageId: 'test-msg',
    internalDate: RECEIVED_AT,
    from: {
      raw: 'Acme <no-reply@acme.example>',
      displayName: 'Acme',
      address: 'no-reply@acme.example',
      domain: 'acme.example',
    },
    subject,
    plainText,
    htmlText: '',
    links,
  };
}

describe('detectVerificationEvent', () => {
  it('detects an OTP-only email with explicit expiry, no link', () => {
    const email = makeEmail(
      'Your verification code',
      'Your verification code is 824193. This code expires in 10 minutes.',
    );
    const result = detectVerificationEvent(email);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('otp_code');
    expect(result?.code).toEqual({ display: '824193', copyValue: '824193' });
    expect(result?.link).toBeUndefined();
    expect(result?.explicitExpiryAt).toBe(RECEIVED_AT + 10 * 60_000);
    expect(result?.risk).toEqual({ level: 'normal', reasons: [] });
    expect(result?.intentScore).toBeGreaterThan(0);
    expect(result?.actionScore).toBeGreaterThan(0);
  });

  it('detects a verification-link-only email (no code)', () => {
    const link: ExtractedLink = {
      href: 'https://app.example.com/verify?token=abc',
      anchorText: 'Verify your email',
      surroundingText: 'Click below to verify your email and finish signing up.',
      valid: true,
    };
    const email = makeEmail('Verify your email', '', [link]);
    const result = detectVerificationEvent(email);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('verification_link');
    expect(result?.code).toBeUndefined();
    expect(result?.link).toEqual({
      exactUrl: link.href,
      hostname: 'app.example.com',
      registrableDomain: 'example.com',
    });
    expect(result?.risk.level).toBe('normal');
  });

  it('classifies an account-confirmation link', () => {
    const link: ExtractedLink = {
      href: 'https://app.example.com/confirm?token=abc',
      anchorText: 'Confirm your account',
      surroundingText: 'Please confirm your account by clicking the link below.',
      valid: true,
    };
    const email = makeEmail(
      'Confirm your account',
      'Please confirm your account by clicking the link below.',
      [link],
    );
    const result = detectVerificationEvent(email);
    expect(result?.type).toBe('account_confirmation');
  });

  it('classifies an account-activation link', () => {
    const link: ExtractedLink = {
      href: 'https://app.example.com/activate?token=abc',
      anchorText: 'Activate your account',
      surroundingText: 'Activate your account by clicking the link below.',
      valid: true,
    };
    const email = makeEmail(
      'Activate your account',
      'Activate your account by clicking the link below.',
      [link],
    );
    const result = detectVerificationEvent(email);
    expect(result?.type).toBe('account_activation');
  });

  it('classifies a magic sign-in link', () => {
    const link: ExtractedLink = {
      href: 'https://app.example.com/magic?token=abc',
      anchorText: 'Sign in',
      surroundingText: 'Use the magic link below to sign in to your account.',
      valid: true,
    };
    const email = makeEmail(
      'Your magic link to sign in',
      'Use the magic link below to sign in to your account.',
      [link],
    );
    const result = detectVerificationEvent(email);
    expect(result?.type).toBe('magic_sign_in');
  });

  it('represents an email with both a code and a link as one event, code primary (§3.4)', () => {
    const link: ExtractedLink = {
      href: 'https://discord.com/verify?token=xyz',
      anchorText: 'Verify your email',
      surroundingText: 'Or verify your email below.',
      valid: true,
    };
    const email = makeEmail(
      'Your verification code',
      'Your verification code is 483921.\n\nOr verify your email below.',
      [link],
    );
    const result = detectVerificationEvent(email);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('otp_code');
    expect(result?.code).toEqual({ display: '483921', copyValue: '483921' });
    expect(result?.link).toEqual({
      exactUrl: link.href,
      hostname: 'discord.com',
      registrableDomain: 'discord.com',
    });
  });

  it('surfaces caution risk from a suspicious link even when a code is the primary type', () => {
    const link: ExtractedLink = {
      href: 'https://192.168.5.10/verify',
      anchorText: 'Verify your email',
      surroundingText: 'Or verify your email using the link below.',
      valid: true,
    };
    const email = makeEmail(
      'Your verification code',
      'Your verification code is 559911. Or verify your email using the link below.',
      [link],
    );
    const result = detectVerificationEvent(email);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('otp_code');
    expect(result?.code?.display).toBe('559911');
    expect(result?.link?.hostname).toBe('192.168.5.10');
    expect(result?.risk.level).toBe('caution');
    expect(result?.risk.reasons).toContain('ip_literal');
  });

  it('returns null for a non-verification commercial email', () => {
    const email = makeEmail(
      'Your order has shipped',
      'Order number: 458392\nTracking number: 998877\nThank you for shopping with us.',
    );
    const result = detectVerificationEvent(email);
    expect(result).toBeNull();
  });

  it('returns null when the message classifies as verification but yields no usable code or link', () => {
    // "OTP" alone clears the intent threshold, but there is no extractable code
    // or qualifying link in the body.
    const email = makeEmail('Your OTP', 'Please see the attached instructions.');
    const result = detectVerificationEvent(email);
    expect(result).toBeNull();
  });
});
