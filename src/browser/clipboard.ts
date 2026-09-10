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
import { sendToOffscreen } from './offscreen-doc';
import { OFFSCREEN_TARGET } from './offscreen-protocol';

/** Copy the code for `actionId` to the clipboard. Returns false if no code. */
export async function copyActionCode(actionId: string): Promise<boolean> {
  const action = await getAction(actionId);
  if (!action?.code) return false;
  const res = await sendToOffscreen<{ ok?: boolean }>({
    target: OFFSCREEN_TARGET,
    op: 'copy',
    text: action.code.copyValue,
  });
  return res?.ok === true;
}
