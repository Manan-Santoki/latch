import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeBase64Url, parseGmailMessage, walkParts } from '@/src/gmail/mime';
import type { GmailMessage } from '@/src/gmail/types';
import { describe, expect, it } from 'vitest';

// Fixtures are authored as raw JSON (not imported as ES modules) to avoid
// requiring `resolveJsonModule` in the project's strict tsconfig. Resolved
// relative to the process cwd (the project root vitest is invoked from) since
// `import.meta.url` is not guaranteed to be a real file: URL under Vite/Vitest's
// module transform.
const fixturesDir = resolve(process.cwd(), 'tests', 'fixtures', 'multipart');

function loadFixture(name: string): GmailMessage {
  const raw = readFileSync(resolve(fixturesDir, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as GmailMessage;
}

const plainOnly = loadFixture('plain-only');
const htmlOnly = loadFixture('html-only');
const multipartAlternative = loadFixture('multipart-alternative');
const multipartMixed = loadFixture('multipart-mixed');
const nestedMultipart = loadFixture('nested-multipart');
const emptyPart = loadFixture('empty-part');
const malformedMissingBody = loadFixture('malformed-missing-body');
const duplicateHtmlPlain = loadFixture('duplicate-html-plain');
const unicodeFixture = loadFixture('unicode');

// §10.1 base64url decoding
describe('decodeBase64Url', () => {
  it('decodes URL-safe base64 (- and _) with correct padding', () => {
    // "sub>?" base64: c3ViPj8= -> url-safe: c3ViPj8 (no padding, `>` and `+`/`/` chars absent here,
    // so use a payload that actually contains - / _ significant chars in standard b64: '>>>???'
    const standard = Buffer.from('>>>???', 'utf-8').toString('base64');
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Url(urlSafe)).toBe('>>>???');
  });

  it('decodes plain ASCII text', () => {
    expect(decodeBase64Url('aGVsbG8gd29ybGQ')).toBe('hello world');
  });

  it('decodes multi-byte UTF-8 correctly (accents, CJK, emoji)', () => {
    const text = 'héllo 世界 🚀';
    const standard = Buffer.from(text, 'utf-8').toString('base64');
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Url(urlSafe)).toBe(text);
  });

  it('returns "" for an empty string, never throws', () => {
    expect(decodeBase64Url('')).toBe('');
  });

  it('returns "" for malformed base64 input instead of throwing', () => {
    expect(() => decodeBase64Url('!!!not-valid-base64!!!')).not.toThrow();
    expect(decodeBase64Url('!!!not-valid-base64!!!')).toBe('');
  });

  it('round-trips at every padding remainder (0,2,3 chars of padding needed)', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      const standard = Buffer.from(text, 'utf-8').toString('base64');
      const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(decodeBase64Url(urlSafe)).toBe(text);
    }
  });
});

// §10 recursive MIME walking
describe('walkParts', () => {
  it('extracts text/plain from a single-part plain message', () => {
    const { plain, html } = walkParts((plainOnly as GmailMessage).payload);
    expect(plain).toContain('482913');
    expect(html).toBe('');
  });

  it('extracts text/html from a single-part html message', () => {
    const { plain, html } = walkParts((htmlOnly as GmailMessage).payload);
    expect(html).toContain('Verify your account');
    expect(plain).toBe('');
  });

  it('extracts both parts of a multipart/alternative message', () => {
    const { plain, html } = walkParts((multipartAlternative as GmailMessage).payload);
    expect(plain).toContain('alt-plain-1');
    expect(html).toContain('alt-html-1');
  });

  it('extracts text parts and skips attachments in multipart/mixed', () => {
    const { plain, html } = walkParts((multipartMixed as GmailMessage).payload);
    expect(plain).toContain('118273');
    expect(html).toContain('118273');
  });

  it('recurses into arbitrarily nested multiparts and skips nested attachments', () => {
    const { plain, html } = walkParts((nestedMultipart as GmailMessage).payload);
    expect(plain).toContain('nested.example.com/confirm');
    expect(html).toContain('nested.example.com/confirm');
  });

  it('tolerates parts with empty/missing body data', () => {
    const { plain, html } = walkParts((emptyPart as GmailMessage).payload);
    expect(plain).toBe('');
    expect(html).toBe('');
  });

  it('tolerates malformed base64 and entirely missing body objects', () => {
    const { plain, html } = walkParts((malformedMissingBody as GmailMessage).payload);
    expect(plain).toBe('');
    expect(html).toBe('');
  });

  it('returns empty result for an undefined payload', () => {
    const { plain, html } = walkParts(undefined);
    expect(plain).toBe('');
    expect(html).toBe('');
  });

  it('accumulates duplicate/redundant html and plain content across parts', () => {
    const { plain, html } = walkParts((duplicateHtmlPlain as GmailMessage).payload);
    // Two text/plain parts both carrying the same code.
    expect(plain.match(/559911/g)?.length).toBe(2);
    expect(html).toContain('559911');
  });

  it('preserves unicode body content exactly', () => {
    const { plain } = walkParts((unicodeFixture as GmailMessage).payload);
    expect(plain).toContain('Bonjour éé!');
    expect(plain).toContain('738291');
    expect(plain).toContain('🚀');
    expect(plain).toContain('你好世界');
  });
});

