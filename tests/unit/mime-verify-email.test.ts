import { extractAnchorsFromHtml, extractPlainTextLinks } from '@/src/gmail/links';
import { parseGmailMessage } from '@/src/gmail/mime';
import type { GmailMessage } from '@/src/gmail/types';
import { detectVerificationEvent } from '@/src/verification/detect';
import { describe, expect, it } from 'vitest';

/** URL-safe base64 encode of a UTF-8 string (mirrors Gmail's body.data). */
function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}

const VERIFY_URL =
  'https://letsgowild.msantoki.com/verify?token=6di9eQdKBNUSkKv86pGctUa9DSIVzHhaiUuqZYQDLe5ktgXtoJRlhEH5XA4Bk25s';

const htmlBody = `<!doctype html><html><body><div>
  <p>LETSGOWILD</p><h1>Verify your email</h1>
  <p>Confirm this is your email address to finish setting up your account.</p>
  <a href="${VERIFY_URL}" style="background:#000;color:#fff">Verify email</a>
  <p>Or open this link in your browser:</p><p>${VERIFY_URL}</p>
  <a href="https://letsgowild.msantoki.com/unsubscribe">Unsubscribe</a>
</div></body></html>`;

const plainBody = `LETSGOWILD
Verify your email
Confirm this is your email address to finish setting up your account.
Or open this link in your browser: ${VERIFY_URL}`;

/** Replicates the worker's link extraction in src/gmail/process-message.ts. */
function workerParse(msg: GmailMessage) {
  const raw = parseGmailMessage(msg);
  const rawHtmlLinks = raw.htmlText.trim()
    ? [...extractAnchorsFromHtml(raw.htmlText), ...extractPlainTextLinks(raw.htmlText)]
    : [];
  return { ...parseGmailMessage(msg, rawHtmlLinks), htmlText: raw.htmlText };
}

describe('MIME → detect for a verification-link email', () => {
  it('detects the link from a multipart/alternative message', () => {
    const msg: GmailMessage = {
      id: 'm1',
      internalDate: String(Date.now()),
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'LetsGoWild <no-reply@letsgowild.msantoki.com>' },
          { name: 'Subject', value: 'Verify your LetsGoWild account' },
        ],
        parts: [
          { mimeType: 'text/plain', body: { data: b64url(plainBody) } },
          { mimeType: 'text/html', body: { data: b64url(htmlBody) } },
        ],
      },
    };
    const email = workerParse(msg);
    expect(email.plainText.length).toBeGreaterThan(0);
    expect(email.htmlText.length).toBeGreaterThan(0);
    const event = detectVerificationEvent(email);
    expect(event).not.toBeNull();
    expect(event?.link?.exactUrl).toContain('/verify');
    expect(event?.link?.exactUrl).not.toContain('unsubscribe');
  });

  it('detects the link from an HTML-only message (no text/plain part)', () => {
    const msg: GmailMessage = {
      id: 'm2',
      internalDate: String(Date.now()),
      payload: {
        mimeType: 'text/html',
        headers: [
          { name: 'From', value: 'LetsGoWild <no-reply@letsgowild.msantoki.com>' },
          { name: 'Subject', value: 'Verify your LetsGoWild account' },
        ],
        body: { data: b64url(htmlBody) },
      },
    };
    const email = workerParse(msg);
    const event = detectVerificationEvent(email);
    expect(event?.link?.exactUrl).toContain('/verify');
  });
});
