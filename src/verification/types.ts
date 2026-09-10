/**
 * Latch — verification action model & pipeline contracts (§15).
 *
 * Shared CONTRACT. The classifier/extractor modules produce the intermediate
 * result types; the background service worker assembles a `VerificationAction`
 * from them. Secrets inside a `VerificationAction` (code.copyValue, link.exactUrl)
 * live ONLY in chrome.storage.session and never leave the trusted extension
 * context. The overlay/popup render a `VerificationActionView`, which deliberately
 * OMITS those secret fields — copy/open happen by opaque action id via the
 * background (§17, §19, §20).
 */

export type VerificationActionType =
  | 'otp_code'
  | 'verification_link'
  | 'account_confirmation'
  | 'account_activation'
  | 'magic_sign_in';

export type RiskLevel = 'normal' | 'caution' | 'blocked';

export type ActionState = 'detected' | 'shown' | 'copied' | 'opened' | 'dismissed' | 'expired';

export interface ActionCode {
  /** Human display form, may contain spaces/hyphens, e.g. "824 193". */
  display: string;
  /** Normalized value to place on the clipboard, e.g. "824193". SECRET. */
  copyValue: string;
}

export interface ActionLink {
  /** Exact original URL — SECRET; preserved verbatim, opened only on user click. */
  exactUrl: string;
  hostname: string;
  registrableDomain?: string;
}

export interface ActionConfidence {
  intent: number;
  action: number;
  siteMatch?: number;
  total: number;
}

export interface ActionRisk {
  level: RiskLevel;
  reasons: string[];
}

export interface VerificationAction {
  id: string;
  messageDigest: string;

  type: VerificationActionType;

  service?: string;
  senderDisplay?: string;
  senderDomain?: string;

  receivedAt: number;
  detectedAt: number;

  code?: ActionCode;
  link?: ActionLink;

  /** Only set when the email explicitly stated a machine-parseable expiry (§16). */
  explicitExpiryAt?: number;
  /** Epoch millis after which the extension stops surfacing this action. */
  localHideAfter: number;

  confidence: ActionConfidence;
  risk: ActionRisk;
  state: ActionState;
}

/**
 * Presentational projection sent to the overlay iframe and popup. Contains the
 * code display (which the user must see) but NOT copyValue or exactUrl. The
 * destination hostname is shown; the exact URL stays in the background.
 */
export interface VerificationActionView {
  id: string;
  type: VerificationActionType;
  service?: string;
  senderDisplay?: string;
  receivedAt: number;
  code?: { display: string };
  link?: { hostname: string; registrableDomain?: string };
  explicitExpiryAt?: number;
  risk: ActionRisk;
  state: ActionState;
  hasCopy: boolean;
  hasOpen: boolean;
}

/** Strip secrets from an action to produce the view safe for UI surfaces. */
export function toActionView(a: VerificationAction): VerificationActionView {
  return {
    id: a.id,
    type: a.type,
    service: a.service,
    senderDisplay: a.senderDisplay,
    receivedAt: a.receivedAt,
    code: a.code ? { display: a.code.display } : undefined,
    link: a.link
      ? { hostname: a.link.hostname, registrableDomain: a.link.registrableDomain }
      : undefined,
    explicitExpiryAt: a.explicitExpiryAt,
    risk: a.risk,
    state: a.state,
    hasCopy: a.code != null,
    // A blocked-risk link must not offer the normal one-click open (§3.5).
    hasOpen: a.link != null && a.risk.level !== 'blocked',
  };
}

// ─── Pipeline intermediate contracts ─────────────────────────────────────────

/** Output of classify-message.ts (§11). Never includes secret content. */
export interface ClassificationResult {
  isVerification: boolean;
  intentScore: number;
  /** Signal keys that fired (for diagnostics/tests) — labels only, no values. */
  matchedSignals: string[];
}

/** Output of extract-code.ts (§12). */
export interface CodeCandidate {
  display: string;
  copyValue: string;
  score: number;
}

/** Output of extract-links.ts / score-link.ts (§13). */
export interface LinkCandidate {
  exactUrl: string;
  hostname: string;
  registrableDomain?: string;
  scheme: string;
  anchorText: string;
  score: number;
  risk: ActionRisk;
}

/**
 * A fully-detected verification event assembled from a parsed email, before it is
 * routed/matched to the current site and given lifecycle fields + an id. Produced
 * by the verification module's top-level `detectVerificationEvent` (§36/§37).
 */
export interface DetectedEvent {
  type: VerificationActionType;
  service?: string;
  code?: ActionCode;
  link?: ActionLink;
  explicitExpiryAt?: number;
  intentScore: number;
  actionScore: number;
  risk: ActionRisk;
}
