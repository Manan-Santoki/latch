/**
 * Latch — overlay cross-frame channel (zod-free by design).
 *
 * The injected wrapper script runs in the host page and must stay tiny (§39), so
 * these constants/types live apart from protocol.ts (which pulls in zod for the
 * runtime message schema). Both carry ONLY layout/lifecycle info — never a secret.
 */

// iframe → wrapper (posted via window.postMessage; dimensions/lifecycle only).
export const OVERLAY_FRAME_SOURCE = 'latch:overlay-frame';

export type OverlayFrameMessage =
  | { source: typeof OVERLAY_FRAME_SOURCE; kind: 'resize'; height: number }
  | { source: typeof OVERLAY_FRAME_SOURCE; kind: 'dismissed' };

// background → wrapper (via chrome.tabs.sendMessage; mount/remove control only).
export const OVERLAY_CONTROL_SOURCE = 'latch:overlay-control';

export type OverlayControlMessage = {
  source: typeof OVERLAY_CONTROL_SOURCE;
  kind: 'remove' | 'refresh';
};

export function isOverlayControlMessage(v: unknown): v is OverlayControlMessage {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { source?: unknown }).source === OVERLAY_CONTROL_SOURCE
  );
}
