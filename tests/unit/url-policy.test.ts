import { evaluateUrl, isAllowedForOneClick, parseUrl } from '@/src/security/url-policy';
import { describe, expect, it } from 'vitest';

describe('parseUrl', () => {
  it('parses a well-formed URL', () => {
    const u = parseUrl('https://example.com/path?q=1');
    expect(u).not.toBeNull();
    expect(u?.hostname).toBe('example.com');
  });

  it('returns null instead of throwing on malformed input', () => {
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('http://')).toBeNull();
  });
});

describe('evaluateUrl — accepted scheme', () => {
  it('accepts https URLs as valid', () => {
    const policy = evaluateUrl('https://accounts.example.com/verify?token=abc');
    expect(policy.valid).toBe(true);
    expect(policy.scheme).toBe('https:');
    expect(policy.hostname).toBe('accounts.example.com');
  });
});

describe('evaluateUrl — rejected schemes (§6.4, §31.2)', () => {
  const cases: Array<[string, string]> = [
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['file:', 'file:///etc/passwd'],
    ['blob:', 'blob:https://example.com/uuid'],
    ['chrome:', 'chrome://settings'],
    ['chrome-extension:', 'chrome-extension://abcdefg/page.html'],
    ['http:', 'http://example.com'],
    ['mailto:', 'mailto:someone@example.com'],
    ['tel:', 'tel:+15551234567'],
  ];

  it.each(cases)('rejects %s URLs', (_label, raw) => {
    const policy = evaluateUrl(raw);
    expect(policy.valid).toBe(false);
    expect(policy.reasons.some((r) => r.startsWith('rejected_scheme:'))).toBe(true);
  });
});

describe('evaluateUrl — deceptive hostnames (§6.4, §31.2)', () => {
  it('reports the true hostname for github.com.evil.example, not github.com', () => {
    const policy = evaluateUrl('https://github.com.evil.example');
    expect(policy.valid).toBe(true);
    expect(policy.hostname).toBe('github.com.evil.example');
    expect(policy.hostname).not.toBe('github.com');
  });

  it('reports the true hostname for a userinfo trick (github.com@evil.example)', () => {
    const policy = evaluateUrl('https://github.com@evil.example');
    expect(policy.valid).toBe(true);
    expect(policy.hostname).toBe('evil.example');
    expect(policy.hostname).not.toBe('github.com');
  });

  it('never uses substring matching to judge a hostname', () => {
    // Regression guard: a naive `url.includes('github.com')` check would treat
    // both deceptive URLs above as "github.com". Confirm evaluateUrl doesn't.
    const a = evaluateUrl('https://github.com.evil.example');
    const b = evaluateUrl('https://github.com@evil.example');
    expect(a.hostname).not.toBe('github.com');
    expect(b.hostname).not.toBe('github.com');
  });
});

describe('evaluateUrl — non-fatal caution flags', () => {
  it('flags IP-literal hosts without necessarily invalidating https', () => {
    const policy = evaluateUrl('https://192.168.1.1/verify');
    expect(policy.valid).toBe(true);
    expect(policy.reasons).toContain('ip_literal');
  });

  it('flags IPv6-literal hosts', () => {
    const policy = evaluateUrl('https://[2001:db8::1]/verify');
    expect(policy.valid).toBe(true);
    expect(policy.reasons).toContain('ip_literal');
  });

  it('flags punycode hosts', () => {
    const policy = evaluateUrl('https://xn--80ak6aa92e.com/login');
    expect(policy.valid).toBe(true);
    expect(policy.reasons).toContain('punycode');
  });

  it('does not flag an ordinary ASCII hostname', () => {
    const policy = evaluateUrl('https://accounts.example.com/verify');
    expect(policy.reasons).not.toContain('ip_literal');
    expect(policy.reasons).not.toContain('punycode');
  });
});

describe('evaluateUrl — malformed URL', () => {
  it('reports invalid with a reason and no hostname', () => {
    const policy = evaluateUrl('not a url at all');
    expect(policy.valid).toBe(false);
    expect(policy.hostname).toBeUndefined();
    expect(policy.reasons.length).toBeGreaterThan(0);
  });

  it('handles empty string', () => {
    const policy = evaluateUrl('');
    expect(policy.valid).toBe(false);
  });
});

describe('isAllowedForOneClick', () => {
  it('true for https URLs', () => {
    expect(isAllowedForOneClick('https://example.com/verify')).toBe(true);
  });

  it('false for http, javascript:, data:, and malformed URLs', () => {
    expect(isAllowedForOneClick('http://example.com')).toBe(false);
    expect(isAllowedForOneClick('javascript:alert(1)')).toBe(false);
    expect(isAllowedForOneClick('data:text/html,hi')).toBe(false);
    expect(isAllowedForOneClick('not a url')).toBe(false);
  });
});
