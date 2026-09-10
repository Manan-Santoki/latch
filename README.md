<p align="center">
  <img src="logo.svg" alt="Latch" width="104" height="104" />
</p>

# Latch

> Surface recent Gmail verification codes and links on the site where you need them.

[![CI](https://github.com/Manan-Santoki/latch/actions/workflows/ci.yml/badge.svg)](https://github.com/Manan-Santoki/latch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-1a73e8)

Latch is a local-first Chrome (Manifest V3) extension. It connects to your Gmail with
explicit **read-only** authorization, watches for newly-arrived verification email, and —
entirely **in your browser** — detects one-time codes (OTPs) and verification / magic
sign-in links, then surfaces the relevant action in a secure top-right overlay on the site
where you're likely to need it.

**Single purpose:** help you complete email-based verification and sign-in by locally
detecting recent Gmail verification codes or links and presenting them on the relevant
website. Nothing more.

## Privacy model

- Gmail access is **read-only** (`gmail.readonly`).
- Message processing happens **locally**. Message bodies, OTPs, links, tokens, and browsing
  domains are **never sent to a developer server** — Latch has no backend.
- Active codes/links live only in `chrome.storage.session` (in-memory, this browser
  session) and are cleared after a short local relevance window (default 15 min).
- Verification links **never open automatically** and are **never pre-fetched** (a preview
  request could consume a one-time link).
- Website access is **optional** and used only to match a verification event to the site
  you're on (reduced immediately to a hostname — no browsing history is built).

See `docs/PRIVACY-DESIGN.md` and `docs/THREAT-MODEL.md`.

## Architecture

Local-first, no backend, no LLM. A background service worker owns OAuth, incremental Gmail
sync (`history.list`), MIME parsing, deterministic verification classification, code/link
extraction, domain matching, and the action lifecycle. Secrets are rendered only inside an
**extension-origin iframe** the host page cannot read. See the spec
`verification-assistant-plan.md` (§5, §6) for the full design.

## Prerequisites

- Node.js 22+ (developed on 24)
- pnpm 11+

## Commands

```bash
pnpm install      # install deps (runs `wxt prepare`)
pnpm dev          # run the extension in dev mode (Chrome)
pnpm typecheck    # wxt prepare + tsc --noEmit
pnpm test         # Vitest unit/integration suite
pnpm build        # production build → .output/chrome-mv3
pnpm zip          # packaged zip → .output/latch-<version>-chrome.zip
pnpm lint         # Biome
```

## Load the unpacked extension

1. `pnpm build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `.output/chrome-mv3`.
4. The dev build uses a fixed manifest key, so the extension ID is stable:
   **`gnmhkieamdmhjddhjgpkledmcgbejfec`**.

For live Gmail you also need a Google OAuth client bound to that ID — see
`docs/GOOGLE-OAUTH-SETUP.md` (added in the OAuth setup step). Until then, use the in-extension
developer harness to inject fake actions and exercise the overlay/permission flow.

## Project structure

```
entrypoints/   background, popup, options, overlay (extension page),
               overlay-inject (host wrapper), offscreen
src/
  auth/        Google OAuth via chrome.identity
  gmail/       REST client, incremental sync, MIME parsing, headers
  verification/classifier, code/link extraction, scoring, expiration
  matching/    registrable-domain + service/site matching
  actions/     active-action store, router, cleanup
  browser/     permissions, active tab, overlay injection, clipboard, badges
  messaging/   typed protocol + client
  storage/     zod schemas + local/session wrappers
  security/    url policy, redaction, hashing
  ui/          overlay React cards
tests/         unit / integration / e2e, fixtures
docs/          privacy, OAuth setup, threat model, store, testing
```

## Troubleshooting

- **`pnpm build`/`pnpm test` fail with `ERR_PNPM_IGNORED_BUILDS`:** run
  `pnpm approve-builds --all` once (approves esbuild + biome native binaries).
- **Overlay doesn't appear on a site:** confirm the site-access mode grants that origin
  (popup → Site access), and that a matching action is active.

## Security

Latch handles authentication material (OTPs, verification links). The design keeps it inside
the extension and off the network — see [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) and
[`docs/PRIVACY-DESIGN.md`](docs/PRIVACY-DESIGN.md). To report a vulnerability, follow
[`SECURITY.md`](SECURITY.md) — please don't open a public issue with a working exploit.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, tests, and the
PR checklist. All code runs through `pnpm typecheck`, `pnpm test`, and `pnpm lint` in CI.

## License

[MIT](LICENSE) © Manan Santoki.

Latch is an independent project and is not affiliated with or endorsed by Google. "Gmail" is a
trademark of Google LLC.
