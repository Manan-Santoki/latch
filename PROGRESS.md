# Progress

## Current phase
M1 — parallel pure-logic + UI modules (security/MIME, classifier/extractors, matching, overlay UI).

## Completed
- [x] **M0 Foundation** — WXT + React + TS scaffold; product name **Latch**.
  - Manifest (§27): permissions identity/storage/alarms/scripting/offscreen/activeTab;
    host `https://gmail.googleapis.com/*`; optional `https://*/*` + `clipboardWrite`;
    `gmail.readonly` oauth2 (placeholder client id, wired in M3); stable manifest key.
  - **Extension ID (dev, fixed): `gnmhkieamdmhjddhjgpkledmcgbejfec`** — used for OAuth in M3.
  - Shared contracts: verification action model + pipeline types (§15), Gmail/ParsedEmail
    types (§10), matching CurrentSite + registrable-domain helpers (§14), typed+validated
    message protocol (§24), zod storage schemas + local/session wrappers (§6.2), central
    redaction utility (§32), constants, time helpers.
  - Toolchain: Vitest 5 (WxtVitest fake browser), Biome, Playwright. install/typecheck/
    test(6 pass)/build/zip all green. Committed.

## In progress
- [ ] M1 module: security URL policy + Gmail MIME parsing (§6.4, §10, §25)
- [ ] M1 module: verification classifier + code/link extractors (§11–§13, §16)
- [ ] M1 module: domain/service matching (§14, §26)
- [ ] M1 module: overlay UI cards + extension overlay page (§3.2–§3.5, §17)

## Blocked
- None. (M3 Gmail OAuth requires a Google Cloud project + client ID — set up jointly with
  the user; not a blocker for M1/M2.)

## Verification
- `pnpm typecheck`: pass (M0 baseline)
- `pnpm test`: pass (6/6, M0 baseline)
- `pnpm build`: pass
- `pnpm zip`: pass

## Security checks
- No secret logging: central `redaction` util in place; enforced in review + M5 grep pass.
- No remote Gmail data transfer: no backend/network in any module (design constraint).
- Permission audit: manifest matches §27; deferred final audit to M5 (Phase 11).

## Next
1. Integrate M1 modules; build the secure iframe injection boundary + 3-mode site
   permission system + dev fake-action harness (M2 = first importable checkpoint).
2. Joint Google OAuth setup (M3), then Gmail incremental sync + background wiring (M4).
