import type { ParsedEmail } from '@/src/gmail/types';
import { MIN_ACTION_SCORE } from '@/src/shared/constants';
import { extractCode } from '@/src/verification/extract-code';
import { describe, expect, it } from 'vitest';

function makeEmail(subject: string, plainText: string): ParsedEmail {
  return {
    messageId: 'test-msg',
    internalDate: 1_700_000_000_000,
    from: {
      raw: 'Acme <no-reply@acme.example>',
      displayName: 'Acme',
      address: 'no-reply@acme.example',
      domain: 'acme.example',
    },
    subject,
    plainText,
    htmlText: '',
    links: [],
  };
}

describe('extractCode — positive fixtures (§31.1)', () => {
  it('extracts a plain 6-digit code', () => {
    const result = extractCode(makeEmail('', 'Your verification code is 824193'));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('824193');
    expect(result?.copyValue).toBe('824193');
    expect(result?.score).toBeGreaterThanOrEqual(MIN_ACTION_SCORE);
  });

  it('extracts and normalizes a spaced code', () => {
    const result = extractCode(makeEmail('', 'Code: 824 193'));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('824 193');
    expect(result?.copyValue).toBe('824193');
  });

  it('extracts and normalizes a hyphenated code', () => {
    const result = extractCode(makeEmail('', 'Use 824-193 to sign in'));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('824-193');
    expect(result?.copyValue).toBe('824193');
  });

  it('extracts an alphanumeric code without stripping letters', () => {
    const result = extractCode(makeEmail('', 'Your code is AB12CD'));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('AB12CD');
    expect(result?.copyValue).toBe('AB12CD');
  });

  it('extracts a hyphenated alphanumeric code, dropping only the separator', () => {
    const result = extractCode(makeEmail('', 'Use code G-123456 to verify your account'));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('G-123456');
    expect(result?.copyValue).toBe('G123456');
  });

  it('extracts a code that appears in the subject', () => {
    const result = extractCode(makeEmail('824193 is your login verification code', ''));
    expect(result).not.toBeNull();
    expect(result?.display).toBe('824193');
    expect(result?.copyValue).toBe('824193');
  });

  it('picks the contextually correct OTP among multiple irrelevant numbers', () => {
    const result = extractCode(
      makeEmail(
        'Sign in to Acme',
        'Order number: 458123\nTracking number: 998877\nYour verification code is 824193. This code expires in 10 minutes.',
      ),
    );
    expect(result).not.toBeNull();
    expect(result?.display).toBe('824193');
    expect(result?.copyValue).toBe('824193');
  });

  it('extracts a 4-digit code', () => {
    const result = extractCode(makeEmail('Your security code', 'Your security code is 4821.'));
    expect(result).not.toBeNull();
    expect(result?.copyValue).toBe('4821');
  });

  it('extracts an 8-digit code', () => {
    const result = extractCode(
      makeEmail('', 'Your OTP is 48213967. Enter it to verify your identity.'),
    );
    expect(result).not.toBeNull();
    expect(result?.copyValue).toBe('48213967');
  });
});

describe('extractCode — negative fixtures (§31.1): no false action', () => {
  it('does not extract an order number', () => {
    const result = extractCode(
      makeEmail('Your order has shipped', 'Order number: 458392\nThank you for shopping with us.'),
    );
    expect(result).toBeNull();
  });

  it('does not extract an invoice number', () => {
    const result = extractCode(
      makeEmail('Invoice from Acme', 'Invoice number: 302981\nPayment due within 30 days.'),
    );
    expect(result).toBeNull();
  });

  it('does not extract a tracking number', () => {
    const result = extractCode(
      makeEmail(
        'Your package is on the way',
        'Tracking number: 483920\nEstimated delivery: Friday.',
      ),
    );
    expect(result).toBeNull();
  });

  it('does not extract a price', () => {
    const result = extractCode(
      makeEmail(
        'Your receipt from Acme Store',
        'Order total: $824193\nThank you for shopping with us.',
      ),
    );
    expect(result).toBeNull();
  });

  it('does not extract a copyright year', () => {
    const result = extractCode(
      makeEmail('Newsletter', 'Copyright © 2024 Acme Inc. All rights reserved.'),
    );
    expect(result).toBeNull();
  });

  it('does not extract a phone number', () => {
    const result = extractCode(
      makeEmail('Contact us', 'Call us at (415) 555-0198 if you have questions.'),
    );
    expect(result).toBeNull();
  });

  it('does not extract a reservation confirmation number', () => {
    const result = extractCode(
      makeEmail(
        'Your reservation is confirmed',
        'Reservation confirmation number: 738291\nWe look forward to seeing you!',
      ),
    );
    expect(result).toBeNull();
  });
});
