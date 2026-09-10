import { GmailApiError, classifyError, classifyStatus } from '@/src/auth/auth-errors';
import { describe, expect, it } from 'vitest';

describe('GmailApiError', () => {
  it('carries the HTTP status and a message', () => {
    const err = new GmailApiError(500);
    expect(err.status).toBe(500);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('500');
  });

  it('accepts a custom message', () => {
    const err = new GmailApiError(403, 'forbidden');
    expect(err.status).toBe(403);
    expect(err.message).toBe('forbidden');
  });
});

describe('classifyStatus', () => {
  it('maps 401 to unauthorized', () => {
    expect(classifyStatus(401)).toBe('unauthorized');
  });

  it('maps 403 to forbidden', () => {
    expect(classifyStatus(403)).toBe('forbidden');
  });

  it('maps 404 to stale_history', () => {
    expect(classifyStatus(404)).toBe('stale_history');
  });

  it('maps 429 to rate_limited', () => {
    expect(classifyStatus(429)).toBe('rate_limited');
  });

  it('maps 5xx to server', () => {
    expect(classifyStatus(500)).toBe('server');
    expect(classifyStatus(503)).toBe('server');
    expect(classifyStatus(599)).toBe('server');
  });

  it('maps anything else to other', () => {
    expect(classifyStatus(200)).toBe('other');
    expect(classifyStatus(302)).toBe('other');
    expect(classifyStatus(418)).toBe('other');
  });
});

describe('classifyError', () => {
  it('classifies a GmailApiError by its status', () => {
    expect(classifyError(new GmailApiError(401))).toBe('unauthorized');
    expect(classifyError(new GmailApiError(429))).toBe('rate_limited');
    expect(classifyError(new GmailApiError(500))).toBe('server');
  });

  it('classifies any non-GmailApiError as other', () => {
    expect(classifyError(new TypeError('boom'))).toBe('other');
    expect(classifyError('nope')).toBe('other');
    expect(classifyError(undefined)).toBe('other');
  });
});
