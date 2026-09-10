import { extractAnchorsFromHtml, extractPlainTextLinks } from '@/src/gmail/links';
import type { ParsedEmail } from '@/src/gmail/types';
import { detectVerificationEvent } from '@/src/verification/detect';
import { describe, expect, it } from 'vitest';

const workerLinks = (html: string) => [
  ...extractAnchorsFromHtml(html),
  ...extractPlainTextLinks(html),
];

// Regression (§13): an HTML-only verification email whose link lives ONLY in an
// <a href> (no plaintext URL) must still be detected via the raw-HTML href
// fallback, without depending on the offscreen DOM parser.
const rawHtml =
  '<div><h1>Verify your email</h1><p>Confirm your email address to finish.</p>' +
  '<a href="https://auth.example.com/verify?token=ABC123XYZ456TOKEN">Verify email</a>' +
  '<a href="https://auth.example.com/unsubscribe">Unsubscribe</a></div>';

describe('html-only verification link fallback', () => {
  it('extracts href URLs directly from raw HTML', () => {
    const links = workerLinks(rawHtml);
    const verify = links.find((l) => l.href.includes('/verify'));
    expect(verify).toBeDefined();
    expect(verify?.anchorText).toBe('Verify email');
  });

  it('detects a verification link from an HTML-only email', () => {
    const links = workerLinks(rawHtml);
    const email: ParsedEmail = {
      messageId: 'm1',
      internalDate: Date.now(),
      from: { raw: 'App <no-reply@example.com>', domain: 'example.com' },
      subject: 'Verify your email',
      plainText: '',
      htmlText: rawHtml,
      links,
    };
    const event = detectVerificationEvent(email);
    expect(event).not.toBeNull();
    expect(event?.link?.exactUrl).toContain('/verify');
    // the unsubscribe link must not win
    expect(event?.link?.exactUrl).not.toContain('unsubscribe');
  });
});
