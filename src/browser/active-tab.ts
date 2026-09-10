/**
 * Latch — active-tab access (§26).
 *
 * Reads the active tab and reduces its URL to a CurrentSite (hostname/registrable
 * only) IMMEDIATELY. The full URL, path, query, and fragment are never retained.
 * Reading `tab.url` requires activeTab (after a user gesture) or host permission
 * for that origin — by design we never request the broad `tabs` permission.
 */

import { toCurrentSite } from '../matching/site';
import type { CurrentSite } from '../matching/types';

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] ?? null;
}

export interface ActiveTabSite {
  tabId: number;
  site: CurrentSite;
}

export async function getActiveTabSite(): Promise<ActiveTabSite | null> {
  const tab = await getActiveTab();
  if (!tab || tab.id === undefined || !tab.url) return null;
  const site = toCurrentSite(tab.url);
  if (!site) return null;
  return { tabId: tab.id, site };
}
