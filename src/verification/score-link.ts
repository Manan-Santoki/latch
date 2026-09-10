/**
 * Latch — verification-link scoring (§13.1, §13.2).
 *
 * Scores a single extracted link candidate purely from its own anchor/context
 * text and hostname shape. Domain/service matching against the current site is a
 * separate module (§14); this module never resolves, fetches, or judges a link by
 * hostname substring — only via the registrable-domain-safe primitives in
 * `@/src/matching/domain`. `exactUrl` is never touched/rewritten here.
 */

import type { ExtractedLink } from '@/src/gmail/types';
import { isIpLiteral, isPunycode } from '@/src/matching/domain';
import type { ActionRisk } from '@/src/verification/types';

interface WeightedPhrase {
  label: string;
  regex: RegExp;
  weight: number;
}

// §13.1 — positive anchor/context signals.
const POSITIVE_SIGNALS: WeightedPhrase[] = [
  { label: 'verify_your_email', regex: /\bverify your email\b/i, weight: 7 },
  { label: 'verify_email', regex: /\bverify email\b/i, weight: 7 },
  { label: 'confirm_email', regex: /\bconfirm email\b/i, weight: 6 },
  { label: 'confirm_your_account', regex: /\bconfirm your account\b/i, weight: 6 },
  { label: 'activate_account', regex: /\bactivate (your )?account\b/i, weight: 5 },
  { label: 'complete_verification', regex: /\bcomplete verification\b/i, weight: 5 },
  { label: 'magic_link', regex: /\bmagic (sign[- ]?in )?link\b/i, weight: 4 },
  { label: 'sign_in', regex: /\bsign[- ]?in\b/i, weight: 4 },
  { label: 'continue', regex: /\bcontinue\b/i, weight: 3 },
];

// §13.2 — strong negative signals.
const NEGATIVE_SIGNALS: WeightedPhrase[] = [
  { label: 'unsubscribe', regex: /\bunsubscribe\b/i, weight: -12 },
  { label: 'manage_preferences', regex: /\bmanage( your| email)? preferences\b/i, weight: -10 },
  { label: 'privacy_policy', regex: /\bprivacy policy\b/i, weight: -10 },
  {
    label: 'terms_of_service',
    regex: /\bterms (of service|and conditions|&\s?conditions)\b/i,
    weight: -10,
  },
  { label: 'view_in_browser', regex: /\bview (this )?(email )?in( your)? browser\b/i, weight: -8 },
  {
    label: 'social_media',
    regex: /\b(follow us|facebook|twitter|instagram|linkedin|tiktok)\b/i,
    weight: -8,
  },
  { label: 'help_center', regex: /\b(help center|support center|contact support)\b/i, weight: -8 },
  {
    label: 'marketing_cta',
    regex: /\b(shop now|shop the sale|learn more|browse (our|the) collection|sale ends)\b/i,
    weight: -8,
  },
];

function resolveHostname(link: ExtractedLink): string | null {
  if (link.hostname) return link.hostname;
  try {
    return new URL(link.href).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Score a single link candidate from its own anchor/surrounding text and
 * hostname shape (§13.1, §13.2). Never fetches, resolves, or follows the URL
 * (§13.3) — only the hostname already present in the email is read.
 */
export function scoreLink(link: ExtractedLink): { score: number; risk: ActionRisk } {
  const text = `${link.anchorText}\n${link.surroundingText}`;
  let score = 0;

  for (const signal of POSITIVE_SIGNALS) {
    if (signal.regex.test(text)) score += signal.weight;
  }
  for (const signal of NEGATIVE_SIGNALS) {
    if (signal.regex.test(text)) score += signal.weight;
  }

  const reasons: string[] = [];
  const host = resolveHostname(link);
  if (host) {
    if (isIpLiteral(host)) reasons.push('ip_literal');
    if (isPunycode(host)) reasons.push('punycode');
  }

  const risk: ActionRisk =
    reasons.length > 0 ? { level: 'caution', reasons } : { level: 'normal', reasons: [] };

  return { score, risk };
}
