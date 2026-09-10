/**
 * Latch — persisted-state schemas (§6.2).
 *
 * zod schemas for boundary validation of everything Latch persists. Storage rules:
 *   - chrome.storage.local  → settings, sync checkpoint, dedupe hashes (non-secret)
 *   - chrome.storage.session→ active actions (secret, ephemeral)
 * NEVER persist OTPs, full verification URLs, tokens, or message bodies to local.
 */

import { z } from 'zod';

// ─── Settings (local) ────────────────────────────────────────────────────────

export const siteAccessModeSchema = z.enum(['on_click', 'selected', 'all_https']);
export const appearanceSchema = z.enum(['system', 'light', 'dark']);
export const hideTimeoutSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);

export const settingsSchema = z.object({
  overlayEnabled: z.boolean().default(true),
  clickToCopy: z.boolean().default(true),
  /** Auto-copy is OFF by default and opt-in only (§19). */
  autoCopy: z.boolean().default(false),
  autoShowLinkCards: z.boolean().default(true),
  hideTimeoutMinutes: hideTimeoutSchema.default(15),
  siteMode: siteAccessModeSchema.default('on_click'),
  appearance: appearanceSchema.default('system'),
});
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

// ─── Gmail sync state (local, non-secret checkpoints) ────────────────────────

export const gmailSyncStateSchema = z.object({
  connected: z.boolean().default(false),
  accountEmail: z.string().optional(),
  historyId: z.string().optional(),
  lastSuccessfulPollAt: z.number().optional(),
  reauthRequired: z.boolean().default(false),
  lastErrorClass: z.string().optional(),
  /** Skip polling until this epoch-ms (truncated exponential backoff, §9.5). */
  backoffUntil: z.number().optional(),
  /** Consecutive error count driving the backoff. */
  errorCount: z.number().optional(),
});
export type GmailSyncState = z.infer<typeof gmailSyncStateSchema>;
export const DEFAULT_GMAIL_SYNC_STATE: GmailSyncState = gmailSyncStateSchema.parse({});

// ─── Deduplication (local) ───────────────────────────────────────────────────

export const dedupeEntrySchema = z.object({
  /** SHA-256(account id + Gmail message id) — opaque digest only (§25). */
  digest: z.string(),
  seenAt: z.number(),
});
export const dedupeStoreSchema = z.array(dedupeEntrySchema);
export type DedupeEntry = z.infer<typeof dedupeEntrySchema>;

// ─── Active actions (session, secret) ────────────────────────────────────────
// Runtime guard mirroring VerificationAction (src/verification/types.ts). The
// interface there stays authoritative for compile-time; this validates untrusted
// reads from session storage as defense-in-depth.

const actionRiskSchema = z.object({
  level: z.enum(['normal', 'caution', 'blocked']),
  reasons: z.array(z.string()),
});

export const verificationActionSchema = z.object({
  id: z.string(),
  messageDigest: z.string(),
  type: z.enum([
    'otp_code',
    'verification_link',
    'account_confirmation',
    'account_activation',
    'magic_sign_in',
  ]),
  service: z.string().optional(),
  senderDisplay: z.string().optional(),
  senderDomain: z.string().optional(),
  receivedAt: z.number(),
  detectedAt: z.number(),
  code: z.object({ display: z.string(), copyValue: z.string() }).optional(),
  link: z
    .object({
      exactUrl: z.string(),
      hostname: z.string(),
      registrableDomain: z.string().optional(),
    })
    .optional(),
  explicitExpiryAt: z.number().optional(),
  localHideAfter: z.number(),
  confidence: z.object({
    intent: z.number(),
    action: z.number(),
    siteMatch: z.number().optional(),
    total: z.number(),
  }),
  risk: actionRiskSchema,
  state: z.enum(['detected', 'shown', 'copied', 'opened', 'dismissed', 'expired']),
});
export const activeActionsSchema = z.array(verificationActionSchema);
