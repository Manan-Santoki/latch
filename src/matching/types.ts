/**
 * Latch — domain/service matching contracts (§14).
 *
 * Shared CONTRACT. The current site is reduced to hostname/registrable domain
 * immediately and the full URL is never retained (§26).
 */

export interface CurrentSite {
  origin: string;
  hostname: string;
  registrableDomain: string | null;
}

export type MatchLevel = 'high' | 'medium' | 'low';

export interface SiteMatchResult {
  level: MatchLevel;
  /** Aggregate site-match score (§14.1). */
  score: number;
  /** Risk derived from domain conflicts (e.g. link/sender/site mismatch → caution/blocked). */
  risk: import('../verification/types').RiskLevel;
  /** Signal labels that contributed (diagnostics/tests) — no URLs. */
  reasons: string[];
}
