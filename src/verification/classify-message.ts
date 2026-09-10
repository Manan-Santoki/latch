/**
 * Latch — verification intent classifier (§11).
 *
 * Deterministic, local-only scoring. No LLM, no network. Splits the question in
 * two per §11: does this message look verification-related at all (intent) —
 * handled here — versus which candidate code/link is the action, handled by the
 * separate extractors. False positives (surfacing an invoice/order number as a
 * verification code) are the costlier error (Phase 6), so negative commercial
 * signals are weighted to confidently suppress ordinary transactional mail, and a
 * bare digit run is never itself an intent signal — only wording is.
 */

import type { ParsedEmail } from '@/src/gmail/types';
import { MIN_INTENT_SCORE } from '@/src/shared/constants';
import type { ClassificationResult } from '@/src/verification/types';

interface LocatedSignal {
  label: string;
  regex: RegExp;
  /** Weight applied when the phrase appears in the subject. 0 = subject not scored. */
  subjectWeight: number;
  /** Weight applied when the phrase appears in the body. 0 = body not scored. */
  bodyWeight: number;
}

interface FlatSignal {
  label: string;
  regex: RegExp;
  weight: number;
}

// ─── Positive intent signals (§11.1, §11.2) ──────────────────────────────────
// Subject occurrences are weighted higher than body occurrences (module brief).
// Both are additive: a phrase repeated in subject and body reinforces the score.
const POSITIVE_SIGNALS: LocatedSignal[] = [
  { label: 'verification_code', regex: /\bverification code\b/i, subjectWeight: 7, bodyWeight: 5 },
  { label: 'one_time_code', regex: /\bone[- ]?time code\b/i, subjectWeight: 7, bodyWeight: 5 },
  {
    label: 'one_time_password',
    regex: /\bone[- ]?time password\b/i,
    subjectWeight: 7,
    bodyWeight: 5,
  },
  { label: 'otp', regex: /\botp\b/i, subjectWeight: 6, bodyWeight: 4 },
  { label: 'sign_in_code', regex: /\bsign[- ]?in code\b/i, subjectWeight: 6, bodyWeight: 4 },
  { label: 'login_code', regex: /\blog[- ]?in code\b/i, subjectWeight: 6, bodyWeight: 4 },
  { label: 'verify_your_email', regex: /\bverify your email\b/i, subjectWeight: 6, bodyWeight: 4 },
  {
    label: 'verify_email_address',
    regex: /\bverify (your )?email address\b/i,
    subjectWeight: 6,
    bodyWeight: 4,
  },
  { label: 'verify_email', regex: /\bverify email\b/i, subjectWeight: 5, bodyWeight: 4 },
  {
    label: 'confirm_your_email',
    regex: /\bconfirm (this is )?your email\b/i,
    subjectWeight: 6,
    bodyWeight: 4,
  },
  { label: 'confirm_email', regex: /\bconfirm email\b/i, subjectWeight: 5, bodyWeight: 4 },
  {
    label: 'confirm_account',
    regex: /\bconfirm (your )?account\b/i,
    subjectWeight: 5,
    bodyWeight: 4,
  },
  {
    label: 'confirm_email_address',
    regex: /\b(confirm|verify) (that )?(this is )?your email address\b/i,
    subjectWeight: 5,
    bodyWeight: 4,
  },
  {
    label: 'verify_your_account',
    regex: /\bverify your (?:[\w'-]+ )?account\b/i,
    subjectWeight: 5,
    bodyWeight: 4,
  },
  {
    label: 'finish_account_setup',
    regex: /\bfinish (setting up|creating) your account\b/i,
    subjectWeight: 3,
    bodyWeight: 3,
  },
  { label: 'security_code', regex: /\bsecurity code\b/i, subjectWeight: 5, bodyWeight: 3 },
  { label: 'confirmation_code', regex: /\bconfirmation code\b/i, subjectWeight: 5, bodyWeight: 3 },
  { label: 'magic_link', regex: /\bmagic (sign[- ]?in )?link\b/i, subjectWeight: 5, bodyWeight: 3 },
  {
    label: 'activate_account',
    regex: /\bactivate (your )?account\b/i,
    subjectWeight: 5,
    bodyWeight: 4,
  },
  {
    label: 'passwordless_sign_in',
    regex: /\bpasswordless sign[- ]?in\b/i,
    subjectWeight: 5,
    bodyWeight: 3,
  },
  { label: 'use_this_code', regex: /\buse this code\b/i, subjectWeight: 5, bodyWeight: 4 },
  { label: 'your_code_is', regex: /\byour code is\b/i, subjectWeight: 6, bodyWeight: 5 },
  { label: 'expires_in', regex: /\bexpires? in\b/i, subjectWeight: 0, bodyWeight: 3 },
  {
    label: 'do_not_share_code',
    regex: /\bdo not share (this|your) code\b/i,
    subjectWeight: 0,
    bodyWeight: 3,
  },
];

// ─── Negative (commercial/transactional) signals (§11.1, §11.2) ─────────────
// Applied once against subject+body combined — these are suppression signals
// regardless of where they appear.
const NEGATIVE_SIGNALS: FlatSignal[] = [
  { label: 'invoice', regex: /\binvoice\b/i, weight: -6 },
  { label: 'tracking_number', regex: /\btracking number\b/i, weight: -6 },
  { label: 'receipt', regex: /\breceipt\b/i, weight: -5 },
  { label: 'order_number', regex: /\border number\b/i, weight: -5 },
  { label: 'order_confirmation', regex: /\border confirmation\b/i, weight: -4 },
  { label: 'shipment', regex: /\bshipment\b|\bshipped\b|\bships\b/i, weight: -4 },
  { label: 'delivery', regex: /\bdelivery\b|\bdelivered\b/i, weight: -4 },
  { label: 'reservation', regex: /\breservation\b/i, weight: -4 },
  { label: 'ticket_number', regex: /\bticket number\b/i, weight: -4 },
  { label: 'confirmation_number', regex: /\bconfirmation number\b/i, weight: -4 },
  { label: 'statement', regex: /\bstatement\b/i, weight: -3 },
  { label: 'transaction', regex: /\btransaction\b/i, weight: -3 },
];

const CURRENCY_RE = /(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*\.\d{2}\b)/g;
const COMMERCIAL_CONTEXT_RE = /\b(total|subtotal|amount due|balance|charged|checkout|cart)\b/i;

/** Resolve searchable body text: prefer `plainText`, else a crude HTML-tag strip. */
export function resolveBodyText(email: ParsedEmail): string {
  if (email.plainText && email.plainText.trim().length > 0) {
    return email.plainText;
  }
  if (email.htmlText && email.htmlText.trim().length > 0) {
    return email.htmlText
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

function isCurrencyHeavy(combined: string): boolean {
  const matches = combined.match(CURRENCY_RE);
  const priceCount = matches ? matches.length : 0;
  const hasCommercialContext = COMMERCIAL_CONTEXT_RE.test(combined);
  return priceCount >= 2 || (priceCount >= 1 && hasCommercialContext);
}

/**
 * Deterministic verification-intent classification (§11). Never inspects link
 * URLs or code candidates — those are separate questions handled downstream by
 * extract-code.ts / extract-links.ts. A bare digit run alone contributes nothing
 * here: intent is decided purely from wording.
 */
export function classifyMessage(email: ParsedEmail): ClassificationResult {
  const subject = email.subject ?? '';
  const body = resolveBodyText(email);
  const combined = `${subject}\n${body}`;

  let score = 0;
  const matched = new Set<string>();

  for (const signal of POSITIVE_SIGNALS) {
    if (signal.subjectWeight > 0 && signal.regex.test(subject)) {
      score += signal.subjectWeight;
      matched.add(signal.label);
    }
    if (signal.bodyWeight > 0 && signal.regex.test(body)) {
      score += signal.bodyWeight;
      matched.add(signal.label);
    }
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (signal.regex.test(combined)) {
      score += signal.weight;
      matched.add(signal.label);
    }
  }

  if (isCurrencyHeavy(combined)) {
    score -= 3;
    matched.add('currency_heavy_commercial');
  }

  const intentScore = Math.max(0, score);

  return {
    isVerification: intentScore >= MIN_INTENT_SCORE,
    intentScore,
    matchedSignals: Array.from(matched),
  };
}