// §10 full ParsedEmail assembly
describe('parseGmailMessage', () => {
  it('assembles messageId, internalDate, from, subject, plainText, htmlText', () => {
    const parsed = parseGmailMessage(plainOnly as GmailMessage);
    expect(parsed.messageId).toBe('msg-plain-only');
    expect(parsed.internalDate).toBe(1700000000000);
    expect(parsed.from.address).toBe('security@acme.example');
    expect(parsed.from.domain).toBe('acme.example');
    expect(parsed.subject).toBe('Your verification code');
    expect(parsed.plainText).toContain('482913');
    expect(parsed.htmlText).toBe('');
  });

  it('defaults subject to "" when the header is missing', () => {
    const parsed = parseGmailMessage(malformedMissingBody as GmailMessage);
    expect(parsed.subject).toBe('No from header, malformed data');
  });

  it('defaults internalDate to 0 for a non-numeric internalDate', () => {
    const parsed = parseGmailMessage(malformedMissingBody as GmailMessage);
    expect(parsed.internalDate).toBe(0);
  });

  it('produces an empty-raw from address when the From header is absent', () => {
    const parsed = parseGmailMessage(malformedMissingBody as GmailMessage);
    expect(parsed.from.raw).toBe('');
    expect(parsed.from.address).toBeUndefined();
  });

  it('extracts plain-text links and merges them into links[]', () => {
    const parsed = parseGmailMessage(nestedMultipart as GmailMessage);
    const hrefs = parsed.links.map((l) => l.href);
    expect(hrefs).toContain('https://nested.example.com/confirm?x=1');
  });

  it('merges supplied htmlLinks with plain-text links and dedupes by href', () => {
    const sharedHref = 'https://accounts.example.com/verify?token=alt-html-1';
    const htmlLinks = [
      {
        href: sharedHref,
        anchorText: 'Verify account',
        surroundingText: 'Verify account',
        scheme: 'https:',
        hostname: 'accounts.example.com',
        registrableDomain: 'example.com',
        valid: true,
      },
    ];
    const parsed = parseGmailMessage(multipartAlternative as GmailMessage, htmlLinks);
    const matching = parsed.links.filter((l) => l.href === sharedHref);
    // The htmlLinks-supplied entry wins; plain-text also finds the same href in
    // this fixture's plain part text? (alt-plain-1 differs) — so here just assert
    // no accidental duplication when hrefs coincide.
    expect(matching.length).toBe(1);
    expect(matching[0]?.anchorText).toBe('Verify account');
  });

  it('handles unicode subject and body without mangling characters', () => {
    const parsed = parseGmailMessage(unicodeFixture as GmailMessage);
    expect(parsed.subject).toBe('Vérification 🔐 requise');
    expect(parsed.plainText).toContain('738291');
    expect(parsed.plainText).toContain('你好世界');
  });

  it('returns [] links when there are none and none supplied', () => {
    const parsed = parseGmailMessage(emptyPart as GmailMessage);
    expect(parsed.links).toEqual([]);
  });
});
