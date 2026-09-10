import { extractAnchorsFromDocument, extractPlainTextLinks } from '@/src/gmail/links';
import { describe, expect, it } from 'vitest';

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('extractPlainTextLinks', () => {
  it('finds a bare https URL in plain text', () => {
    const links = extractPlainTextLinks(
      'Verify your account: https://accounts.example.com/verify?token=abc123',
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe('https://accounts.example.com/verify?token=abc123');
    expect(links[0]?.anchorText).toBe('');
    expect(links[0]?.valid).toBe(true);
    expect(links[0]?.scheme).toBe('https:');
    expect(links[0]?.hostname).toBe('accounts.example.com');
    expect(links[0]?.registrableDomain).toBe('example.com');
  });

  it('finds multiple links', () => {
    const text = 'First https://a.example.com/1 then https://b.example.com/2 done.';
    const links = extractPlainTextLinks(text);
    expect(links.map((l) => l.href)).toEqual([
      'https://a.example.com/1',
      'https://b.example.com/2',
    ]);
  });

  it('captures a bounded surrounding-text window', () => {
    const padding = 'x'.repeat(200);
    const text = `${padding} https://example.com/verify ${padding}`;
    const links = extractPlainTextLinks(text);
    expect(links[0]?.surroundingText.length).toBeLessThan(text.length);
    expect(links[0]?.surroundingText).toContain('https://example.com/verify');
  });

  it('preserves the href exactly, including query and fragment', () => {
    const href = 'https://example.com/verify?token=abc&x=1#section';
    const links = extractPlainTextLinks(`link: ${href}`);
    expect(links[0]?.href).toBe(href);
  });

  it('marks a bare http (not https) URL invalid', () => {
    const links = extractPlainTextLinks('go to http://example.com/verify');
    expect(links[0]?.valid).toBe(false);
  });

  it('returns [] for text with no URLs', () => {
    expect(extractPlainTextLinks('no links here, just words')).toEqual([]);
  });

  it('returns [] for empty text', () => {
    expect(extractPlainTextLinks('')).toEqual([]);
  });
});

describe('extractAnchorsFromDocument — positive verification links (§31.2)', () => {
  it('extracts a "Verify email" anchor', () => {
    const doc = parseHtml(
      '<a href="https://accounts.example.com/verify?token=abc">Verify email</a>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe('https://accounts.example.com/verify?token=abc');
    expect(links[0]?.anchorText).toBe('Verify email');
    expect(links[0]?.valid).toBe(true);
  });

  it('extracts a "Confirm account" anchor', () => {
    const doc = parseHtml(
      '<a href="https://accounts.example.com/confirm?token=abc">Confirm account</a>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.anchorText).toBe('Confirm account');
  });

  it('extracts an "Activate account" anchor', () => {
    const doc = parseHtml(
      '<a href="https://accounts.example.com/activate?token=abc">Activate account</a>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.anchorText).toBe('Activate account');
  });

  it('extracts a "Magic sign-in link" anchor', () => {
    const doc = parseHtml(
      '<a href="https://accounts.example.com/magic-login?token=abc">Magic sign-in link</a>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.anchorText).toBe('Magic sign-in link');
    expect(links[0]?.valid).toBe(true);
  });
});

describe('extractAnchorsFromDocument — negative/non-verification anchors (§31.2)', () => {
  it('still structurally extracts an "unsubscribe" anchor (scoring happens elsewhere)', () => {
    const doc = parseHtml('<a href="https://mail.example.com/unsubscribe?id=1">Unsubscribe</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.anchorText).toBe('Unsubscribe');
    expect(links[0]?.valid).toBe(true);
  });

  it('extracts "terms", "privacy", "marketing", and "view in browser" anchors', () => {
    const doc = parseHtml(`
      <a href="https://example.com/terms">Terms of Service</a>
      <a href="https://example.com/privacy">Privacy Policy</a>
      <a href="https://example.com/shop">Shop now</a>
      <a href="https://example.com/social">Follow us</a>
      <a href="https://example.com/view">View in browser</a>
    `);
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link.valid).toBe(true);
    }
  });
});

describe('extractAnchorsFromDocument — security cases (§31.2, §6.4)', () => {
  it('skips mailto: anchors entirely', () => {
    const doc = parseHtml('<a href="mailto:someone@example.com">Email us</a>');
    expect(extractAnchorsFromDocument(doc)).toEqual([]);
  });

  it('skips tel: anchors entirely', () => {
    const doc = parseHtml('<a href="tel:+15551234567">Call us</a>');
    expect(extractAnchorsFromDocument(doc)).toEqual([]);
  });

  it('includes javascript: anchors with valid=false', () => {
    const doc = parseHtml('<a href="javascript:alert(1)">Click</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.valid).toBe(false);
  });

  it('includes data: anchors with valid=false', () => {
    const doc = parseHtml('<a href="data:text/html,hi">Click</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.valid).toBe(false);
  });

  it('marks bare http anchors invalid', () => {
    const doc = parseHtml('<a href="http://example.com/verify">Verify</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.valid).toBe(false);
    expect(links[0]?.scheme).toBe('http:');
  });

  it('reports the true hostname for github.com.evil.example, not github.com', () => {
    const doc = parseHtml('<a href="https://github.com.evil.example/login">Sign in to GitHub</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.hostname).toBe('github.com.evil.example');
    expect(links[0]?.registrableDomain).toBe('evil.example');
  });

  it('reports the true hostname for a userinfo trick (github.com@evil.example)', () => {
    const doc = parseHtml('<a href="https://github.com@evil.example/login">Sign in to GitHub</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.hostname).toBe('evil.example');
    expect(links[0]?.registrableDomain).toBe('evil.example');
  });

  it('flags IP-literal host anchors', () => {
    const doc = parseHtml('<a href="https://203.0.113.5/verify">Verify</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.valid).toBe(true);
    expect(links[0]?.hostname).toBe('203.0.113.5');
  });

  it('flags punycode host anchors', () => {
    const doc = parseHtml('<a href="https://xn--80ak6aa92e.com/login">Sign in</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.hostname).toBe('xn--80ak6aa92e.com');
    expect(links[0]?.valid).toBe(true);
  });

  it('handles a malformed href gracefully (valid=false, no throw)', () => {
    const doc = parseHtml('<a href="ht!tp://[bad">Click</a>');
    expect(() => extractAnchorsFromDocument(doc)).not.toThrow();
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.valid).toBe(false);
  });
});

describe('extractAnchorsFromDocument — structural fidelity', () => {
  it('preserves href verbatim, including query and fragment', () => {
    const href = 'https://example.com/verify?token=abc&x=1#section';
    const doc = parseHtml(`<a href="${href}">Verify</a>`);
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.href).toBe(href);
  });

  it('trims anchor text', () => {
    const doc = parseHtml('<a href="https://example.com/verify">\n   Verify   \n</a>');
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.anchorText).toBe('Verify');
  });

  it('captures surrounding text from the anchor parent element', () => {
    const doc = parseHtml(
      '<p>Please <a href="https://example.com/verify">click here</a> to verify your account.</p>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links[0]?.surroundingText).toContain('click here');
    expect(links[0]?.surroundingText).toContain('verify your account');
  });

  it('only reads passive anchor data — never touches script/style content', () => {
    const doc = parseHtml(
      '<script>void 0;</script><style>a{color:red}</style><a href="https://example.com/verify">Verify</a>',
    );
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe('https://example.com/verify');
  });

  it('returns one entry per anchor for multiple links', () => {
    const doc = parseHtml(`
      <a href="https://a.example.com/1">One</a>
      <a href="https://b.example.com/2">Two</a>
    `);
    const links = extractAnchorsFromDocument(doc);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.href)).toEqual([
      'https://a.example.com/1',
      'https://b.example.com/2',
    ]);
  });

  it('returns [] for a document with no anchors', () => {
    const doc = parseHtml('<p>No links here.</p>');
    expect(extractAnchorsFromDocument(doc)).toEqual([]);
  });
});
