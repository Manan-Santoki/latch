/**
 * Latch — offscreen document message envelope (§29).
 * Kept separate so callers don't pull in the offscreen implementation.
 * The offscreen doc parses email HTML (DOM_PARSER) and writes the clipboard
 * (CLIPBOARD). Email HTML is parsed, never rendered; no remote resources load.
 */

import type { ExtractedLink } from '../gmail/types';

export const OFFSCREEN_TARGET = 'latch-offscreen';
export const OFFSCREEN_URL = 'offscreen.html';

export interface OffscreenCopyMessage {
  target: typeof OFFSCREEN_TARGET;
  op: 'copy';
  text: string;
}

export interface OffscreenParseMessage {
  target: typeof OFFSCREEN_TARGET;
  op: 'parse_html';
  html: string;
}

export type OffscreenMessage = OffscreenCopyMessage | OffscreenParseMessage;

export interface OffscreenParseResult {
  text: string;
  links: ExtractedLink[];
}

export function isOffscreenMessage(v: unknown): v is OffscreenMessage {
  return (
    typeof v === 'object' && v !== null && (v as { target?: unknown }).target === OFFSCREEN_TARGET
  );
}
