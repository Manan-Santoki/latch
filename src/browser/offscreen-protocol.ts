/**
 * Latch — offscreen document message envelope (§29).
 * Kept separate so the offscreen bundle doesn't pull in the action store.
 */

export const OFFSCREEN_TARGET = 'latch-offscreen';
export const OFFSCREEN_URL = 'offscreen.html';

export interface OffscreenCopyMessage {
  target: typeof OFFSCREEN_TARGET;
  op: 'copy';
  text: string;
}

export function isOffscreenMessage(v: unknown): v is OffscreenCopyMessage {
  return (
    typeof v === 'object' && v !== null && (v as { target?: unknown }).target === OFFSCREEN_TARGET
  );
}
