/**
 * Latch — optional website-permission management (§3.1, §7, §26).
 *
 * Three site-access modes:
 *   - on_click:  no persistent host permission; overlay only via activeTab after
 *                the user explicitly invokes the extension.
 *   - selected:  persistent access to specific chosen origins.
 *   - all_https: optional access to every HTTPS site for the best automatic
 *                experience.
 *
 * `chrome.permissions.request` must be called from a user gesture (popup/options
 * button), never from a background alarm.
 */

import type { SiteAccessMode } from '../shared/types';

/** Turn an origin (https://github.com) into a match pattern (https://github.com/*). */
export function originPattern(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/*`;
}

const ALL_HTTPS = 'https://*/*';

export async function hasOriginAccess(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [originPattern(origin)] });
}

export async function requestOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [originPattern(origin)] });
}

export async function removeOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.remove({ origins: [originPattern(origin)] });
}

export async function hasAllHttps(): Promise<boolean> {
  return chrome.permissions.contains({ origins: [ALL_HTTPS] });
}

export async function requestAllHttps(): Promise<boolean> {
  return chrome.permissions.request({ origins: [ALL_HTTPS] });
}

export async function removeAllHttps(): Promise<boolean> {
  return chrome.permissions.remove({ origins: [ALL_HTTPS] });
}

/** All explicitly-granted origin patterns (excludes the required Gmail API host). */
export async function listGrantedOrigins(): Promise<string[]> {
  const all = await chrome.permissions.getAll();
  return (all.origins ?? []).filter((o) => !o.includes('gmail.googleapis.com'));
}

/**
 * Whether we may AUTO-inject the overlay on `origin` given the current mode.
 * on_click never auto-injects (it relies on activeTab + an explicit click).
 */
export async function canAutoInject(origin: string, mode: SiteAccessMode): Promise<boolean> {
  if (mode === 'on_click') return false;
  if (mode === 'all_https') return (await hasAllHttps()) || hasOriginAccess(origin);
  return hasOriginAccess(origin);
}
