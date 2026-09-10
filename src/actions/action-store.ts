/**
 * Latch — active-action store (§15, §16).
 *
 * Thin domain layer over chrome.storage.session for the active verification
 * actions and the tab→action association. All secrets (code.copyValue,
 * link.exactUrl) live here in session storage and are handed out only as secret-
 * free `VerificationActionView`s to UI surfaces — except privileged copy/open,
 * which read the raw action by id from the background.
 */

import {
  getActiveActions,
  getTabActionMap,
  setActiveActions,
  setTabActionMap,
} from '../storage/session';
import {
  type VerificationAction,
  type VerificationActionView,
  toActionView,
} from '../verification/types';

/** Insert or replace an action by id. */
export async function putAction(action: VerificationAction): Promise<void> {
  const actions = await getActiveActions();
  const next = actions.filter((a) => a.id !== action.id);
  next.push(action);
  await setActiveActions(next);
}

export async function getAction(id: string): Promise<VerificationAction | null> {
  const actions = await getActiveActions();
  return actions.find((a) => a.id === id) ?? null;
}

export async function listActions(): Promise<VerificationAction[]> {
  return getActiveActions();
}

export async function listActionViews(): Promise<VerificationActionView[]> {
  return (await getActiveActions()).map(toActionView);
}

/** Update an action's state field, if present. */
export async function setActionState(
  id: string,
  state: VerificationAction['state'],
): Promise<void> {
  const actions = await getActiveActions();
  let changed = false;
  const next = actions.map((a) => {
    if (a.id === id) {
      changed = true;
      return { ...a, state };
    }
    return a;
  });
  if (changed) await setActiveActions(next);
}

/** Remove an action and any tab associations pointing at it. */
export async function removeAction(id: string): Promise<void> {
  const actions = await getActiveActions();
  await setActiveActions(actions.filter((a) => a.id !== id));
  const map = await getTabActionMap();
  let changed = false;
  for (const [tabId, actionId] of Object.entries(map)) {
    if (actionId === id) {
      delete map[tabId];
      changed = true;
    }
  }
  if (changed) await setTabActionMap(map);
}

// ─── Tab association ─────────────────────────────────────────────────────────

export async function associateTab(tabId: number, actionId: string): Promise<void> {
  const map = await getTabActionMap();
  map[String(tabId)] = actionId;
  await setTabActionMap(map);
}

export async function getTabActionId(tabId: number): Promise<string | null> {
  const map = await getTabActionMap();
  return map[String(tabId)] ?? null;
}

export async function getActionForTab(tabId: number): Promise<VerificationAction | null> {
  const actionId = await getTabActionId(tabId);
  if (!actionId) return null;
  return getAction(actionId);
}

export async function clearTab(tabId: number): Promise<void> {
  const map = await getTabActionMap();
  if (map[String(tabId)] !== undefined) {
    delete map[String(tabId)];
    await setTabActionMap(map);
  }
}
