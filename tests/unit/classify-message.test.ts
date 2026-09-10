import type { ParsedEmail } from '@/src/gmail/types';
import { MIN_INTENT_SCORE } from '@/src/shared/constants';
import { classifyMessage } from '@/src/verification/classify-message';
import { describe, expect, it } from 'vitest';

function makeEmail(subject: string, plainText: string, htmlText = ''): ParsedEmail {
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
    htmlText,
    links: [],
  };
}

describe('classifyMessage', () => {
  describe('positive verification signals', () => {
    it('classifies a subject-only "verification code" email', () => {
      const result = classifyMessage(makeEmail('Your verification code', ''));
      expect(result.isVerification).toBe(true);
      expect(result.intentScore).toBeGreaterThanOrEqual(MIN_INTENT_SCORE);
      expect(result.matchedSignals).toContain('verification_code');
    });

    it('classifies an OTP subject alone', () => {
      const result = classifyMessage(makeEmail('Your OTP for sign-in', ''));
      expect(result.isVerification).toBe(true);
      expect(result.matchedSignals).toContain('otp');
    });

    it('classifies a body-heavy "your code is" + expiry + do-not-share email', () => {
      const result = classifyMessage(
        makeEmail(
          'Account security',
          'Your code is 824193. This code expires in 10 minutes. Do not share this code with anyone.',
        ),
      );
      expect(result.isVerification).toBe(true);
      expect(result.matchedSignals).toEqual(
        expect.arrayContaining(['your_code_is', 'expires_in', 'do_not_share_code']),
      );
    });

    it('classifies a "verify your email" subject', () => {
      const result = classifyMessage(
        makeEmail('Verify your email address', 'Click below to verify your email.'),
      );
      expect(result.isVerification).toBe(true);
    });

    it('classifies a "confirm your account" / "activate account" body', () => {
      const result = classifyMessage(
        makeEmail(
          'Welcome to Acme',
          'Please confirm your account and activate account access to get started.',
        ),
      );
      expect(result.isVerification).toBe(true);
    });

    it('classifies a magic sign-in link email', () => {
      const result = classifyMessage(
        makeEmail('Your magic link to sign in', 'Use the magic link below to sign in.'),
      );
      expect(result.isVerification).toBe(true);
      expect(result.matchedSignals).toContain('magic_link');
    });

    it('exposes only signal labels in matchedSignals, never raw values', () => {
      const result = classifyMessage(makeEmail('Your verification code is ready', ''));
      for (const label of result.matchedSignals) {
        expect(label).not.toMatch(/\d/);
      }
    });
  });

  describe('negative / commercial signals', () => {
    it('rejects an invoice email', () => {
      const result = classifyMessage(
        makeEmail('Invoice from Acme', 'Invoice number: 302981. Payment due within 30 days.'),
      );
      expect(result.isVerification).toBe(false);
    });

    it('rejects a shipping/tracking email', () => {
      const result = classifyMessage(
        makeEmail(
          'Your package has shipped',
          'Tracking number: 483920. Estimated delivery: Friday.',
        ),
      );
      expect(result.isVerification).toBe(false);
    });

    it('rejects a reservation confirmation email', () => {
      const result = classifyMessage(
        makeEmail(
          'Your reservation is confirmed',
          'Reservation confirmation number: 738291. See you soon!',
        ),
      );
      expect(result.isVerification).toBe(false);
    });

    it('rejects a receipt / currency-heavy commercial email', () => {
      const result = classifyMessage(
        makeEmail(
          'Your receipt from Acme Store',
          'Order total: $58.24. Subtotal: $52.00. Thank you for shopping with us!',
        ),
      );
      expect(result.isVerification).toBe(false);
    });

    it('rejects a ticket/event confirmation email', () => {
      const result = classifyMessage(
        makeEmail('Your ticket is confirmed', 'Ticket number: 918273. Enjoy the show!'),
      );
      expect(result.isVerification).toBe(false);
    });

    it('does not classify a bare 6-digit number alone as verification', () => {
      const result = classifyMessage(
        makeEmail('Weekly digest', 'Here are some numbers: 824193 and 445566.'),
      );
      expect(result.isVerification).toBe(false);
      expect(result.intentScore).toBeLessThan(MIN_INTENT_SCORE);
    });
  });
});
