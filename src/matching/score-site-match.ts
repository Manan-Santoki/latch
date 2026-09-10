/**
 * Latch — site-match scoring (§14.1, §14.2, §3.5).
 *
 * Deterministic only — no network, no LLM. All domain comparisons reduce
 * inputs to registrable domains via `./domain`; the returned result carries
 * signal labels only (no URLs/hostnames retained or logged).
 */

import { AUTO_OVERLAY_TOTAL_THRESHOLD } from '../shared/constants';
import type { DetectedEvent, RiskLevel } from '../verification/types';
import { brandForDomain } from './aliases';
import { isIpLiteral, isPunycode, registrableDomain, sameRegistrableDomain } from './domain';
import type { CurrentSite, MatchLevel, SiteMatchResult } from './types';

/**
 * Small, maintained set of known ESP/marketing-only domains (§14.1 "-4
 * generic unrelated marketing domain"). Deliberately conservative — extend
 * only with test coverage backing each entry.
 */
const GENERIC_MARKETING_DOMAINS: ReadonlySet<string> = new Set([
  'list-manage.com',
  'mailchimp.com',
  'sendgrid.net',
  'constantcontact.com',
  'hubspotemail.net',
  'mandrillapp.com',
  'klaviyomail.com',
]);

/** True when both resolve to the same non-null registrable domain. */
function domainsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return sameRegistrableDomain(a, b);
}

/** True when both resolve to *different*, non-null registrable domains. */
function domainsConflict(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = registrableDomain(a);
  const db = registrableDomain(b);
  return da !== null && db !== null && da !== db;
}

function capitalize(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The current site's maintained brand name (if any) and a heuristic label
 *  derived purely from its registrable domain's main token. */
function siteDerivedNames(currentSite: CurrentSite): {
  brand: string | null;
  label: string | null;
} {
  const reg = currentSite.registrableDomain;
  if (!reg) return { brand: null, label: null };
  const brand = brandForDomain(reg);
  const mainLabel = reg.split('.')[0];
  return { brand, label: mainLabel ? capitalize(mainLabel) : null };
}

/**
 * Score how likely `event` belongs to `currentSite` (§14.1).
 * Pure/deterministic: no network, no LLM, no retained URLs.
 */
export function scoreSiteMatch(
  event: DetectedEvent,
  senderDomain: string | undefined,
  currentSite: CurrentSite,
): SiteMatchResult {
  const linkRef = event.link?.exactUrl ?? event.link?.hostname;
  const siteRef = currentSite.registrableDomain ?? undefined;

  let score = 0;
  const reasons: string[] = [];

  // ── Strong domain signals ────────────────────────────────────────────────
  const linkMatchesSite = domainsMatch(linkRef, siteRef);
  if (linkMatchesSite) {
    score += 6;
    reasons.push('link_domain_matches_site');
  }

  const senderMatchesSite = domainsMatch(senderDomain, siteRef);
  if (senderMatchesSite) {
    score += 5;
    reasons.push('sender_domain_matches_site');
  }

  const senderMatchesLink = domainsMatch(senderDomain, linkRef);
  if (senderMatchesLink) {
    score += 5;
    reasons.push('sender_domain_matches_link');
  }

  // ── Brand/service token signals ──────────────────────────────────────────
  const { brand: siteBrand, label: siteLabel } = siteDerivedNames(currentSite);
  const service = event.service;

  const brandMatch = !!service && !!siteBrand && service.toLowerCase() === siteBrand.toLowerCase();
  if (brandMatch) {
    score += 3;
    reasons.push('brand_matches_site');
  }

  // DetectedEvent carries no subject/body text at this stage of the pipeline,
  // so the §14.1 "+2 subject names the current service" signal is
  // approximated using the already-resolved service token against the
  // site's own domain label — weaker corroboration than the maintained-brand
  // match above, since it is not backed by the aliases.ts map.
  const labelMatch =
    !brandMatch && !!service && !!siteLabel && service.toLowerCase() === siteLabel.toLowerCase();
  if (labelMatch) {
    score += 2;
    reasons.push('service_label_matches_site');
  }

  // ── Negative / conflict signals ──────────────────────────────────────────
  const linkConflictsWithSite = domainsConflict(linkRef, siteRef);
  const linkConflictsWithSender = domainsConflict(linkRef, senderDomain);
  const senderConflictsWithSite = domainsConflict(senderDomain, siteRef);

  if (linkConflictsWithSite && linkConflictsWithSender) {
    score -= 6;
    reasons.push('link_conflicts_site_and_sender');
  }

  const hasOtherPositiveEvidence = linkMatchesSite || senderMatchesLink || brandMatch || labelMatch;
  if (senderConflictsWithSite && !hasOtherPositiveEvidence) {
    score -= 5;
    reasons.push('sender_conflicts_site_no_evidence');
  }

  const linkReg = linkRef ? registrableDomain(linkRef) : null;
  const genericMarketing =
    linkReg !== null &&
    GENERIC_MARKETING_DOMAINS.has(linkReg) &&
    !linkMatchesSite &&
    !senderMatchesLink;
  if (genericMarketing) {
    score -= 4;
    reasons.push('generic_marketing_domain');
  }

  const ipLiteralLink = event.link ? isIpLiteral(event.link.exactUrl) : false;
  if (ipLiteralLink) {
    score -= 3;
    reasons.push('ip_literal_link');
  }

  const punycodeLink = event.link ? isPunycode(event.link.exactUrl) : false;
  if (punycodeLink) {
    score -= 2;
    reasons.push('punycode_link_host');
  }

  // ── Risk (§3.5) ───────────────────────────────────────────────────────────
  // A "soft" mismatch is the classic phishing tell: the link disagrees with
  // where the email claims to come from, or the sender disagrees with the
  // current site with no corroborating evidence elsewhere. A link that
  // merely doesn't match the *current tab* while still agreeing with its own
  // sender is not, by itself, a security concern — only relevance. Never
  // derived from sender display-name text (not available/used here).
  const softMismatch =
    linkConflictsWithSender || (senderConflictsWithSite && !hasOtherPositiveEvidence);

  let risk: RiskLevel;
  if (linkConflictsWithSite && linkConflictsWithSender) {
    risk = 'blocked';
  } else if (softMismatch || ipLiteralLink || punycodeLink || genericMarketing) {
    risk = 'caution';
  } else {
    risk = 'normal';
  }

  // ── Level ─────────────────────────────────────────────────────────────────
  // Only signals that establish relevance to the *current site* (not merely
  // internal sender/link coherence) qualify as the "strong" signal §14.2
  // requires before the overlay may auto-inject.
  const hasStrongSiteSignal = linkMatchesSite || senderMatchesSite;
  let level: MatchLevel;
  if (hasStrongSiteSignal && score > 0) {
    level = 'high';
  } else if (score > 0) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { level, score, risk, reasons };
}

/** Combined confidence compared against AUTO_OVERLAY_TOTAL_THRESHOLD (§14.2). */
export function combinedConfidence(
  intentScore: number,
  actionScore: number,
  siteScore: number,
): number {
  return intentScore + actionScore + siteScore;
}

/**
 * True iff the overlay should auto-inject (§14.2): risk is not blocked, the
 * site match reached the 'high' level (a strong site-relevance signal), and
 * combined confidence clears the threshold.
 */
export function shouldAutoOverlay(match: SiteMatchResult, combined: number): boolean {
  return (
    match.risk !== 'blocked' && match.level === 'high' && combined >= AUTO_OVERLAY_TOTAL_THRESHOLD
  );
}
