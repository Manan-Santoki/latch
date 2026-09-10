/**
 * Latch — runtime registration of the "verification likely" trigger content
 * script (§9.2). Registered only for the origins the user has granted, and never
 * in on-click mode. Kept in sync with the site-access mode + granted permissions.
 */

import { TRIGGER_SCRIPT_ID } from '../shared/constants';
import { getSettings } from '../storage/local';
import { hasAllHttps, listGrantedOrigins } from './permissions';

const TRIGGER_JS = 'content-scripts/trigger.js';

async function desiredMatches(): Promise<string[]> {
  const { siteMode } = await getSettings();
  if (siteMode === 'all_https') {
    return (await hasAllHttps()) ? ['https://*/*'] : [];
  }
  if (siteMode === 'selected') {
    return listGrantedOrigins(); // already match patterns, e.g. https://github.com/*
  }
  return []; // on_click: no persistent trigger
}

/** Register/refresh the trigger content script to match the current granted sites. */
export async function syncTriggerRegistration(): Promise<void> {
  const matches = await desiredMatches();
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [TRIGGER_SCRIPT_ID] });
  } catch {
    // Not currently registered — fine.
  }
  if (matches.length === 0) return;
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: TRIGGER_SCRIPT_ID,
        matches,
        js: [TRIGGER_JS],
        runAt: 'document_idle',
        allFrames: false,
      },
    ]);
  } catch {
    // Matches we lack permission for are ignored; a later change re-syncs.
  }
}
