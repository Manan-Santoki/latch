import { toCurrentSite } from '@/src/matching/site';
import { describe, expect, it } from 'vitest';

describe('toCurrentSite', () => {
  it('reduces a plain https URL to origin/hostname/registrableDomain', () => {
    expect(toCurrentSite('https://github.com/settings/profile')).toEqual({
      origin: 'https://github.com',
      hostname: 'github.com',
      registrableDomain: 'github.com',
    });
  });

  it('resolves a subdomain to the same registrable domain (accounts.github.com)', () => {
    const site = toCurrentSite('https://accounts.github.com/login');
    expect(site?.hostname).toBe('accounts.github.com');
    expect(site?.registrableDomain).toBe('github.com');
  });

  it('resolves a different subdomain to the same registrable domain (mail.github.com)', () => {
    const site = toCurrentSite('https://mail.github.com/inbox');
    expect(site?.hostname).toBe('mail.github.com');
    expect(site?.registrableDomain).toBe('github.com');
  });

  it('does not treat github.com.evil.example as github.com (public-suffix safe)', () => {
    const site = toCurrentSite('https://github.com.evil.example/phish');
    expect(site?.registrableDomain).not.toBe('github.com');
    expect(site?.registrableDomain).toBe('evil.example');
  });

  it('handles multi-label public suffixes (example.co.uk)', () => {
    const site = toCurrentSite('https://www.example.co.uk/path');
    expect(site?.registrableDomain).toBe('example.co.uk');
    expect(site?.hostname).toBe('www.example.co.uk');
  });

  it('never retains path, query, or fragment', () => {
    const site = toCurrentSite('https://example.com/verify?token=super-secret#frag');
    expect(site?.origin).toBe('https://example.com');
    expect(JSON.stringify(site)).not.toContain('token');
    expect(JSON.stringify(site)).not.toContain('frag');
  });

  it('returns a site with a null registrableDomain for an IP-literal host', () => {
    const site = toCurrentSite('http://192.168.1.5:8080/app');
    expect(site).not.toBeNull();
    expect(site?.hostname).toBe('192.168.1.5');
    expect(site?.registrableDomain).toBeNull();
  });

  it('returns null for non-http(s) schemes', () => {
    expect(toCurrentSite('chrome://extensions')).toBeNull();
    expect(toCurrentSite('ftp://files.example.com/resource')).toBeNull();
    expect(toCurrentSite('mailto:someone@example.com')).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(toCurrentSite('not a url')).toBeNull();
    expect(toCurrentSite('')).toBeNull();
  });
});
