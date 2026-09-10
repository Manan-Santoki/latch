/**
 * Latch — structural link extraction (§10.2, §10.3).
 *
 * Pure structural extraction only — no scoring/classification here (that is a
 * separate module's job). Hrefs are always preserved verbatim.
 */

import type { ExtractedLink } from '@/src/gmail/types';
import { registrableDomain } from '@/src/matching/domain';
import { evaluateUrl } from '@/src/security/url-policy';

/** Bounded window of context captured around a link, for downstream classification. */
const SURROUNDING_WINDOW = 80;

/** Matches bare http(s) URLs in plain text, stopping at whitespace/angle-bracket/quote. */
const PLAIN_URL_RE = /https?:\/\/[^\s<>"']+/gi;

function buildLink(href: string, anchorText: string, surroundingText: string): ExtractedLink {
  const policy = evaluateUrl(href);
  const link: ExtractedLink = {
    href,
    anchorText,
    surroundingText,
    valid: policy.valid,
  };
  if (policy.scheme) {
    link.scheme = policy.scheme;
  }
  if (policy.hostname) {
    link.hostname = policy.hostname;
    const domain = registrableDomain(policy.hostname);
    if (domain) {
      link.registrableDomain = domain;
    }
  }
  return link;
}

/** Bounded window of text around [start, end) in `text`. */
function windowAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - SURROUNDING_WINDOW);
  const to = Math.min(text.length, end + SURROUNDING_WINDOW);
  return text.slice(from, to).trim();
}

/** Find bare https?:// URLs embedded in plain text. */
export function extractPlainTextLinks(text: string): ExtractedLink[] {
  if (!text) return [];
  const links: ExtractedLink[] = [];
  for (const match of text.matchAll(PLAIN_URL_RE)) {
    const href = match[0];
    const start = match.index ?? 0;
    const surroundingText = windowAround(text, start, start + href.length);
    links.push(buildLink(href, '', surroundingText));
  }
  return links;
}

// Schemes we skip entirely when found in an anchor href — not useful for
// verification-link matching and not worth surfacing to scorers.
const SKIPPED_ANCHOR_SCHEMES = new Set(['mailto:', 'tel:']);

/**
 * Extract every `<a href>` from an already-parsed, passive Document (built via
 * `new DOMParser().parseFromString(html, 'text/html')`). Anchors with
 * mailto:/tel: hrefs are skipped; other unsafe schemes (javascript:, data:, etc.)
 * are still returned with `valid: false` so scorers can see and penalize them.
 */
export function extractAnchorsFromDocument(doc: Document): ExtractedLink[] {
  const anchors = doc.querySelectorAll('a[href]');
  const links: ExtractedLink[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) continue;

    const trimmedScheme = href
      .trim()
      .slice(0, href.indexOf(':') + 1)
      .toLowerCase();
    if (SKIPPED_ANCHOR_SCHEMES.has(trimmedScheme)) {
      continue;
    }

    const anchorText = (anchor.textContent ?? '').trim();
    const parentText = anchor.parentElement?.textContent ?? anchorText;
    const surroundingText = parentText
      .trim()
      .slice(0, SURROUNDING_WINDOW * 2)
      .trim();

    links.push(buildLink(href, anchorText, surroundingText));
  }

  return links;
}
