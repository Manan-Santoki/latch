/**
 * Latch — overlay injection commands (§17, §18).
 *
 * The background injects ONLY a small wrapper script (overlay-inject.js) into the
 * host tab. That wrapper creates an extension-origin iframe pointing at
 * overlay.html and never receives the secret. The iframe fetches the action from
 * the background itself. To mount/remove/refresh, we send a control message the
 * wrapper listens for — carrying no secret.
 */

import { OVERLAY_CONTROL_SOURCE, type OverlayControlMessage } from '../messaging/overlay-channel';

/** Inject the wrapper script into the tab (idempotent — the wrapper self-guards). */
export async function injectOverlay(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['overlay-inject.js'],
  });
}

async function sendControl(tabId: number, kind: OverlayControlMessage['kind']): Promise<void> {
  const message: OverlayControlMessage = { source: OVERLAY_CONTROL_SOURCE, kind };
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // No wrapper present in that tab — nothing to control.
  }
}

/** Ask the iframe (via its wrapper) to re-fetch and re-render its action. */
export async function refreshOverlay(tabId: number): Promise<void> {
  await sendControl(tabId, 'refresh');
}

/** Remove the overlay wrapper + iframe from the tab. */
export async function removeOverlay(tabId: number): Promise<void> {
  await sendControl(tabId, 'remove');
}
