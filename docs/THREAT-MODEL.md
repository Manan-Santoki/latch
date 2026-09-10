# Latch — Threat Model

Latch handles authentication material (OTPs, verification/magic links) read from Gmail. The
design keeps that material inside the trusted extension context and never lets a website, a
developer server, or logs see it. This document enumerates the threats and Latch's
mitigations. It is a living document; update it before changing any decision in §45 of the
build spec.

## Assets
- Gmail message bodies (read-only, in memory during processing).
- OTP codes and their normalized copy values.
- Verification / magic-link URLs (may be single-use and token-bearing).
- OAuth access token (managed by `chrome.identity`).
- The current site's origin/hostname (for matching only).

## Trust boundaries
- **Trusted:** background service worker, offscreen document, extension pages
  (popup, options, overlay iframe) — all `chrome-extension://` origin.
- **Untrusted:** the host web page and its scripts; the network; any third party.

---

## Threat: a malicious current website reads the OTP / link
**Mitigation.** The secret is rendered only inside an extension-origin `<iframe
src="chrome-extension://…/overlay.html">`. The injected wrapper in the host page contains no
secret and cannot read the cross-origin iframe's DOM (same-origin policy). No secret is put
in page HTML, JS globals, data attributes, the iframe URL, or a `window.postMessage` payload.
The only cross-frame messages carry layout/lifecycle (`resize`, `dismissed`) — never content.
Copy/open are requested by opaque **action id**; the background resolves the value from
`chrome.storage.session`.

## Threat: a phishing email contains a misleading link
**Mitigation.** URLs are parsed with the native `URL` constructor; hostnames are compared by
**registrable domain** via `tldts`, never substring — `github.com.evil.example` and
`github.com@evil.example` resolve to `evil.example`. Only `https:` qualifies for the normal
one-click open. A link whose registrable domain conflicts with both the sender and the
current site is marked **blocked** — the overlay shows a mismatch warning and no normal Open
button. A mismatch is never overridden based on sender display-name text.

## Threat: a verification link is consumed by a preview/prefetch
**Mitigation.** Latch never issues `fetch`/`HEAD`, never loads the URL in a hidden frame,
and never resolves redirectors. The exact URL is opened only in a new tab after an explicit
user click, preserving query and fragment verbatim.

## Threat: the extension logs secrets
**Mitigation.** A single `redaction` utility (`src/security/redaction.ts`) scrubs URLs to
host-only and masks OTP-shaped and token-shaped strings; privileged code logs through
`logger`, never `console.*` directly. Pure logic modules do not log. A build-time grep (M5)
and tests assert no code/URL appears in diagnostics. Diagnostics expose only sanitized fields
(§21/§22).

## Threat: a compromised backend exfiltrates mailbox data
**Mitigation.** v1 has **no application backend**. No message body, OTP, link, token, or
browsing domain is transmitted off-device. There is nothing server-side to compromise.

## Threat: an extension-update supply-chain compromise
**Mitigation.** No remotely-hosted executable code (MV3 requirement) — everything is bundled.
Dependencies are pinned via the lockfile and kept minimal. The publisher account uses strong
2FA. The production bundle is reviewed before release (M5).

## Threat: a page spoofs the Latch overlay to harvest a code the user types
**Mitigation.** Latch never asks the user to type a code into a page; it only displays and
copies. Consistent branding + the toolbar popup let a user verify the real action out-of-band.
We do not claim the overlay is impossible to imitate.

## Threat: a stale OTP is shown and used
**Mitigation.** Only recently-added messages are processed (narrow age window), each action
has a local TTL (default 15 min), and the overlay shows a relative receipt time. Latch never
asserts a specific expiry unless the email stated one explicitly.

## Threat: privilege escalation via a forged message
**Mitigation.** The background validates every incoming message against a zod discriminated
union (`extensionMessageSchema`); anything else is ignored. There is no generic
`{type,payload}` path, and copy/open accept only an action id — never a URL or code from an
injected page.

## Threat: session secrets leak to another profile / incognito
**Mitigation.** Secrets live in `chrome.storage.session` (in-memory, TRUSTED_CONTEXTS access
level; content scripts cannot read it) and disappear on browser restart. Incognito is not
enabled for v1.
