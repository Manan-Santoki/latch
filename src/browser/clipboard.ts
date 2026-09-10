/**
 * Latch — privileged clipboard copy (§19).
 *
 * The background is the only place the copy value is read (from session storage,
 * by action id). A service worker has no DOM clipboard, so the write happens in an
 * offscreen document (reason CLIPBOARD) via a textarea + execCommand('copy') —
 * which needs no `clipboardWrite` permission. The code is never sent through any
 * website-facing channel; the offscreen document is a trusted extension context.
 */

import { getAction } from '../actions/action-store';
import { OFFSCREEN_TARGET, OFFSCREEN_URL, type OffscreenCopyMessage } from './offscreen-protocol';

async function hasOffscreenDocument(): Promise<boolean> {
  // getContexts is available in Chrome 116+ (our minimum).
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });
  return contexts.length > 0;
}

async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
      justification: 'Copy a verification code to the clipboard on user request.',
    });
  } catch {
    // A concurrent create may have won the race; that's fine.
  }
}

/** Copy the code for `actionId` to the clipboard. Returns false if no code. */
export async function copyActionCode(actionId: string): Promise<boolean> {
  const action = await getAction(actionId);
  if (!action?.code) return false;
  await ensureOffscreen();
  const message: OffscreenCopyMessage = {
    target: OFFSCREEN_TARGET,
    op: 'copy',
    text: action.code.copyValue,
  };
  const res = (await chrome.runtime.sendMessage(message)) as { ok?: boolean } | undefined;
  return res?.ok === true;
}
