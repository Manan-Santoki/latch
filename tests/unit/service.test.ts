import { inferService, subjectNamesService } from '@/src/matching/service';
import { describe, expect, it } from 'vitest';

describe('inferService', () => {
  it('prefers the maintained brand for a known sender domain', () => {
    expect(inferService('github.com', undefined)).toBe('GitHub');
  });

  it('resolves a subdomain sender to its registrable domain brand', () => {
    expect(inferService('accounts.github.com', 'Verify your account')).toBe('GitHub');
  });

  it('derives a Capitalized token from an unknown sender domain main label', () => {
    expect(inferService('notify.mycoolapp.com', undefined)).toBe('Mycoolapp');
  });

  it('falls back to scanning the subject for a known brand when no sender domain', () => {
    expect(inferService(undefined, 'Your GitHub verification code is ready')).toBe('GitHub');
  });

  it('does not match a brand as a substring of another word in the subject', () => {
    expect(inferService(undefined, 'Githubber sent you an invite')).toBeUndefined();
  });

  it('returns undefined when nothing sensible can be derived', () => {
    expect(inferService(undefined, undefined)).toBeUndefined();
    expect(inferService(undefined, 'Please confirm your email address')).toBeUndefined();
  });

  it('prefers the sender-domain-derived name over a subject brand mention', () => {
    // Sender domain wins even though the subject happens to mention a
    // different known brand.
    expect(inferService('mycoolapp.com', 'Login alert from GitHub partner network')).toBe(
      'Mycoolapp',
    );
  });
});

describe('subjectNamesService', () => {
  it('is true when the subject names the resolved service as a whole word', () => {
    expect(subjectNamesService('Your GitHub code is ready', 'GitHub')).toBe(true);
  });

  it('is false when the service name only appears as part of another word', () => {
    expect(subjectNamesService('Githubber sent you a message', 'GitHub')).toBe(false);
  });

  it('is false when the subject does not mention the service', () => {
    expect(subjectNamesService('Your code is ready', 'GitHub')).toBe(false);
  });

  it('is false when subject or service is missing', () => {
    expect(subjectNamesService(undefined, 'GitHub')).toBe(false);
    expect(subjectNamesService('Your code is ready', undefined)).toBe(false);
    expect(subjectNamesService(undefined, undefined)).toBe(false);
  });
});
