# Testing

Latch is tested in layers, with fixtures first and live Gmail last (§31).

## Run the suites

```bash
pnpm typecheck   # wxt prepare + tsc --noEmit
pnpm test        # Vitest unit + integration (fixtures, no network)
pnpm lint        # Biome
pnpm build       # production build
pnpm e2e         # Playwright (see below; requires a Chromium install)
```

## What the automated tests cover

- **Code extraction** (`tests/unit/extract-code.*`): numeric / spaced / hyphenated /
  alphanumeric OTPs; commercial false-positive fixtures (invoice, order, tracking, price,
  year, phone, reservation) must NOT yield a code.
- **Links** (`tests/unit/extract-links.*`, `score-link`, `html-only-link`,
  `mime-verify-email`): verify/confirm/activate/magic links; unsubscribe/terms/marketing
  negatives; `javascript:`/`data:`/`http:`/IP/punycode/`github.com.evil.example`/
  `github.com@evil.example`/malformed URL handling; HTML-only emails whose link lives only
  in an `<a href>`.
- **MIME** (`tests/unit/mime.*`, fixtures under `tests/fixtures/multipart/`): plain/HTML/
  multipart-alternative/mixed/nested/empty/malformed/unicode; base64url decoding.
- **Domain matching** (`tests/unit/*site*`, `domain`): registrable-domain equivalence and
  the auto-overlay gate.
- **Gmail sync** (`tests/unit/gmail-client.*`, `sync-engine.*`, `auth-errors.*`): mocked
  history/profile/message responses, 401/404/429/5xx, pagination, stale-history recovery,
  backoff.
- **Pipeline & security** (`tests/unit/dedupe.*`, `action-router.*`, `action-view-secrets.*`,
  `tests/integration/storage.*`): dedup, action assembly, and the invariant that the UI view
  model never carries `copyValue`/`exactUrl`.

## Manual end-to-end (the injection boundary, §31.7)

The cross-origin overlay boundary is browser-enforced; verify it by hand once per release:

1. `pnpm build`, load `.output/chrome-mv3` unpacked (`chrome://extensions` → Developer mode).
2. In the popup's **Developer** section, inject a fake action (no Gmail needed).
3. On a normal https page, confirm the overlay appears top-right.
4. In the page's DevTools console, confirm the host page **cannot** read the OTP from the
   iframe (`document.getElementById('latch-overlay-host').querySelector('iframe')
   .contentDocument` throws / is null — cross-origin).
5. Click **Copy** → the code is on the clipboard; **Dismiss** → the overlay is removed.
6. Toggle the three site-access modes; grant/revoke a site and confirm auto-injection stops.

## Live Gmail (separate, manual)

With your OAuth client configured ([`GOOGLE-OAUTH-SETUP.md`](GOOGLE-OAUTH-SETUP.md)):
connect Gmail, send yourself a verification email, and confirm the code/link surfaces within
a few seconds (a form submit / verify click / popup open starts a fast-poll burst). Commercial
emails (invoices/orders) must not surface. The service-worker console logs sanitized counts
only (`poll fetched=… routed=…`, `route: … injected=…`) — never a code, URL, or subject.

## Playwright (`pnpm e2e`)

MV3 extensions require a persistent context and a headed (or new-headless) Chromium:

```bash
pnpm exec playwright install chromium
pnpm e2e
```
