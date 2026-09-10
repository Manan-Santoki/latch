/**
 * Latch — top-level verification-event assembler (§36/§37).
 *
 * Runs the intent classifier, then the code/link extractors, and combines the
 * results into one `DetectedEvent` per §3.4: an email containing both a code and
 * a link is represented as one verification event with multiple actions, not two
 * unrelated notifications. Never resolves/fetches a link and never logs the
 * code/link it assembles (pure, deterministic, local-only).
 */

import type { ParsedEmail } from '@/src/gmail/types';
import type {
  ActionRisk,
  DetectedEvent,
  RiskLevel,
  VerificationActionType,
} from '@/src/verification/types';
import { classifyMessage } from './classify-message';
import { parseExplicitExpiry } from './expiration';
import { extractCode } from './extract-code';
import { extractVerificationLinks } from './extract-links';

const RISK_RANK: Record<RiskLevel, number> = { normal: 0, caution: 1, blocked: 2 };

/** Worst (highest-severity) risk among a set of link risks, or `normal` if empty. */
function worstRisk(risks: ActionRisk[]): ActionRisk {
  let worst: ActionRisk = { level: 'normal', reasons: [] };
  for (const risk of risks) {
    if (RISK_RANK[risk.level] > RISK_RANK[worst.level]) worst = risk;
  }
  return worst;
}

/** Classify a winning link's sub-type from its anchor text (§3.3, §3.4). */
function linkActionType(anchorText: string): VerificationActionType {
  const text = anchorText.toLowerCase();
  if (/magic|sign[- ]?in/.test(text)) return 'magic_sign_in';
  if (/activate/.test(text)) return 'account_activation';
  if (/confirm/.test(text)) return 'account_confirmation';
  return 'verification_link';
}

/**
 * Detect a verification event from a parsed email, or `null` when the message
 * does not clear the intent classifier or yields no usable code/link candidate.
 *
 * When both a code and a link are present, the code is preferred as the primary
 * `type` ('otp_code') but the link is still attached (§3.4 "both" case).
 */
// A link whose own anchor is a clear verify/confirm/activate action is strong
// evidence; when present it lets an email with weaker body wording still qualify,
// provided there is at least some verification wording (INTENT_FLOOR) — keeping
// false positives low.
const STRONG_LINK_SCORE = 10;
const INTENT_FLOOR = 3;

export function detectVerificationEvent(email: ParsedEmail): DetectedEvent | null {
  const classification = classifyMessage(email);
  const codeCandidate = extractCode(email);
  const linkCandidates = extractVerificationLinks(email);
  const bestLink = linkCandidates[0];

  const strongLink = bestLink !== undefined && bestLink.score >= STRONG_LINK_SCORE;
  const isVerification =
    classification.isVerification || (classification.intentScore >= INTENT_FLOOR && strongLink);
  if (!isVerification) return null;

  let type: VerificationActionType;
  let actionScore: number;

  if (codeCandidate) {
    type = 'otp_code';
    actionScore = codeCandidate.score;
  } else if (bestLink) {
    type = linkActionType(bestLink.anchorText);
    actionScore = bestLink.score;
  } else {
    return null;
  }

  const risk =
    linkCandidates.length > 0
      ? worstRisk(linkCandidates.map((c) => c.risk))
      : { level: 'normal' as const, reasons: [] };

  return {
    type,
    code: codeCandidate
      ? { display: codeCandidate.display, copyValue: codeCandidate.copyValue }
      : undefined,
    link: bestLink
      ? {
          exactUrl: bestLink.exactUrl,
          hostname: bestLink.hostname,
          registrableDomain: bestLink.registrableDomain,
        }
      : undefined,
    explicitExpiryAt: parseExplicitExpiry(email, email.internalDate),
    intentScore: classification.intentScore,
    actionScore,
    risk,
  };
}
