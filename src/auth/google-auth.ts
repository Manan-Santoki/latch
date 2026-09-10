/**
 * Latch — Google OAuth token plumbing via `chrome.identity` (§8, §9.1, §9.3, §9.5).
 *
 * Thin wrappers around `chrome.identity.*`. Interactive prompts must only ever be
 * triggered from a user gesture (e.g. the "Connect Gmail" button) — never from a
 * background alarm (§9.1, §9.5 401 handling). This module never logs or persists
 * the token itself; callers are responsible for keeping it in memory only.
 */

/**
 * Resolve an OAuth access token via `chrome.identity.getAuthToken`.
 *
 * Resolves to `null` — never rejects — when no token is available: a
 * non-interactive call with nothing cached, the user declining an interactive
 * prompt, or any `chrome.runtime.lastError`. Only pass `interactive: true` from a
 * direct user gesture (§9.1); background polling must always pass `false`.
 */
export function getAuthToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || typeof chrome.identity?.getAuthToken !== 'function') {
      resolve(null);
      return;
    }
    try {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        // Touch lastError so Chrome doesn't log an "unchecked" warning; the
        // specific reason doesn't matter here — any error means "no token".
        if (chrome.runtime?.lastError || !token) {
          resolve(null);
          return;
        }
        resolve(token);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Evict a token from Chrome's identity cache, e.g. after a 401 (§9.5). Resolves
 * once the removal completes (or immediately if the API is unavailable).
 */
export function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof chrome === 'undefined' ||
      typeof chrome.identity?.removeCachedAuthToken !== 'function'
    ) {
      resolve();
      return;
    }
    try {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    } catch {
      resolve();
    }
  });
}

/** Clear every cached token for this profile, if the API is available. */
export function clearAllCachedTokens(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof chrome === 'undefined' ||
      typeof chrome.identity?.clearAllCachedAuthTokens !== 'function'
    ) {
      resolve();
      return;
    }
    try {
      chrome.identity.clearAllCachedAuthTokens(() => resolve());
    } catch {
      resolve();
    }
  });
}
