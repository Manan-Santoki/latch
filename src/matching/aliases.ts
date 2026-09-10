/**
 * Latch — first-party brand aliases (§13.3, §14.1).
 *
 * A small, deliberately conservative map from registrable domain to a
 * human-readable brand name. Used to:
 *  - give a friendly `service` label when none is otherwise inferable, and
 *  - strengthen site-match evidence when the resolved service token matches
 *    the current site's own brand (§14.1 "+3 service/brand token strongly
 *    matches current site's domain").
 *
 * Keep this list small and maintained — add an entry only when backed by a
 * test (`tests/unit/service.test.ts` / `tests/unit/score-site-match.test.ts`).
 *
 * Per §13.3, do NOT resolve or map ESP/redirector domains (SendGrid, Mailgun,
 * Customer.io, AWS, SafeLinks, etc.) to a brand here unless a specific
 * first-party mapping is backed by a test — by default none are included.
 */

import { registrableDomain } from './domain';

const BRAND_BY_DOMAIN: Readonly<Record<string, string>> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'google.com': 'Google',
  'microsoft.com': 'Microsoft',
  'apple.com': 'Apple',
  'amazon.com': 'Amazon',
  'paypal.com': 'PayPal',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'dropbox.com': 'Dropbox',
  'slack.com': 'Slack',
  'stripe.com': 'Stripe',
  'discord.com': 'Discord',
  'notion.so': 'Notion',
};

/**
 * Resolve a hostname/URL/registrable-domain string to its maintained brand
 * name via `registrableDomain`, or null when unmapped/unparseable.
 */
export function brandForDomain(domainOrHost: string): string | null {
  const domain = registrableDomain(domainOrHost);
  if (!domain) return null;
  return BRAND_BY_DOMAIN[domain] ?? null;
}

/** Unique maintained brand names, for scanning free text (e.g. subjects). */
export function knownBrandNames(): readonly string[] {
  return Array.from(new Set(Object.values(BRAND_BY_DOMAIN)));
}
