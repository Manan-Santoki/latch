import { hostnameOnly, maskCode, sanitizeError, scrub } from '@/src/security/redaction';
import { describe, expect, it } from 'vitest';

describe('redaction', () => {
  it('reduces URLs to scheme + host, dropping token-bearing path/query', () => {
    expect(hostnameOnly('https://example.com/verify?token=abcdef123456#frag')).toBe(
      'https://example.com',
    );
    expect(hostnameOnly('not a url')).toBe('[invalid-url]');
  });

  it('masks a code without revealing it', () => {
    expect(maskCode('824 193')).toBe('6-char code');
  });

  it('scrubs URLs, OTP-shaped digits, and long tokens from free text', () => {
    const out = scrub('code 824193 at https://mail.example.com/x?t=SUPERLONGTOKENVALUE12345');
    expect(out).not.toContain('824193');
    expect(out).not.toContain('SUPERLONGTOKENVALUE12345');
    expect(out).toContain('[code]');
    expect(out).toContain('https://mail.example.com');
  });

  it('sanitizes errors to name + scrubbed message', () => {
    const e = sanitizeError(new TypeError('failed at https://x.test/a/999999'));
    expect(e.name).toBe('TypeError');
    expect(e.message).not.toContain('999999');
  });
});
