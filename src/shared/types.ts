/**
 * Latch — small cross-cutting shared types.
 *
 * Kept in one leaf module (no imports from other Latch modules) so both the
 * storage schemas and the messaging protocol can depend on it without cycles.
 */

/** Website access mode (§3.1). */
export type SiteAccessMode = 'on_click' | 'selected' | 'all_https';

/** Overlay appearance preference (§22). */
export type Appearance = 'system' | 'light' | 'dark';

/** High-level Gmail connection state surfaced in popup/diagnostics (§21). */
export type ConnectionState = 'connected' | 'disconnected' | 'reauth_required' | 'error';

export interface ConnectionStatus {
  connected: boolean;
  accountEmail?: string;
  reauthRequired: boolean;
  state: ConnectionState;
  lastPollAt?: number;
  /** Sanitized error class only — never a message body or URL (§21). */
  lastErrorClass?: string;
}
