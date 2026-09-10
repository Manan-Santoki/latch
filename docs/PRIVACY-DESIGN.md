# Latch — Privacy Design

This document records how Latch handles data. It is the engineering basis for the public
privacy policy required before release (spec §33) and for the Google/Chrome Limited Use
disclosures (§34).

## What Latch accesses
- **Gmail (read-only, `gmail.readonly`).** Latch reads recently-added inbox messages to
  detect verification codes and links. Body access is required because codes and action
  links live in the message body/HTML; metadata-only scopes cannot provide them.
- **The active tab's address, on demand.** Only to match a verification event to the site
  you're on. It is reduced immediately to an origin/hostname; path, query, fragment, page
  text, and form contents are never read or retained.

## Why body access is necessary
A verification code (e.g. "Your code is 824193") or an action link (`<a href="…/verify">`)
appears in the message body or HTML. The Gmail metadata scope does not expose body content,
so it cannot power local detection. Latch requests the minimum scope that makes the feature
possible and nothing broader (no `gmail.modify`, no `mail.google.com`).

## Local processing — nothing leaves the device
All parsing, classification, extraction, and matching run **in the browser**. Latch has **no
backend**. Message bodies, OTPs, verification URLs, magic-link tokens, OAuth tokens, and
browsing domains are never transmitted to the developer or any third party. There is no
analytics, no remote classifier, no remote URL resolver, no LLM.

## What is persisted, and where
- `chrome.storage.local` (non-secret): user settings, site-access mode, explicitly-granted
  site rules, the Gmail `historyId` sync checkpoint, the connected account email (for the
  connection UI), a bounded set of deduplication **hashes**, and sanitized diagnostic
  timestamps/error classes.
- `chrome.storage.session` (secret, in-memory, cleared on browser restart): the currently
  active verification actions — code display/copy value, exact URL, presentation metadata.
- **Never persisted to disk:** raw email bodies, OTPs, full verification URLs, magic-link
  tokens, OAuth access tokens, or full browsing URLs.

## Retention & deletion
- Active codes/links are removed after a local relevance window (default 15 minutes), on
  dismiss, on browser restart (session storage clears), or on cleanup.
- Deduplication hashes are bounded (last ~200 messages / ~24h) and are opaque digests, not
  content.
- **Disconnecting Gmail** stops all monitoring and clears Gmail-derived state and the sync
  checkpoint. Revoking website access immediately stops site inspection/injection.

## OAuth token handling
The access token is managed and cached by `chrome.identity`. Latch never writes it to
`storage.local`, logs, error reports, or files.

## Limited Use compliance (Google API Services User Data Policy / Chrome Web Store)
Latch's use of Gmail data complies with the Limited Use requirements:
- Data is used **only** to provide the single user-facing feature (surfacing recent
  verification codes/links on the relevant site).
- Data is **not** transferred to others, used for advertising, or used to train models.
- No humans read the data; processing is automated and local.
- Only the minimum scope required is requested.

## Honest framing
Latch does not claim "we collect nothing." It **accesses and processes** Gmail messages and
the active tab's domain locally, even though the developer never receives them. The privacy
policy states this precisely.
