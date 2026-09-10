/**
 * Latch — OTP/verification code extraction (§12).
 *
 * Scans the subject and body for numeric/alphanumeric code-shaped tokens, scores
 * each by proximity to verification keywords versus commercial/transactional
 * noise (order numbers, prices, dates, phone numbers), and returns only the best
 * candidate that clears `MIN_ACTION_SCORE`. Never inspects link URLs — that is
 * extract-links.ts's job. Pure/deterministic: no network, no logging.
 */

import type { ParsedEmail } from '@/src/gmail/types';
import { MIN_ACTION_SCORE } from '@/src/shared/constants';
import type { CodeCandidate } from '@/src/verification/types';
import { resolveBodyText } from './classify-message';

// ─── Candidate token shapes (§12) ────────────────────────────────────────────

/** Plain numeric run, e.g. "824193". Length-filtered to {4,6,8} below. */
const NUMERIC_PLAIN_RE = /\b\d{4,8}\b/g;
/** Spaced/hyphenated numeric groups, e.g. "824 193", "824-193". */
const NUMERIC_GROUPED_RE = /\b\d{2,4}(?:[ -]\d{2,4}){1,2}\b/g;
/** Contiguous alphanumeric token, e.g. "AB12CD". */
const ALNUM_PLAIN_RE = /\b[A-Za-z0-9]{4,10}\b/g;
/** Letter/digit block plus a single hyphen, e.g. "G-123456". */
const ALNUM_HYPHEN_RE = /\b[A-Za-z0-9]{1,4}-[A-Za-z0-9]{2,8}\b/g;

function isMixedAlnum(normalized: string): boolean {
  return (
    /[A-Za-z]/.test(normalized) &&
    /\d/.test(normalized) &&
    normalized.length >= 4 &&
    normalized.length <= 10
  );
}

interface RawCandidate {
  raw: string;
  start: number;
  end: number;
}

function collectMatches(
  text: string,
  regex: RegExp,
  filter: (raw: string) => boolean,
  out: RawCandidate[],
): void {
  regex.lastIndex = 0;
  let m: RegExpExecArray | null = regex.exec(text);
  while (m !== null) {
    const raw = m[0];
    if (raw !== undefined && raw.length > 0 && filter(raw)) {
      out.push({ raw, start: m.index, end: m.index + raw.length });
    }
    m = regex.exec(text);
  }
}

function gatherRawCandidates(text: string): RawCandidate[] {
  const out: RawCandidate[] = [];
  collectMatches(text, NUMERIC_PLAIN_RE, (raw) => [4, 6, 8].includes(raw.length), out);
  collectMatches(
    text,
    NUMERIC_GROUPED_RE,
    (raw) => [4, 6, 8].includes(raw.replace(/[^\d]/g, '').length),
    out,
  );
  collectMatches(text, ALNUM_PLAIN_RE, (raw) => isMixedAlnum(raw), out);
  collectMatches(text, ALNUM_HYPHEN_RE, (raw) => isMixedAlnum(raw.replace(/-/g, '')), out);
  return out;
}

/**
 * Keep only the longest match at each overlapping text span (e.g. prefer the
 * full "G-123456" hyphenated candidate over the "123456" numeric sub-match it
 * contains).
 */
function dedupeOverlaps(candidates: RawCandidate[]): RawCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: RawCandidate[] = [];
  for (const candidate of sorted) {
    const overlaps = kept.some((k) => candidate.start < k.end && candidate.end > k.start);
    if (!overlaps) kept.push(candidate);
  }
  return kept.sort((a, b) => a.start - b.start);
}

// ─── Scoring (§12) ────────────────────────────────────────────────────────────

const KEYWORD_RES = [
  /\bcode\b/i,
  /\botp\b/i,
  /\bverification\b/i,
  /\bsecurity\b/i,
  /\bsign[- ]?in\b/i,
  /\bverify\b/i,
  /\bconfirm\b/i,
];

const MONEY_RE = /[$€£]/;
const COMMERCIAL_RE = /\border\b|\binvoice\b|\btracking\b|\breceipt\b|\bshipment\b|\bshipped\b/i;
const RESERVATION_RE = /\breservation\b|\bticket\b|\bconfirmation number\b|\bitinerary\b/i;
const PHONE_SHAPE_RE = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const PHONE_WORD_RE = /\bcall (us|now|support)\b|\bphone number\b|\bmobile number\b/i;

function lineBounds(
  text: string,
  start: number,
  end: number,
): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

/** Start of the line immediately before `lineStart` (for keyword lookback), or `lineStart` if none. */
function previousLineStart(text: string, lineStart: number): number {
  if (lineStart === 0) return lineStart;
  const prevBreak = text.lastIndexOf('\n', lineStart - 2);
  return prevBreak + 1;
}

function looksLikeYear(normalized: string): boolean {
  if (!/^\d{4}$/.test(normalized)) return false;
  const n = Number.parseInt(normalized, 10);
  return n >= 1900 && n <= 2099;
}

function scoreCandidate(candidate: RawCandidate, fullText: string, subjectLength: number): number {
  const normalized = candidate.raw.replace(/[\s-]/g, '');
  const { lineStart, lineEnd } = lineBounds(fullText, candidate.start, candidate.end);
  // Negative/commercial context is checked on the candidate's own line only, so
  // an unrelated label on an adjacent line (e.g. a preceding "Tracking number:"
  // line) can't bleed a penalty onto a genuine code on the next line.
  const line = fullText.slice(lineStart, lineEnd);
  // Positive keyword context may reach back one line, since "Your code:" /
  // "824193" sometimes split across two lines.
  const keywordContext = fullText.slice(previousLineStart(fullText, lineStart), lineEnd);

  let score = 0;

  const keywordHits = KEYWORD_RES.filter((re) => re.test(keywordContext)).length;
  score += Math.min(keywordHits, 2) * 3;

  if (line.trim().length <= candidate.raw.length + 15) {
    score += 2;
  }

  if (candidate.start < subjectLength) {
    score += 3;
  }

  if (normalized.length >= 4 && normalized.length <= 8) {
    score += 1;
  }

  if (MONEY_RE.test(line)) score -= 4;
  if (COMMERCIAL_RE.test(line)) score -= 5;
  if (RESERVATION_RE.test(line)) score -= 4;
  if (PHONE_SHAPE_RE.test(line)) score -= 5;
  if (PHONE_WORD_RE.test(line)) score -= 2;
  if (looksLikeYear(normalized) && keywordHits === 0) score -= 4;

  return score;
}

/**
 * Extract the single best OTP/verification code candidate from a parsed email
 * (§12), or `null` when nothing clears `MIN_ACTION_SCORE`. `display` preserves
 * the original formatting; `copyValue` drops only separators (spaces/hyphens) —
 * meaningful letters/digits in alphanumeric codes are never stripped.
 */
export function extractCode(email: ParsedEmail): CodeCandidate | null {
  const subject = email.subject ?? '';
  const body = resolveBodyText(email);
  const fullText = `${subject}\n${body}`;

  const candidates = dedupeOverlaps(gatherRawCandidates(fullText));
  if (candidates.length === 0) return null;

  let best: { raw: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, fullText, subject.length);
    if (best === null || score > best.score) {
      best = { raw: candidate.raw, score };
    }
  }

  if (best === null || best.score < MIN_ACTION_SCORE) return null;

  return {
    display: best.raw,
    copyValue: best.raw.replace(/[\s-]/g, ''),
    score: best.score,
  };
}
