/**
 * Latch — shared constants.
 *
 * Tunable thresholds and lifecycle constants referenced across modules. Scoring
 * weights themselves live with their classifier/extractor modules; this file holds
 * the cross-cutting decision thresholds and timing values.
 */

// ─── Action lifecycle (§16) ──────────────────────────────────────────────────

/** Default local relevance window for a surfaced action (not a claim about real
 *  OTP validity). 15 minutes. */
export const DEFAULT_ACTION_TTL_MS = 15 * 60 * 1000;

/** Selectable local hide timeouts offered in settings (minutes). */
export const HIDE_TIMEOUT_OPTIONS_MIN = [5, 10, 15, 30] as const;

/** Messages older than this at fetch time are rejected before heavy processing
 *  (§9.3 step 7, §38 stale OTP). */
export const MAX_RELEVANT_MESSAGE_AGE_MS = 15 * 60 * 1000;

// ─── Gmail sync (§9, §30) ────────────────────────────────────────────────────

/** Chrome alarms production minimum is 30s → 0.5 minutes. */
export const POLL_ALARM_PERIOD_MIN = 0.5;
/** Idle-period backoff cadence ceiling (future adaptive use). */
export const POLL_ALARM_IDLE_PERIOD_MIN = 2;
/** Periodic cleanup cadence. */
export const CLEANUP_ALARM_PERIOD_MIN = 1;

export const ALARM_POLL = 'latch:poll';
export const ALARM_CLEANUP = 'latch:cleanup';

/**
 * Fast-poll burst (§9.2 adaptive cadence). Chrome alarms can't fire faster than
 * 30s, so when a verification email is likely imminent (a login/verify form
 * submit or verify-button click on a granted site, connecting Gmail, or opening
 * the popup) the worker polls every FAST_POLL_MS for BURST_DURATION_MS, then
 * reverts to the 30s alarm baseline.
 */
export const FAST_POLL_MS = 6000;
export const BURST_DURATION_MS = 2 * 60 * 1000;

/** Runtime-registered content-script id for the "verification likely" trigger. */
export const TRIGGER_SCRIPT_ID = 'latch-trigger';

/** Truncated exponential backoff bounds for Gmail 429/5xx (§9.5). */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;

/** Narrow recovery-sync window when historyId is stale / on bootstrap (§9.1, §9.4). */
export const RECOVERY_WINDOW_MS = 10 * 60 * 1000;

// ─── Confidence thresholds (§11, §14) ────────────────────────────────────────

/** Minimum message intent score to treat a message as verification-related (§11.2). */
export const MIN_INTENT_SCORE = 6;
/** Minimum extracted-action confidence before an action is eligible to surface. */
export const MIN_ACTION_SCORE = 4;
/** Total confidence required to AUTO-inject the overlay on the active site (§14.2). */
export const AUTO_OVERLAY_TOTAL_THRESHOLD = 9;

// ─── Deduplication (§25) ─────────────────────────────────────────────────────

export const DEDUPE_MAX_ENTRIES = 200;
export const DEDUPE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ─── Storage keys ────────────────────────────────────────────────────────────

/** chrome.storage.local keys (non-secret only, §6.2). */
export const LOCAL_KEYS = {
  settings: 'latch:settings',
  gmailSync: 'latch:gmailSync',
  dedupe: 'latch:dedupe',
} as const;

/** chrome.storage.session keys (sensitive, ephemeral, §6.2). */
export const SESSION_KEYS = {
  activeActions: 'latch:activeActions',
  /** Map of tabId → actionId currently surfaced in that tab (non-secret ids). */
  tabActions: 'latch:tabActions',
} as const;

/** Extension display name used in UI surfaces. */
export const PRODUCT_NAME = 'Latch';
