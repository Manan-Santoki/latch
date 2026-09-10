/**
 * Latch — chrome.storage.session wrappers (§6.2).
 *
 * Holds active verification actions, which contain secrets (code.copyValue,
 * link.exactUrl). Session storage is in-memory for the browser session and its
 * default access level is TRUSTED_CONTEXTS, so content scripts cannot read it.
 * These secrets never touch storage.local, logs, or the host page.
 */

import { SESSION_KEYS } from '../shared/constants';
import type { VerificationAction } from '../verification/types';
import { activeActionsSchema } from './schemas';

export async function getActiveActions(): Promise<VerificationAction[]> {
  const record = await chrome.storage.session.get(SESSION_KEYS.activeActions);
  const raw = record[SESSION_KEYS.activeActions];
  if (raw === undefined) return [];
  const parsed = activeActionsSchema.safeParse(raw);
  // Cast: the zod schema structurally mirrors VerificationAction (schemas.ts).
  return parsed.success ? (parsed.data as VerificationAction[]) : [];
}

export async function setActiveActions(actions: VerificationAction[]): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.activeActions]: actions });
}

export async function clearActiveActions(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEYS.activeActions);
}
