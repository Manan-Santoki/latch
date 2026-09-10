/**
 * Latch — service/brand inference (§14).
 *
 * Deterministic only — no network, no LLM. Never retains a full URL; only
 * ever works with the sender's registrable domain and the message subject.
 */

import { brandForDomain, knownBrandNames } from './aliases';
import { registrableDomain } from './domain';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word, case-insensitive match of `token` inside `text`. */
function wordMatches(text: string, token: string): boolean {
  if (!token) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
  return pattern.test(text);
}

function capitalize(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Infer a human-friendly service/brand name for a detected event.
 *
 * Preference order:
 *  1. A maintained brand mapping for the sender's registrable domain.
 *  2. A Capitalized token derived from that domain's main label
 *     (e.g. `notify@mycoolapp.com` -> sender domain `mycoolapp.com` -> `Mycoolapp`).
 *  3. A known brand mentioned by name in the subject line.
 *
 * Returns undefined when nothing sensible can be derived.
 */
export function inferService(
  senderDomain: string | undefined,
  subject: string | undefined,
): string | undefined {
  if (senderDomain) {
    const brand = brandForDomain(senderDomain);
    if (brand) return brand;

    const domain = registrableDomain(senderDomain);
    const mainLabel = domain?.split('.')[0];
    if (mainLabel) {
      const capitalized = capitalize(mainLabel);
      if (capitalized) return capitalized;
    }
  }

  if (subject) {
    for (const brand of knownBrandNames()) {
      if (wordMatches(subject, brand)) return brand;
    }
  }

  return undefined;
}

/** True when the subject line names the resolved service by (whole) word. */
export function subjectNamesService(
  subject: string | undefined,
  service: string | undefined,
): boolean {
  if (!subject || !service) return false;
  return wordMatches(subject, service);
}
