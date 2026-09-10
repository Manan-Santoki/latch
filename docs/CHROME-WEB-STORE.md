# Chrome Web Store & OAuth readiness

Latch is functional as an unpacked/dev extension today. Publishing to the Chrome Web Store
for a general audience requires the compliance work below (§34). None of it is needed to run
Latch yourself in Testing mode.

## Single purpose (use consistently everywhere)

> Help users complete email-based verification and sign-in by locally detecting recent Gmail
> verification codes or links and presenting them on the relevant website.

Use this same wording in the store listing, the OAuth consent screen, and the privacy policy.

## Store listing must disclose

- Gmail **read-only** access, and **why body access is required** (codes/links live in the
  body; metadata scopes can't provide them).
- Website access is **optional** and used only to place a matching verification action on the
  site you're on (reduced to a hostname; no browsing history).
- Processing is **local**; no mailbox contents are sent to a developer server.
- The narrow single purpose above.

Fill the privacy-practices form to justify **every** permission
(`identity`, `storage`, `alarms`, `scripting`, `offscreen`, `activeTab`, optional
`clipboardWrite`, optional `https://*/*`). Do not add permissions "for later."

## Google OAuth (restricted scope)

`gmail.readonly` is a **restricted** scope. For a public app you must complete Google's
restricted-scope verification, which needs: a production OAuth project + Chrome-Extension
client bound to the item id, a verified authorized domain, a public home page and privacy
policy, an accurate app name/logo, a demonstration video showing consent and the exact use of
Gmail data, and a written explanation (body access required; metadata insufficient; processing
local; no restricted data through a developer server). In **Testing** mode with yourself as a
test user, none of this is required.

## Manifest V3 notes

- No remotely-hosted executable code — everything is bundled (`pnpm build`).
- Review the generated `.output/chrome-mv3/manifest.json` before submitting.
- Package with `pnpm zip` → `.output/latch-<version>-chrome.zip`.

See also [`PRIVACY-DESIGN.md`](PRIVACY-DESIGN.md) and [`THREAT-MODEL.md`](THREAT-MODEL.md).
