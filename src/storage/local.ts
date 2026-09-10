/**
 * Latch — chrome.storage.local wrappers (§6.2).
 *
 * Non-secret persisted state only: settings, Gmail sync checkpoint, dedupe hashes.
 * Every read is validated with zod and falls back to a safe default so corrupt or
 * stale storage can never crash the worker.
 */

import { LOCAL_KEYS } from '../shared/constants';
import {
  DEFAULT_GMAIL_SYNC_STATE,
  DEFAULT_SETTINGS,
  dedupeStoreSchema,
  type DedupeEntry,
  type GmailSyncState,
  type Settings,
  gmailSyncStateSchema,
  settingsSchema,
} from './schemas';
import type { z } from 'zod';

async function readValidated<S extends z.ZodTypeAny>(
  key: string,
  schema: S,
  fallback: z.infer<S>,
): Promise<z.infer<S>> {
  const record = await chrome.storage.local.get(key);
  const raw = record[key];
  if (raw === undefined) return fallback;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export async function getSettings(): Promise<Settings> {
  return readValidated(LOCAL_KEYS.settings, settingsSchema, DEFAULT_SETTINGS);
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = settingsSchema.parse({ ...(await getSettings()), ...patch });
  await chrome.storage.local.set({ [LOCAL_KEYS.settings]: next });
  return next;
}

export async function getGmailSync(): Promise<GmailSyncState> {
  return readValidated(
    LOCAL_KEYS.gmailSync,
    gmailSyncStateSchema,
    DEFAULT_GMAIL_SYNC_STATE,
  );
}

export async function setGmailSync(
  patch: Partial<GmailSyncState>,
): Promise<GmailSyncState> {
  const next = gmailSyncStateSchema.parse({ ...(await getGmailSync()), ...patch });
  await chrome.storage.local.set({ [LOCAL_KEYS.gmailSync]: next });
  return next;
}

export async function clearGmailSync(): Promise<void> {
  await chrome.storage.local.set({
    [LOCAL_KEYS.gmailSync]: DEFAULT_GMAIL_SYNC_STATE,
  });
}

export async function getDedupe(): Promise<DedupeEntry[]> {
  return readValidated(LOCAL_KEYS.dedupe, dedupeStoreSchema, []);
}

export async function setDedupe(entries: DedupeEntry[]): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEYS.dedupe]: entries });
}
