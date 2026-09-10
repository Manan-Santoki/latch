/**
 * Latch — action lifecycle cleanup (§16).
 *
 * An action stops being surfaced after its local relevance window
 * (`localHideAfter`), or earlier if the email stated an explicit expiry that has
 * passed. Cleanup removes the secret from session storage and reports which tabs
 * had an overlay removed so the caller can tear those down + refresh the badge.
 */

import { now } from '../shared/time';
import {
  getActiveActions,
  getTabActionMap,
  setActiveActions,
  setTabActionMap,
} from '../storage/session';
import type { VerificationAction } from '../verification/types';

export function isExpired(action: VerificationAction, nowMs: number = now()): boolean {
  if (action.explicitExpiryAt !== undefined && nowMs >= action.explicitExpiryAt) {
    return true;
  }
  return nowMs >= action.localHideAfter;
}

export interface CleanupResult {
  removedIds: string[];
  /** Tab ids whose surfaced overlay should be torn down. */
  affectedTabIds: number[];
}

export async function cleanupExpiredActions(nowMs: number = now()): Promise<CleanupResult> {
  const actions = await getActiveActions();
  const expired = actions.filter((a) => isExpired(a, nowMs));
  if (expired.length === 0) return { removedIds: [], affectedTabIds: [] };

  const expiredIds = new Set(expired.map((a) => a.id));
  await setActiveActions(actions.filter((a) => !expiredIds.has(a.id)));

  const map = await getTabActionMap();
  const affectedTabIds: number[] = [];
  let mapChanged = false;
  for (const [tabId, actionId] of Object.entries(map)) {
    if (expiredIds.has(actionId)) {
      const numericTab = Number(tabId);
      if (!Number.isNaN(numericTab)) affectedTabIds.push(numericTab);
      delete map[tabId];
      mapChanged = true;
    }
  }
  if (mapChanged) await setTabActionMap(map);

  return { removedIds: [...expiredIds], affectedTabIds };
}
