import type { ParsedEmail } from '@/src/gmail/types';
import { parseExplicitExpiry } from '@/src/verification/expiration';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = 1_700_000_000_000;

function makeEmail(subject: string, plainText: string): ParsedEmail {
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
    links: [],
  };
}

describe('parseExplicitExpiry', () => {
  it('parses "expires in 10 minutes"', () => {
    const result = parseExplicitExpiry(
      makeEmail('', 'This code expires in 10 minutes.'),
      RECEIVED_AT,
    );
    expect(result).toBe(RECEIVED_AT + 10 * 60_000);
  });

  it('parses "valid for 5 minutes"', () => {
    const result = parseExplicitExpiry(
      makeEmail('', 'This code is valid for 5 minutes.'),
      RECEIVED_AT,
    );
    expect(result).toBe(RECEIVED_AT + 5 * 60_000);
  });

  it('parses "expires in 30 seconds"', () => {
    const result = parseExplicitExpiry(
      makeEmail('', 'This code expires in 30 seconds.'),
      RECEIVED_AT,
    );
    expect(result).toBe(RECEIVED_AT + 30 * 1000);
  });

  it('parses an hour-scale window', () => {
    const result = parseExplicitExpiry(
      makeEmail('', 'This link is valid for 1 hour.'),
      RECEIVED_AT,
    );
    expect(result).toBe(RECEIVED_AT + 60 * 60_000);
  });

  it('returns undefined when no expiry is stated', () => {
    const result = parseExplicitExpiry(
      makeEmail('', 'Your verification code is 824193.'),
      RECEIVED_AT,
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for vague, non-machine-parseable phrasing', () => {
    const result = parseExplicitExpiry(makeEmail('', 'This code will expire soon.'), RECEIVED_AT);
    expect(result).toBeUndefined();
  });
});
