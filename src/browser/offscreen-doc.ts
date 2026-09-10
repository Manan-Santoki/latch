/**
 * Latch — offscreen document lifecycle (§29).
 * One offscreen document serves both CLIPBOARD and DOM_PARSER. Created lazily and
 * reused; callers send it a typed message and await the response.
 */

import { OFFSCREEN_URL, type OffscreenMessage } from './offscreen-protocol';

async function hasOffscreenDocument(): Promise<boolean> {
  // getContexts is available in Chrome 116+ (our minimum).
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });
  return contexts.length > 0;
}

let creating: Promise<void> | null = null;

export async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (creating) return creating;
  creating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ['CLIPBOARD', 'DOM_PARSER'] as chrome.offscreen.Reason[],
      justification:
        'Parse verification email HTML locally and copy codes to the clipboard on request.',
    })
    .catch(() => {
      // A concurrent create may have won the race; that's fine.
    })
    .finally(() => {
      creating = null;
    });
  return creating;
}

export async function sendToOffscreen<T>(message: OffscreenMessage): Promise<T> {
  await ensureOffscreen();
  return (await chrome.runtime.sendMessage(message)) as T;
}
