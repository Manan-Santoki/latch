<!-- Thanks for contributing to Latch! -->

## What & why

<!-- What does this change and why? Link any issue. Note user-facing effects. -->

## Checklist

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` all pass
- [ ] Added/updated tests (and fixtures for detection/extraction changes)
- [ ] No secrets logged; diagnostics go through `redaction` (`logger`/`scrub`)
- [ ] No new backend/network/LLM; no broadened permissions (or clearly justified)
- [ ] Secrets stay in `chrome.storage.session` / the extension-origin overlay iframe
- [ ] Did not commit `.env` or anything under `.keys/`

## Security / permission impact

<!-- Any change to permissions, data handling, URL handling, or the overlay boundary? -->
