# Contributing to Latch

Thanks for your interest in improving Latch! This is a local-first, privacy-focused Chrome
extension, so a few of the ground rules below are stricter than a typical project.

## Ground rules (please read)

Latch handles authentication material (OTP codes, verification/magic links) and Gmail
message content. The architecture is deliberately constrained — see
[`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) and the "Key architectural decisions" in
`verification-assistant-plan.md`. PRs that violate these will be asked to change:

- **No backend, no network calls** beyond the Gmail REST API. No analytics/telemetry.
- **No LLM / remote classifier / remote URL resolver.** Detection is deterministic and local.
- **Never log** a code, verification URL, token, message body, or full browsing URL. Route
  any diagnostic through `logger`/`scrub` in `src/security/redaction.ts`.
- **Secrets stay in `chrome.storage.session`** and are rendered only inside the
  extension-origin overlay iframe — never in host-page DOM, globals, or postMessage payloads.
- **Never fetch/HEAD/prefetch** a verification URL, and never auto-open or auto-submit.
- Compare hostnames by registrable domain (`src/matching/domain.ts`), never by substring.
- Request the **minimum** Chrome/Google permissions; website access stays optional.

## Development setup

Prerequisites: Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm dev        # launches Chrome with Latch loaded + hot reload
```

For live Gmail you need your own Google OAuth client — see
[`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md). Without it, use the popup's
**Developer** section to inject fake actions and exercise the overlay/permission flow.

## Before opening a PR

All of these must pass (CI runs them):

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

- Add or update tests for behavior changes. Detection/extraction changes need fixtures
  (`tests/fixtures/…`) and should keep false positives low (prefer missing an odd email over
  surfacing an invoice/order number as a code).
- Keep modules file-disjoint and typed; follow the existing structure in `src/`.
- Use `import type` for type-only imports (strict `verbatimModuleSyntax`).
- Do not commit `.env` or anything under `.keys/` (both are gitignored).

## Commit / PR style

- Conventional-ish messages are welcome (`fix(classify): …`, `feat(sync): …`).
- Describe the user-facing effect and any security/permission implications.
- Reference the relevant spec section (`§N` in `verification-assistant-plan.md`) when useful.

## Reporting bugs / ideas

Open an issue using the templates. For anything security-sensitive, use
[`SECURITY.md`](SECURITY.md) instead of a public issue.
