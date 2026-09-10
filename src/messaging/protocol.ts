/**
 * Latch — typed messaging protocol (§24).
 *
 * Explicit, validated messages between the popup/options/overlay and the trusted
 * background worker. There is deliberately no generic `{ type: string; payload:
 * any }` escape hatch, and an injected/host page can never turn an arbitrary URL
 * or code string into a privileged action — copy/open are addressed only by an
 * opaque action id that the background resolves against session storage.
 */

import { z } from 'zod';
import type { ConnectionStatus, SiteAccessMode } from '../shared/types';
import { type Settings, settingsSchema, siteAccessModeSchema } from '../storage/schemas';
import type { VerificationActionView } from '../verification/types';

export interface OkResult {
  ok: boolean;
  /** Sanitized error label only, never sensitive detail. */
  error?: string;
}

export interface OpenResult {
  ok: boolean;
  reason?: 'not_https' | 'blocked' | 'not_found' | 'invalid';
}

export type ExtensionMessage =
  | { type: 'GET_CONNECTION_STATUS' }
  | { type: 'CONNECT_GMAIL' }
  | { type: 'DISCONNECT_GMAIL' }
  | { type: 'GET_ACTIVE_ACTION'; tabId?: number }
  | { type: 'GET_ACTIVE_ACTIONS' }
  | { type: 'COPY_ACTION'; actionId: string }
  | { type: 'OPEN_ACTION'; actionId: string }
  | { type: 'DISMISS_ACTION'; actionId: string }
  | { type: 'REQUEST_SITE_PERMISSION'; origin: string }
  | { type: 'SET_SITE_MODE'; mode: SiteAccessMode }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'DEV_INJECT_FAKE_ACTION'; fixtureId?: string; tabId?: number };

export type MessageType = ExtensionMessage['type'];

/** Response type produced for each message type. */
export interface ResponseMap {
  GET_CONNECTION_STATUS: ConnectionStatus;
  CONNECT_GMAIL: ConnectionStatus;
  DISCONNECT_GMAIL: OkResult;
  GET_ACTIVE_ACTION: VerificationActionView | null;
  GET_ACTIVE_ACTIONS: VerificationActionView[];
  COPY_ACTION: OkResult;
  OPEN_ACTION: OpenResult;
  DISMISS_ACTION: OkResult;
  REQUEST_SITE_PERMISSION: { granted: boolean };
  SET_SITE_MODE: Settings;
  GET_SETTINGS: Settings;
  SET_SETTINGS: Settings;
  DEV_INJECT_FAKE_ACTION: OkResult;
}

export type ResponseFor<T extends MessageType> = ResponseMap[T];

/** Runtime validator — the background rejects anything that fails this (§24). */
export const extensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('GET_CONNECTION_STATUS') }),
  z.object({ type: z.literal('CONNECT_GMAIL') }),
  z.object({ type: z.literal('DISCONNECT_GMAIL') }),
  z.object({ type: z.literal('GET_ACTIVE_ACTION'), tabId: z.number().optional() }),
  z.object({ type: z.literal('GET_ACTIVE_ACTIONS') }),
  z.object({ type: z.literal('COPY_ACTION'), actionId: z.string() }),
  z.object({ type: z.literal('OPEN_ACTION'), actionId: z.string() }),
  z.object({ type: z.literal('DISMISS_ACTION'), actionId: z.string() }),
  z.object({ type: z.literal('REQUEST_SITE_PERMISSION'), origin: z.string() }),
  z.object({ type: z.literal('SET_SITE_MODE'), mode: siteAccessModeSchema }),
  z.object({ type: z.literal('GET_SETTINGS') }),
  z.object({ type: z.literal('SET_SETTINGS'), patch: settingsSchema.partial() }),
  z.object({
    type: z.literal('DEV_INJECT_FAKE_ACTION'),
    fixtureId: z.string().optional(),
    tabId: z.number().optional(),
  }),
]);

// ─── Overlay iframe ⇄ injected wrapper channel ───────────────────────────────
// Posted via window.postMessage between the extension-origin overlay iframe and
// the injected host-page wrapper. Carries ONLY layout/lifecycle info — never a
// code, URL, or any secret (§17.1, §18).

export const OVERLAY_FRAME_SOURCE = 'latch:overlay-frame';

export type OverlayFrameMessage =
  | { source: typeof OVERLAY_FRAME_SOURCE; kind: 'resize'; height: number }
  | { source: typeof OVERLAY_FRAME_SOURCE; kind: 'dismissed' };
