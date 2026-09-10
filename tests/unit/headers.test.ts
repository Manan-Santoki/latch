import { decodeInternalDate, getHeader, parseFromHeader } from '@/src/gmail/headers';
import type { GmailHeader } from '@/src/gmail/types';
import { describe, expect, it } from 'vitest';

describe('getHeader', () => {
  const headers: GmailHeader[] = [
    { name: 'From', value: 'Acme <hi@acme.example>' },
    { name: 'Subject', value: 'Hello' },
  ];

  it('finds a header case-insensitively', () => {
    expect(getHeader(headers, 'from')).toBe('Acme <hi@acme.example>');
    expect(getHeader(headers, 'FROM')).toBe('Acme <hi@acme.example>');
    expect(getHeader(headers, 'Subject')).toBe('Hello');
  });

  it('returns undefined when the header is missing', () => {
    expect(getHeader(headers, 'To')).toBeUndefined();
  });

  it('returns undefined when headers is undefined', () => {
    expect(getHeader(undefined, 'From')).toBeUndefined();
  });
});

describe('parseFromHeader', () => {
  it('parses "Display Name <addr@host>"', () => {
    const parsed = parseFromHeader('Acme Security <security@acme.example>');
    expect(parsed.raw).toBe('Acme Security <security@acme.example>');
    expect(parsed.displayName).toBe('Acme Security');
    expect(parsed.address).toBe('security@acme.example');
    expect(parsed.domain).toBe('acme.example');
  });

  it('parses a bare address with no display name', () => {
    const parsed = parseFromHeader('security@acme.example');
    expect(parsed.address).toBe('security@acme.example');
    expect(parsed.domain).toBe('acme.example');
    expect(parsed.displayName).toBeUndefined();
  });

  it('strips surrounding double quotes from the display name', () => {
    const parsed = parseFromHeader('"Acme, Inc." <no-reply@acme.example>');
    expect(parsed.displayName).toBe('Acme, Inc.');
  });

  it('strips surrounding single quotes from the display name', () => {
    const parsed = parseFromHeader("'Acme' <no-reply@acme.example>");
    expect(parsed.displayName).toBe('Acme');
  });

  it('lower-cases the domain', () => {
    const parsed = parseFromHeader('Acme <security@ACME.EXAMPLE>');
    expect(parsed.domain).toBe('acme.example');
  });

  it('always preserves the raw input verbatim', () => {
    const raw = '  Weird <  spaced@example.com > ';
    const parsed = parseFromHeader(raw);
    expect(parsed.raw).toBe(raw);
  });

  it('handles an empty string without throwing', () => {
    const parsed = parseFromHeader('');
    expect(parsed.raw).toBe('');
    expect(parsed.address).toBeUndefined();
    expect(parsed.domain).toBeUndefined();
  });

  it('handles a display-name-only value with no address gracefully', () => {
    const parsed = parseFromHeader('Just A Name');
    expect(parsed.address).toBeUndefined();
    expect(parsed.domain).toBeUndefined();
  });
});

describe('decodeInternalDate', () => {
  it('parses an epoch-ms string to a number', () => {
    expect(decodeInternalDate('1700000000000')).toBe(1700000000000);
  });

  it('returns 0 for undefined', () => {
    expect(decodeInternalDate(undefined)).toBe(0);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(decodeInternalDate('not-a-number')).toBe(0);
  });

  it('returns 0 for an empty string', () => {
    expect(decodeInternalDate('')).toBe(0);
  });
});
