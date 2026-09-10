# Verification Assistant Chrome Extension
## Build-Ready Implementation Plan

**Working name:** Verification Assistant  
**Primary platform:** Google Chrome / Chromium, Manifest V3  
**Architecture:** Local-first browser extension; no application backend in v1  
**Primary email provider:** Gmail  
**Core actions:** Detect verification codes and verification/action links in newly received email, match them to the site the user is currently using, and surface a secure top-right overlay with explicit user actions.

---

# 1. Instructions for the implementation agent

Implement this project from this document as the source of truth.

Rules:

1. Build the project in the phases defined below, in order.
2. Keep the v1 architecture local-first. Do **not** add a backend, database, Firebase, Supabase, Redis, Cloud Pub/Sub, or telemetry service unless this document explicitly changes that requirement.
3. Gmail message bodies, OTPs, magic links, verification tokens, sender domains, and browsing URLs must not be transmitted to an application server.
4. Do not log OTPs, verification URLs, message bodies, OAuth access tokens, or full browsing URLs.
5. Do not automatically open verification links.
6. Do not automatically submit forms or click website verification buttons.
7. Automatic clipboard copy must be opt-in. Click-to-copy is the default.
8. Request the minimum Chrome and Google permissions required for implemented functionality.
9. Build security boundaries first. The web page itself must not receive Gmail data or the actual verification action payload.
10. Use fixtures and automated tests for extraction logic before relying on live Gmail.
11. Keep `PROGRESS.md` updated with completed phases, current blockers, and test status.
12. If a production credential is unavailable, implement against an environment/config placeholder and continue with everything that can be completed locally.

The target is a Chrome Web Store quality extension, not a proof-of-concept script.

---

# 2. Product definition

Verification Assistant reduces the friction between receiving an authentication/verification email and completing the action in the browser.

The extension connects to the user's Gmail account with explicit OAuth authorization, monitors newly added inbox messages, locally determines whether a message contains an authentication action, and surfaces the relevant action on the website where it is likely needed.

Supported v1 action classes:

- Numeric OTP / one-time codes
- Alphanumeric verification codes
- Email verification links
- Account confirmation links
- Account activation links
- Passwordless / magic sign-in links

Explicitly exclude from v1:

- Password reset automation
- Automatically opening links
- Automatically filling codes into forms
- Automatically pressing Verify, Continue, Submit, Sign in, or equivalent buttons
- SMS retrieval
- Outlook / Microsoft Graph
- Multiple Gmail accounts
- Server-side email processing
- Cloud synchronization of active codes or links
- AI/LLM-based email classification
- Browser history collection
- Full inbox search/indexing
- Advertising or monetization based on mailbox or browsing data

The single disclosed product purpose should remain narrow:

> Help users complete email-based verification and sign-in actions by locally detecting recent Gmail verification codes or links and presenting them on the relevant website.

That purpose should be used consistently in the product UI, privacy policy, OAuth verification materials, and Chrome Web Store listing.

---

# 3. Core user experience

## 3.1 Onboarding

First-run page:

1. Explain what the extension does.
2. Explain that Gmail access is read-only.
3. Explain that email processing occurs locally in the browser.
4. Explain that message bodies and verification tokens are not sent to the developer's servers.
5. Provide a deliberate **Connect Gmail** button.
6. Do not trigger an interactive OAuth prompt automatically on extension installation.
7. After Gmail is connected, ask how the extension may appear on websites.

Website access modes:

### Mode A: On click only
Default privacy-minimal mode.

- No permanent broad website permission.
- Incoming verification actions appear as an extension badge.
- The user opens the extension popup.
- `activeTab` temporary access can be used after the user interacts with the extension.
- The popup can show the action and optionally inject the overlay into the current tab after the user's click.

### Mode B: Selected sites
The user grants persistent access only to chosen origins.

Example:

- `https://github.com/*`
- `https://accounts.google.com/*`

The extension can automatically show matching overlays on those sites.

### Mode C: All HTTPS sites
The user explicitly grants optional access to `https://*/*`.

This enables the best automatic experience:

- Detect new verification email.
- Inspect only the current active tab's origin/domain.
- Match email action to that domain.
- Inject the top-right overlay automatically when confidence is high.

Never require HTTP access in production. Local development may separately support `http://localhost/*` through a development-only manifest configuration.

---

## 3.2 OTP experience

Example:

```text
┌──────────────────────────────────┐
│ GitHub                       ×   │
│                                  │
│ Verification code                │
│                                  │
│  824 193              [ Copy ]   │
│                                  │
│ Received 12 seconds ago          │
└──────────────────────────────────┘
```

Requirements:

- Top-right fixed overlay.
- Code readable at a glance.
- Default action is **Copy**.
- After copy, show a brief confirmation.
- Do not auto-copy unless the user enabled it.
- Dismiss button removes only the visible action from that tab.
- Expired/stale actions automatically disappear.
- Never claim a code expires at a particular time unless the email explicitly provides that information.
- Otherwise display relative receipt time such as `Received 40 seconds ago`.

---

## 3.3 Verification-link experience

Example:

```text
┌──────────────────────────────────┐
│ GitHub                       ×   │
│                                  │
│ Verify your email                │
│ github.com                       │
│                                  │
│      [ Open verification ]       │
│                                  │
│ Received 18 seconds ago          │
└──────────────────────────────────┘
```

Requirements:

- Display the destination hostname prominently.
- Do not render only an opaque label such as `Click here`.
- Opening a verification URL requires an explicit click.
- Default to opening the URL in a new tab so an in-progress form is not destroyed.
- Preserve the exact URL when opening it. Verification query parameters and fragments may be security-sensitive and case-sensitive.
- Do not pre-fetch, HEAD-request, resolve, or "test" a verification URL. A pre-request can consume a magic link or leak the token.
- Only `https:` links qualify for the normal one-click experience.

---

## 3.4 Email containing both code and link

Example:

```text
┌──────────────────────────────────┐
│ Discord                      ×   │
│                                  │
│ Verification code                │
│ 483 921              [ Copy ]    │
│                                  │
│ Or verify by email               │
│ discord.com                      │
│                     [ Open ]     │
└──────────────────────────────────┘
```

Represent this as one verification event with multiple actions rather than two unrelated notifications.

---

## 3.5 Suspicious or mismatched link

Example:

```text
┌──────────────────────────────────┐
│ Verification link            ×   │
│                                  │
│ Domain mismatch                  │
│ Email appears related to GitHub  │
│ Link: unrelated-example.net      │
│                                  │
│          [ View details ]        │
└──────────────────────────────────┘
```

Rules:

- Do not show the normal primary Open button for a high-risk mismatch.
- The top-right overlay may show a warning and a `View details` action.
- The popup can show the full hostname and sanitized URL details.
- If an "Open anyway" path is implemented, require an additional explicit confirmation.
- Never override this warning based only on sender display-name text.

---

# 4. Recommended technology stack

## Extension framework

**WXT + Manifest V3**

Reference version while this plan was written: WXT 0.21.x. Use the latest compatible release when implementation starts, but do not perform unrelated framework upgrades after the project is stable.

Why WXT:

- File-based extension entrypoints
- Manifest generation
- Manifest V3 support
- React integration
- Vite-based development
- Builds for Chrome/Chromium
- Simple packaging with `wxt zip`
- Good fit for popup, options page, service worker, content/injection scripts, and unlisted extension pages

Bootstrap:

```bash
pnpm dlx wxt@latest init verification-assistant
```

Choose:

- React
- TypeScript
- Chrome / Manifest V3 as the primary target

WXT 0.21 requires Node.js 22+ according to its current upgrade documentation. Use a current Node.js LTS and pnpm.

## UI

- React
- TypeScript
- Tailwind CSS or compact project-owned CSS tokens
- Radix primitives only if necessary; avoid pulling in a large component system for a small extension
- Lucide icons if icons are needed

The website overlay itself should be an **extension-hosted iframe UI**, not a React tree containing secrets directly inside the host page DOM.

## Validation and utilities

Recommended:

- `zod` for boundary validation of persisted state and Gmail-derived internal objects
- `tldts` for registrable-domain/eTLD+1 comparison
- Web Crypto API for local SHA-256 digests used in deduplication
- Native `URL` for security-sensitive URL parsing

Avoid an LLM, remote classifier, remote regex service, or remote link resolver.

## Testing

- Vitest for unit tests
- Testing Library for React components where appropriate
- Playwright with Chromium for end-to-end extension flows
- Static Gmail message fixtures for parsing/extraction tests

## Code quality

Use one formatter/linter stack consistently. Biome is acceptable, or ESLint + Prettier if generated by the chosen WXT template. Do not mix both without a reason.

---

# 5. High-level architecture

```text
                    ┌─────────────────────────┐
                    │      Google OAuth       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Gmail REST API     │
                    │ gmail.googleapis.com    │
                    └────────────┬────────────┘
                                 │
                                 │ read-only
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Chrome Extension / MV3                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Background Service Worker                             │  │
│  │                                                       │  │
│  │ Auth                                                  │  │
│  │ Gmail incremental sync                                │  │
│  │ MIME decoding                                         │  │
│  │ Verification classifier                              │  │
│  │ Code/link extraction                                  │  │
│  │ Domain matching                                       │  │
│  │ Action lifecycle                                      │  │
│  │ Permission management                                 │  │
│  └──────────────┬───────────────────────────┬────────────┘  │
│                 │                           │               │
│                 ▼                           ▼               │
│  ┌──────────────────────────┐   ┌────────────────────────┐  │
│  │ chrome.storage.session   │   │ chrome.storage.local   │  │
│  │                          │   │                        │  │
│  │ Active OTPs              │   │ Settings               │  │
│  │ Active verification URLs│   │ Gmail historyId        │  │
│  │ Short-lived metadata    │   │ Dedupe hashes          │  │
│  └──────────────────────────┘   └────────────────────────┘  │
│                 │                                           │
│                 ▼                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ On-demand website injector                            │  │
│  │ Creates extension-origin iframe only                  │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Extension-hosted overlay iframe                       │  │
│  │ Copy / Open / Dismiss                                 │  │
│  │ Host website cannot read iframe contents              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Popup               Options              Offscreen doc     │
│  account/status      preferences          DOM parsing /     │
│  active actions      permissions          optional clipboard│
└─────────────────────────────────────────────────────────────┘

                       NO APP BACKEND
```

---

# 6. Security architecture

This section is mandatory. Do not simplify it for convenience.

## 6.1 Keep secrets out of the host page

OTP codes and verification URLs are authentication information.

Do not inject them into:

- page HTML
- page JavaScript globals
- data attributes
- DOM text nodes owned by the website
- `window.postMessage` payloads
- query parameters visible to the host page
- console logs

Instead:

1. Programmatically inject only a small wrapper/iframe container.
2. Point the iframe at an extension-owned page such as `chrome-extension://<id>/overlay.html`.
3. The iframe asks the background service worker for the active action for its tab.
4. The background sends the secret only to the extension context.
5. The host page sees the iframe element but cannot read its extension-origin document due to same-origin policy.

Use an opaque action ID internally when necessary. Do not put OTPs or verification URLs in the iframe URL.

## 6.2 Storage rules

### `chrome.storage.session`

Use for:

- OTP code
- verification URL
- action type
- sender/service presentation metadata
- received timestamp
- inferred domain information needed while the action is active
- current action state

Session storage is in-memory for the browser session and is appropriate for sensitive temporary state. Keep its access level restricted to trusted extension contexts.

### `chrome.storage.local`

Use only for:

- user preferences
- site-access mode
- explicitly saved allow/deny site rules
- Gmail `historyId`
- Gmail account display email if needed for connection UI
- bounded deduplication hashes
- sanitized diagnostic timestamps/errors

Do not persist:

- raw email bodies
- OTPs
- full verification URLs
- magic-link tokens
- OAuth access tokens
- full browser URLs
- entire sender/message metadata history

### OAuth tokens

Let `chrome.identity` manage/cache the access token.

Never write OAuth access tokens to `storage.local`, logs, error reporting, or files.

## 6.3 No remote processing

For v1:

- No application API server
- No remote email parser
- No remote classifier
- No remote URL resolver
- No remote analytics containing domains or actions
- No Sentry breadcrumbs containing message or URL data
- No LLM

A static product/privacy website is allowed. It must not receive mailbox data.

## 6.4 URL safety

Use the native `URL` constructor.

Accepted normal-action scheme:

```text
https:
```

Reject normal one-click handling for:

```text
javascript:
data:
file:
blob:
chrome:
chrome-extension:
http:
```

Do not judge hostnames with substring checks.

This is wrong:

```ts
url.includes("github.com")
```

because values such as these can be deceptive:

```text
github.com.evil.example
github.com@evil.example
```

Instead:

```ts
const parsed = new URL(candidate);
const hostname = parsed.hostname;
```

Then compare registrable domains with `tldts`.

Display the canonical ASCII hostname. Be conservative with internationalized/punycode domains to reduce homograph confusion.

Never remove or rewrite query parameters before opening the user's verification URL.

## 6.5 Never pre-open a link

Do not use:

- `fetch(url)`
- `HEAD`
- hidden iframe loading
- link preview fetching
- server redirect resolution

on a verification URL.

Some verification/magic URLs are single-use. Accessing them may consume the action.

## 6.6 No automatic verification actions

The extension may:

- show an OTP
- copy an OTP
- show a link
- open a link after explicit user click

The extension must not:

- automatically navigate to the link
- automatically paste into a website form in v1
- automatically press a site's Verify/Continue button
- automatically complete account creation
- automatically reset a password

---

# 7. Chrome Manifest V3 permission strategy

Target the minimum practical set.

Proposed required permissions:

```json
[
  "identity",
  "storage",
  "alarms",
  "scripting",
  "offscreen",
  "activeTab"
]
```

Explanation:

- `identity`: Google OAuth token handling.
- `storage`: settings, incremental Gmail sync state, ephemeral active actions.
- `alarms`: Gmail polling and cleanup.
- `scripting`: inject only the secure overlay iframe wrapper when needed.
- `offscreen`: HTML parsing and optional clipboard support where a DOM context is required.
- `activeTab`: privacy-minimal interaction after a user explicitly clicks the extension.

Required API host:

```json
"host_permissions": [
  "https://gmail.googleapis.com/*"
]
```

Optional website access:

```json
"optional_host_permissions": [
  "https://*/*"
]
```

Optional clipboard permission:

```json
"optional_permissions": [
  "clipboardWrite"
]
```

Only request `clipboardWrite` if needed by the final implementation, and preferably when the user enables automatic copy. If normal click-to-copy works reliably from the trusted overlay context without it, do not request the permission merely for future use.

OAuth:

```json
"oauth2": {
  "client_id": "<GOOGLE_CHROME_EXTENSION_OAUTH_CLIENT_ID>",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.readonly"
  ]
}
```

Do not request:

- `gmail.modify`
- `mail.google.com`
- `tabs` unless a concrete implementation issue proves it necessary
- `history`
- `cookies`
- `webRequest`
- `declarativeNetRequest`
- clipboard read
- downloads
- notifications for the initial MVP

If a permission is added, document exactly which user-facing feature requires it.

---

# 8. Google OAuth and Gmail setup

## 8.1 Google Cloud project

Create a dedicated production Google Cloud project.

Enable:

- Gmail API

Configure Google Auth Platform:

- Application name
- Support email
- Developer contact
- Public home page
- Privacy policy
- Terms page if desired
- Authorized domain ownership

During development:

- Publishing status: Testing
- Add explicit test users

For production:

- External audience
- Restricted-scope verification as required by Google

## 8.2 Chrome Extension OAuth client

Create a Google OAuth client of application type:

**Chrome Extension**

It is tied to the extension Item ID.

Development must use a stable extension ID. Chrome's manifest `key` can be used during development to preserve the extension ID when needed. Do not commit any private signing key.

The OAuth client ID is public configuration, not a secret.

There is no client secret that can be safely hidden inside a browser extension.

## 8.3 Gmail scope

Use:

```text
https://www.googleapis.com/auth/gmail.readonly
```

This scope allows reading message bodies, which is required to extract codes and links.

Important product/compliance fact:

`gmail.readonly` is a **restricted Google OAuth scope**.

Therefore:

- Expect Google restricted-scope verification for a public consumer product.
- Keep the app's stated purpose narrow.
- Explain why body access is required and why metadata-only access is insufficient.
- Prepare a demonstration video showing OAuth consent and the exact use of the Gmail data.
- Maintain a public home page and privacy policy.
- Do not move restricted Gmail data through a server without deliberately revisiting Google's security-assessment requirements.

Development/testing use is exempt from production verification when kept in Google's Testing publishing state with test users, subject to Google's testing limitations.

---

# 9. Gmail synchronization design

Do not search the entire inbox every 30 seconds.

Use Gmail's incremental history synchronization.

## 9.1 Connection bootstrap

When the user clicks **Connect Gmail**:

1. Call `chrome.identity.getAuthToken({ interactive: true })`.
2. Call:
   `GET https://gmail.googleapis.com/gmail/v1/users/me/profile`
3. Store:
   - Gmail account email for connection UI
   - current `historyId`
4. Optionally scan only a narrow recent inbox window (for example the last 5 to 10 minutes) so a code received immediately before connection is not missed.
5. Start the polling alarm.

Do not make an interactive token request in a background alarm.

## 9.2 Poll interval

Chrome alarms have a production minimum interval of 30 seconds.

Use:

```text
Normal active polling: 30 seconds
Backoff polling: exponential after quota/network errors
```

A future optimization can use an adaptive cadence:

- 30 sec while Chrome is active / a verification action was recently seen
- 60–120 sec during idle periods

Do not implement aggressive timers that keep the MV3 worker artificially alive.

## 9.3 Incremental poll

For each poll:

1. Obtain token non-interactively:
   `chrome.identity.getAuthToken({ interactive: false })`
2. Load stored `historyId`.
3. Call Gmail:
   `users.history.list`
4. Request only message additions when possible:
   - `startHistoryId=<stored>`
   - `historyTypes=messageAdded`
   - optionally filter to `INBOX`
5. Collect unique newly added Gmail message IDs.
6. Fetch each new candidate with `messages.get?format=FULL`.
7. Reject stale messages before heavy processing.
8. Parse message locally.
9. Extract zero or more verification actions.
10. Route high-confidence matching actions to UI.
11. Only after the batch has been handled, persist the latest returned `historyId`.

`history.list` is materially cheaper than repeatedly listing/searching the mailbox.

## 9.4 Initial/recovery sync

If Gmail returns HTTP 404 because the stored `historyId` is no longer valid:

1. Perform a narrow recovery sync.
2. List only recent inbox messages.
3. Process only messages within the product's maximum relevant age.
4. Obtain a fresh history checkpoint.
5. Resume incremental polling.

Do not perform a permanent local mirror of the inbox.

## 9.5 Error handling

### HTTP 401
- Remove the invalid cached token with `chrome.identity.removeCachedAuthToken`.
- Retry a noninteractive token acquisition once.
- If interaction is required, set state `reauth_required`.
- Show this in the extension popup.
- Do not unexpectedly open OAuth UI from a background alarm.

### HTTP 403
Surface sanitized status such as:

```text
Gmail access unavailable. Reconnect your account.
```

Do not log response bodies if they could contain sensitive request context.

### HTTP 429 / 5xx
Use truncated exponential backoff with jitter.

### Offline
Keep the last `historyId`.
Resume later.
Do not mark Gmail disconnected merely because the network is unavailable.

---

# 10. Gmail message parsing

Use `messages.get` with `format=FULL`.

A Gmail message may be:

- `text/plain`
- `text/html`
- `multipart/alternative`
- `multipart/mixed`
- nested multipart structures

Implement a recursive MIME part walker.

Pseudo-interface:

```ts
type ParsedEmail = {
  messageId: string;
  internalDate: number;
  from: {
    raw: string;
    displayName?: string;
    address?: string;
    domain?: string;
  };
  subject: string;
  plainText: string;
  htmlText: string;
  links: ExtractedLink[];
};
```

## 10.1 Base64url decoding

Gmail message body data uses URL-safe base64.

Implement and test:

- `-` → `+`
- `_` → `/`
- correct padding
- UTF-8 decoding

Do not use ad-hoc code without tests.

## 10.2 HTML handling

Never render email HTML.

Use a trusted extension DOM context, preferably the offscreen document, with `DOMParser`.

After parsing:

- remove `script`
- remove `style`
- remove `template`
- ignore images
- ignore forms
- extract visible-ish text
- extract anchor `href`
- extract anchor text
- capture a bounded amount of surrounding text for classification

Do not execute email scripts.
Do not load remote email resources.

The parser should return plain structured data to the service worker.

## 10.3 Link model

```ts
type ExtractedLink = {
  href: string;
  anchorText: string;
  surroundingText: string;
  scheme?: string;
  hostname?: string;
  registrableDomain?: string;
  valid: boolean;
};
```

Keep the exact original valid href for the eventual user-directed open action.

Canonicalized URL data is only for comparison/display.

---

# 11. Verification classifier

Use deterministic local rules in v1.

Do not use an LLM.

The engine should answer two separate questions:

1. Does this message appear to be authentication/verification related?
2. Which candidate code/link is the most likely action?

This separation makes false-positive handling much easier.

## 11.1 Intent signals

Strong positive subject/body signals:

- verification code
- verify your email
- verify email address
- one-time code
- one-time password
- OTP
- security code
- sign-in code
- login code
- confirmation code
- confirm your email
- confirm account
- activate account
- magic link
- passwordless sign in
- use this code
- your code is

Common negative signals:

- invoice
- receipt
- order number
- tracking number
- shipment
- delivery
- statement
- transaction
- confirmation number when unrelated to authentication
- reservation
- ticket number

A six-digit number alone is not sufficient to classify a message as OTP mail.

## 11.2 Example message scoring

Starting heuristic:

```text
Subject:
+6 "verification code"
+6 "one-time code"
+5 "OTP"
+5 "sign-in code"
+5 "verify your email"
+5 "confirm your email"
+4 "security code"
+4 "confirmation code"
+4 "magic link"

Body:
+5 "your code is"
+5 "verification code:"
+4 "use this code"
+4 "expires in"
+3 "do not share this code"
+4 "verify email"
+4 "confirm email"
+4 "activate account"

Negative:
-6 "invoice"
-6 "tracking number"
-5 "receipt"
-5 "order number"
-4 "shipment"
-4 "reservation"
-3 currency-heavy commercial context
```

Tune values with fixtures. Do not treat these exact numbers as immutable.

Suggested minimum intent score:

```text
6
```

Require stronger evidence before automatic overlay display.

---

# 12. OTP/code extraction

Support in v1:

- 4-digit numeric
- 6-digit numeric
- 8-digit numeric
- spaced forms: `123 456`
- hyphenated forms: `123-456`
- common short alphanumeric verification codes

Examples:

```text
824193
824 193
824-193
AB12CD
G-123456
```

Candidate scoring should consider:

- distance from `code`, `OTP`, `verification`, `security`, `sign in`
- appearance in a dedicated line
- appearance in subject
- length
- amount of surrounding unrelated numeric content
- negative proximity to `$`, order, invoice, tracking, date/year terms

Normalize a copy value separately from display value.

Example:

```ts
{
  raw: "824 193",
  display: "824 193",
  copyValue: "824193"
}
```

Do not remove meaningful characters from alphanumeric codes.

---

# 13. Verification-link extraction

Extract candidate links from actual HTML `<a href>` values.

Plain-text URLs may be supported as a fallback.

## 13.1 Positive anchor/context signals

Example score:

```text
+7 verify email
+7 verify your email
+6 confirm email
+6 confirm your account
+5 activate account
+5 complete verification
+4 magic link
+4 sign in
+3 continue
```

## 13.2 Strong negative signals

```text
-12 unsubscribe
-10 manage preferences
-10 privacy policy
-10 terms of service
-8 view in browser
-8 social media link
-8 help center
-8 marketing/campaign CTA without verification context
```

Exclude:

- `mailto:`
- `tel:`
- `javascript:`
- `data:`
- image/pixel URLs
- tracking resources that are not anchors
- unsubscribe links

## 13.3 Do not resolve redirectors

Do not automatically follow SendGrid, Mailgun, Customer.io, AWS, SafeLinks, or other redirects merely to discover their destination.

A redirect can be legitimate, but it can also hide a malicious target or consume a one-time action.

For v1:

- Show the actual hostname present in the email URL.
- Use sender/current-site evidence for confidence.
- Treat unexplained cross-domain redirectors conservatively.
- Add first-party alias mappings only when backed by tests and explicit maintained configuration.

---

# 14. Domain/service matching

The overlay should appear automatically only when the verification event is highly likely to belong to the current site.

Never store the current page's full URL.

Reduce immediately to:

```ts
type CurrentSite = {
  origin: string;
  hostname: string;
  registrableDomain: string | null;
};
```

After comparison, avoid retaining `origin` unless needed for the explicit site-permission rule.

## 14.1 Evidence

Strong signals:

```text
+6 verification-link registrable domain == current-site registrable domain
+5 sender registrable domain == current-site registrable domain
+5 sender registrable domain == verification-link registrable domain
+3 service/brand token strongly matches current site's domain
+2 subject names the current service
```

Negative signals:

```text
-6 link domain conflicts with current site and sender
-5 sender domain conflicts with current site and no other evidence exists
-4 generic unrelated marketing domain
-3 IP-literal destination
-2 punycode hostname requiring caution
```

## 14.2 Automatic-overlay threshold

Recommended:

- Message verification intent must pass classification threshold.
- Extracted action must pass its own confidence threshold.
- Site match must contain at least one strong domain/service signal.
- Overall confidence should be high, e.g. >= 9 after tuning.

If confidence is medium:

- show extension action badge
- show event in popup
- do not automatically inject the overlay

If confidence is low:

- suppress it unless the user deliberately opens a diagnostics/debug view during development.

---

# 15. Internal action model

Use a single representation for codes and URLs.

```ts
type VerificationActionType =
  | "otp_code"
  | "verification_link"
  | "account_confirmation"
  | "account_activation"
  | "magic_sign_in";

type VerificationAction = {
  id: string;
  messageDigest: string;

  type: VerificationActionType;

  service?: string;
  senderDisplay?: string;
  senderDomain?: string;

  receivedAt: number;
  detectedAt: number;

  code?: {
    display: string;
    copyValue: string;
  };

  link?: {
    exactUrl: string;
    hostname: string;
    registrableDomain?: string;
  };

  explicitExpiryAt?: number;
  localHideAfter: number;

  confidence: {
    intent: number;
    action: number;
    siteMatch?: number;
    total: number;
  };

  risk: {
    level: "normal" | "caution" | "blocked";
    reasons: string[];
  };

  state:
    | "detected"
    | "shown"
    | "copied"
    | "opened"
    | "dismissed"
    | "expired";
};
```

Secrets inside this object belong only in `chrome.storage.session`.

---

# 16. Action lifecycle and expiration

Default local surfacing lifetime:

```text
15 minutes
```

This is not a claim about actual OTP validity. It is only how long the extension considers the event relevant.

If the email explicitly states a machine-parseable expiration such as:

```text
This code expires in 10 minutes.
```

the extension may record:

```ts
explicitExpiryAt
```

Do not attempt overly clever natural-language expiry parsing in v1.

Cleanup triggers:

- periodic cleanup alarm
- new action creation
- popup open
- browser startup
- successful copy/open if configured
- explicit dismiss

After expiration:

- remove secret from `storage.session`
- remove related overlay
- clear related badge if nothing remains

---

# 17. Secure website overlay implementation

## 17.1 Do not put the secret directly in host DOM

Use this design:

```text
Host page
  │
  └── injected wrapper
        │
        └── <iframe src="chrome-extension://.../overlay.html">
               │
               └── extension-origin React UI
                     │
                     └── asks background for action by tab context
```

Host wrapper contains no secret.

Suggested iframe characteristics:

```text
position: fixed
top: 16px
right: 16px
width: 360px
max-width: calc(100vw - 32px)
border: 0
background: transparent
z-index: 2147483647
```

Mobile/narrow browser window:

```text
left: 12px
right: 12px
width: auto
```

The iframe document should size itself through a controlled message containing only dimensions, never secret payloads.

## 17.2 Visual design

Target:

- sleek
- compact
- modern
- unobtrusive
- clear hierarchy
- no giant modal
- no full-screen takeover

Use:

- 12–16 px corner radius
- subtle shadow
- solid readable background
- service favicon only if obtained safely; otherwise use a generic shield/key icon
- light/dark appearance based on extension preference or `prefers-color-scheme`
- concise transitions under ~200 ms
- no bouncing/attention-grabbing animations

Accessibility:

- WCAG-friendly contrast
- keyboard-focusable buttons
- visible focus states
- `aria-label` for icon buttons
- Escape dismisses the overlay
- no keyboard trap
- readable at 200% zoom

---

# 18. Overlay injection

Use `chrome.scripting.executeScript` only when needed.

The injected script should:

1. Check whether the overlay host already exists.
2. If not, append one container.
3. Create the extension-hosted iframe.
4. Never receive the OTP/link value itself.
5. Listen only for lifecycle events such as:
   - show
   - hide
   - resize
6. Remove itself cleanly when the extension asks.

When the active action changes, update the extension iframe through extension messaging, not through host-page events containing secrets.

---

# 19. Clipboard behavior

## Default: click to copy

User clicks:

```text
Copy
```

The trusted overlay asks the background to copy the action identified by an opaque action ID.

The background retrieves the code from session storage.

Preferred order:

1. If clipboard writing works directly from the trusted extension UI under user gesture, use it.
2. If the chosen implementation requires a DOM offscreen context, use `chrome.offscreen` with reason `CLIPBOARD`.
3. Request `clipboardWrite` only when required.

Do not send the code through website-facing messaging.

## Optional automatic copy

Setting:

```text
Automatically copy new matching OTPs
```

Default:

```text
OFF
```

Enabling it must:

- explain that it can replace current clipboard content
- request any needed optional clipboard permission at that moment
- apply only to high-confidence code actions that match the active site
- never auto-copy links
- never read the existing clipboard

---

# 20. Opening verification URLs

When the user clicks Open:

1. Overlay sends `OPEN_ACTION` with action ID.
2. Background retrieves exact URL from trusted session storage.
3. Background validates it again immediately before opening.
4. Require `https:`.
5. Check the risk state.
6. Open in a new tab.

Pseudo-interface:

```ts
type OpenActionRequest = {
  actionId: string;
};
```

Do not send:

```ts
{ url: "..." }
```

from host-facing code if it can be avoided.

The background is the source of truth for the URL.

---

# 21. Extension popup

The browser-toolbar popup is both fallback UI and settings entry point.

Sections:

## Connection

```text
Gmail
Connected as user@example.com
[ Disconnect ]
```

or:

```text
Gmail
Not connected
[ Connect Gmail ]
```

## Current verification action

If one exists:

```text
GitHub
Verification code
824 193
[ Copy ]

github.com
[ Open verification ]
```

Only active session actions appear. Do not build a permanent code history.

## Website access

Show current mode:

```text
Site access
On click only
Selected sites
All HTTPS sites
```

Provide a button to request the relevant optional permission through a user gesture.

## Status

Sanitized operational data only:

```text
Last Gmail check: 12 seconds ago
Status: Connected
```

Never expose Gmail API internals to ordinary users unless an error needs action.

---

# 22. Options/settings page

Settings:

### Gmail
- account
- reconnect
- disconnect

### Behavior
- overlay enabled
- click-to-copy
- auto-copy toggle (default off)
- automatically show high-confidence link cards
- local action hide timeout: 5 / 10 / 15 / 30 minutes

### Website permissions
- on-click only
- selected sites
- all HTTPS sites
- list/remove explicitly granted sites

### Appearance
- system
- light
- dark

### Privacy
Show concise factual statements:

- Gmail is accessed read-only.
- Messages are processed locally.
- Active codes and verification URLs are kept only temporarily.
- Verification links never open automatically.
- No mailbox contents are sent to the developer's server.

### Diagnostics
Only sanitized fields:

- OAuth status
- last successful sync timestamp
- last error class/code
- stored history checkpoint exists: yes/no
- polling alarm state
- number of active actions
- site permission mode

No code, message subject, link, sender, or current browsing URL in diagnostics.

---

# 23. Suggested project structure

```text
verification-assistant/
├─ entrypoints/
│  ├─ background/
│  │  └─ index.ts
│  │
│  ├─ popup/
│  │  ├─ index.html
│  │  ├─ main.tsx
│  │  └─ style.css
│  │
│  ├─ options/
│  │  ├─ index.html
│  │  ├─ main.tsx
│  │  └─ style.css
│  │
│  ├─ overlay/
│  │  ├─ index.html              # unlisted extension page
│  │  ├─ main.tsx
│  │  └─ style.css
│  │
│  ├─ overlay-inject.ts          # unlisted injected wrapper script
│  │
│  └─ offscreen/
│     ├─ index.html              # unlisted extension page
│     └─ main.ts
│
├─ src/
│  ├─ auth/
│  │  ├─ google-auth.ts
│  │  └─ auth-errors.ts
│  │
│  ├─ gmail/
│  │  ├─ client.ts
│  │  ├─ sync-engine.ts
│  │  ├─ mime.ts
│  │  ├─ headers.ts
│  │  └─ types.ts
│  │
│  ├─ verification/
│  │  ├─ classify-message.ts
│  │  ├─ extract-code.ts
│  │  ├─ extract-links.ts
│  │  ├─ score-link.ts
│  │  ├─ expiration.ts
│  │  └─ types.ts
│  │
│  ├─ matching/
│  │  ├─ domain.ts
│  │  ├─ service.ts
│  │  ├─ score-site-match.ts
│  │  └─ aliases.ts
│  │
│  ├─ actions/
│  │  ├─ action-store.ts
│  │  ├─ action-router.ts
│  │  └─ cleanup.ts
│  │
│  ├─ browser/
│  │  ├─ permissions.ts
│  │  ├─ active-tab.ts
│  │  ├─ overlay.ts
│  │  ├─ clipboard.ts
│  │  └─ badges.ts
│  │
│  ├─ messaging/
│  │  ├─ protocol.ts
│  │  └─ handlers.ts
│  │
│  ├─ storage/
│  │  ├─ local.ts
│  │  ├─ session.ts
│  │  └─ schemas.ts
│  │
│  ├─ security/
│  │  ├─ url-policy.ts
│  │  ├─ redaction.ts
│  │  └─ hashing.ts
│  │
│  ├─ ui/
│  │  ├─ VerificationCard.tsx
│  │  ├─ CodeAction.tsx
│  │  ├─ LinkAction.tsx
│  │  ├─ RiskWarning.tsx
│  │  └─ primitives/
│  │
│  └─ shared/
│     ├─ constants.ts
│     └─ time.ts
│
├─ tests/
│  ├─ fixtures/
│  │  ├─ otp/
│  │  ├─ links/
│  │  ├─ multipart/
│  │  ├─ negative/
│  │  └─ malicious/
│  │
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
│
├─ public/
│  └─ icons/
│
├─ docs/
│  ├─ PRIVACY-DESIGN.md
│  ├─ GOOGLE-OAUTH-SETUP.md
│  ├─ CHROME-WEB-STORE.md
│  ├─ THREAT-MODEL.md
│  └─ TESTING.md
│
├─ .env.example
├─ package.json
├─ tsconfig.json
├─ wxt.config.ts
├─ README.md
├─ PROGRESS.md
└─ plan.md
```

Adapt WXT's exact entrypoint naming rules as necessary while preserving the architectural boundaries above.

---

# 24. Messaging protocol

Create an explicit typed message protocol.

Examples:

```ts
type ExtensionMessage =
  | { type: "GET_CONNECTION_STATUS" }
  | { type: "CONNECT_GMAIL" }
  | { type: "DISCONNECT_GMAIL" }
  | { type: "GET_ACTIVE_ACTION"; tabId?: number }
  | { type: "COPY_ACTION"; actionId: string }
  | { type: "OPEN_ACTION"; actionId: string }
  | { type: "DISMISS_ACTION"; actionId: string }
  | { type: "REQUEST_SITE_PERMISSION"; origin: string }
  | { type: "SET_SITE_MODE"; mode: SiteAccessMode };
```

Validate messages.

Do not create a generic message like:

```ts
{ type: string, payload: any }
```

Do not permit arbitrary URLs or code strings from an injected page to become privileged actions.

---

# 25. Deduplication

New Gmail history records can repeat or a sync may be retried.

Generate a local digest:

```text
SHA-256(account identifier + Gmail message ID)
```

Store only a bounded set of digest values, for example the last 24 hours or last 200 messages.

The digest is used only to avoid redisplaying the same email event.

Do not hash OTP/link content for long-term analytics.

---

# 26. Privacy-preserving current-site matching

The extension needs current-site information only for the user-facing matching feature.

Rules:

- Read only the active tab when attempting an automatic match.
- Reduce URL to hostname/registrable domain immediately.
- Never retain query strings, paths, fragments, page text, or form contents.
- Do not build browsing history.
- Do not transmit browsing domains remotely.
- Make this use explicit in the Web Store disclosure because website access/browsing activity is sensitive under Chrome policy.

---

# 27. Manifest sketch

The exact generated manifest will be produced by WXT, but the intended logical shape is:

```json
{
  "manifest_version": 3,
  "name": "Verification Assistant",
  "version": "0.1.0",
  "description": "Surface recent Gmail verification codes and links on the site where you need them.",

  "minimum_chrome_version": "116",

  "permissions": [
    "identity",
    "storage",
    "alarms",
    "scripting",
    "offscreen",
    "activeTab"
  ],

  "optional_permissions": [
    "clipboardWrite"
  ],

  "host_permissions": [
    "https://gmail.googleapis.com/*"
  ],

  "optional_host_permissions": [
    "https://*/*"
  ],

  "oauth2": {
    "client_id": "<GOOGLE_EXTENSION_CLIENT_ID>",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html"
  },

  "web_accessible_resources": [
    {
      "resources": [
        "overlay.html"
      ],
      "matches": [
        "https://*/*"
      ]
    }
  ]
}
```

Verify the final generated manifest against current Chrome/WXT documentation before release.

---

# 28. Background service worker responsibilities

The service worker is the trusted coordinator.

It owns:

- OAuth calls
- Gmail HTTP requests
- polling lifecycle
- incremental history state
- active-action state
- action matching
- current tab selection
- site permission checks
- overlay injection commands
- privileged copy/open operations
- badge state
- cleanup

It must be event-driven.

Do not rely on long-lived in-memory JavaScript variables because MV3 service workers can terminate when idle.

Persist required non-secret checkpoints and preferences.
Use session storage for active secrets.

On startup:

1. validate stored settings
2. ensure required alarms exist
3. clean expired actions
4. process any appropriate pending state
5. do not invoke interactive OAuth

---

# 29. Offscreen document responsibilities

Use the offscreen document only when a DOM API is actually needed.

Valid project use cases:

### `DOM_PARSER`
Parse email HTML with `DOMParser`, extracting text and links without rendering it.

### `CLIPBOARD`
Perform clipboard writing if it cannot be done reliably from the user-gesture overlay context.

Do not leave an offscreen document open indefinitely without reason.

Use `chrome.runtime.getContexts()` where supported to determine whether the document already exists before creating another one.

---

# 30. Gmail quota-conscious behavior

Current Gmail API quotas assign different quota costs per method. `history.list` is cheaper than `messages.get`, so the design should:

- poll history
- fetch full messages only when the history says a new message was added
- fetch each candidate once
- avoid repeatedly retrieving old emails
- avoid downloading attachments
- avoid threads unless needed
- apply backoff on rate-limit responses

The extension should not request Gmail attachments in v1.

---

# 31. Testing strategy

Do not make Gmail live testing the first test layer.

## 31.1 Unit tests: code extraction

Fixtures:

Positive:

- `Your verification code is 824193`
- `Code: 824 193`
- `Use 824-193 to sign in`
- `Your code is AB12CD`
- code in subject
- multiple irrelevant numbers plus one contextually correct OTP

Negative:

- order number
- invoice number
- tracking number
- price
- year
- phone number
- reservation confirmation

Assertions:

- expected candidate
- normalized copy value
- confidence
- no false action

## 31.2 Unit tests: links

Positive:

- Verify email
- Confirm account
- Activate account
- Magic sign-in link

Negative:

- unsubscribe
- terms
- privacy
- marketing CTA
- social link
- view in browser

Security:

- `javascript:`
- `data:`
- HTTP
- `https://github.com.evil.example`
- `https://github.com@evil.example`
- IP hosts
- punycode host
- malformed URL

## 31.3 MIME tests

- plain text only
- HTML only
- multipart/alternative
- multipart/mixed
- nested multipart
- empty part
- malformed/missing body
- duplicate HTML/plain content
- Unicode subject/body

## 31.4 Domain tests

Examples:

```text
github.com == github.com
accounts.github.com -> github.com
mail.github.com -> github.com
github.com.evil.example != github.com
```

Include public-suffix edge cases.

## 31.5 Gmail sync tests

Mock Gmail responses:

- initial profile
- no new history
- one `messageAdded`
- multiple messages
- duplicate message IDs
- 401
- 404 stale history ID
- 429
- 500
- pagination

Assert history checkpoint behavior carefully.

## 31.6 UI tests

- code card
- link card
- both actions
- caution state
- copied state
- dark mode
- narrow window
- keyboard interaction
- Escape
- focus order

## 31.7 End-to-end browser tests

Use a controlled local HTTPS/fixture domain or test server.

Test:

1. Install unpacked extension.
2. Inject fake active action without Gmail.
3. Grant site permission.
4. Navigate to matching test site.
5. Verify top-right iframe.
6. Ensure host page JavaScript cannot read the OTP/link from iframe DOM.
7. Copy code.
8. Open a fixture verification URL.
9. Dismiss.
10. Revoke site permission and verify automatic injection stops.

Live Gmail OAuth should be a separate manual/integration test.

---

# 32. Threat model

Create `docs/THREAT-MODEL.md`.

At minimum include:

## Threat: malicious current website reads OTP
Mitigation:
- extension-origin iframe
- no secret in wrapper DOM
- no `window.postMessage` secret
- storage.session trusted access

## Threat: phishing email contains misleading link
Mitigation:
- native URL parsing
- visible hostname
- domain comparison
- HTTPS requirement
- mismatch warning
- no automatic navigation

## Threat: verification link consumed by preview
Mitigation:
- never fetch/resolve links before explicit user click

## Threat: extension logs secrets
Mitigation:
- centralized redaction utility
- lint/code-review rule
- tests that sanitized diagnostics contain no code/URL

## Threat: compromised backend
Mitigation:
- v1 has no mailbox-data backend

## Threat: extension update compromise
Mitigation:
- no remote executable code
- dependency pinning/lockfile
- protected publisher account with strong 2FA
- minimal dependencies
- review production bundle

## Threat: page spoofs extension overlay
Mitigation:
- consistent extension branding
- optional visible extension icon indicator
- do not claim the overlay is impossible to imitate
- user can verify action from toolbar popup

## Threat: stale OTP shown
Mitigation:
- narrow message-age window
- local TTL
- relative receipt timestamp

---

# 33. Privacy policy requirements

Before public release, provide a real privacy policy.

It should accurately state:

- what Gmail data is accessed
- why Gmail body access is necessary
- that Gmail access is read-only
- that processing occurs locally
- what local state is persisted
- temporary handling of OTPs and verification URLs
- website-domain access used only for action matching
- whether any analytics exist
- retention/deletion behavior
- how disconnect works
- Google API Services User Data Policy / Limited Use compliance language
- Chrome Web Store User Data Policy / Limited Use compliance

Do not claim "we collect nothing" if the extension technically handles Gmail messages or browsing-domain information. Be precise: the product **accesses/processes** those data locally even if the developer does not receive them.

---

# 34. Google and Chrome compliance plan

## Google OAuth

Before public OAuth verification:

- production OAuth project
- production Chrome extension client ID
- correct extension Item ID
- verified authorized domain
- public homepage
- public privacy policy
- accurate OAuth app name/logo
- `gmail.readonly` declared
- demonstration video
- written explanation:
  - body access required to identify verification codes and action links
  - metadata-only scope cannot provide message body contents
  - processing is local
  - no restricted data travels through the developer's server

## Chrome Web Store

Store listing must prominently disclose:

- Gmail read-only access
- website access used to place verification actions on matching sites
- local processing
- narrow single purpose

Privacy-practices form must accurately justify every permission.

Do not add permissions "for later."

Manifest V3 prohibits remotely hosted executable code. Bundle all extension code with the extension.

---

# 35. Implementation phases

## Phase 0: Repository and guardrails

Tasks:

- Bootstrap WXT React TypeScript project.
- Add pnpm lockfile.
- Configure formatter/linter.
- Configure Vitest.
- Add `README.md`.
- Add `PROGRESS.md`.
- Add `docs/THREAT-MODEL.md`.
- Add `.env.example`.
- Add no-secret logging/redaction utility.
- Add build/typecheck/test scripts.

Acceptance criteria:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm zip
```

all succeed.

No Gmail integration yet.

---

## Phase 1: UI prototype with fake data

Build:

- popup
- options page
- extension overlay page
- code card
- link card
- combined card
- caution card
- copied state

Inject fake fixture actions through a development-only mechanism.

Acceptance criteria:

- overlay is polished and responsive
- dark/light works
- keyboard works
- secret is rendered inside extension iframe rather than host DOM
- host page cannot query the iframe's OTP text

Do not start Gmail OAuth until this boundary works.

---

## Phase 2: Site-permission system

Implement:

- on-click mode
- selected-site mode
- all-HTTPS mode
- optional host permission request from user gesture
- permission revocation detection
- on-demand iframe injection
- overlay removal

Acceptance criteria:

- no automatic overlay on an ungranted site
- granted site works
- revocation stops it
- on-click fallback works with `activeTab`

---

## Phase 3: Google OAuth

Implement:

- `Connect Gmail`
- `getAuthToken({interactive:true})`
- noninteractive token retrieval
- account/profile fetch
- disconnect
- reauth-required state
- no token persistence

Acceptance criteria:

- test account connects
- account email shown
- browser restart does not corrupt state
- disconnect stops polling and removes Gmail-related state
- an expired/invalid token does not trigger surprise background UI

---

## Phase 4: Gmail incremental synchronization

Implement:

- `users.getProfile`
- initial checkpoint
- 30-second alarm
- `history.list`
- new message ID extraction
- pagination
- stale-history recovery
- exponential backoff
- sanitized status

Acceptance criteria:

- no-op poll does not fetch messages
- one new Gmail message causes one candidate fetch
- history checkpoint advances correctly
- 404 recovery works
- 429 backoff works

---

## Phase 5: MIME parser

Implement:

- recursive Gmail payload walk
- base64url decoder
- headers
- plain text
- HTML
- offscreen DOMParser
- anchor extraction
- HTML text extraction
- no remote resource loading

Acceptance criteria:

- fixture suite passes
- scripts are never executed
- email HTML is never rendered

---

## Phase 6: Verification intent classifier

Implement deterministic classification.

Acceptance criteria:

- strong OTP/verification fixtures detected
- commercial numeric emails rejected
- scores exposed only in developer diagnostics/tests
- classifier has a documented threshold

Target false positives as the higher-cost error. It is better to miss an unusual verification email than to display random invoice/order numbers as authentication codes.

---

## Phase 7: Code and link extractors

Implement:

- numeric code candidates
- spaced/hyphenated codes
- alphanumeric candidates
- verification-link candidates
- negative-link filtering
- exact URL preservation
- risk evaluation

Acceptance criteria:

- fixture matrix passes
- malicious schemes blocked
- verification token URL never fetched

---

## Phase 8: Site/action matching

Implement:

- current active tab origin/domain access only when permitted
- `tldts` registrable-domain comparison
- sender/link/current-site scoring
- high/medium/low confidence routing

Acceptance criteria:

- GitHub email + GitHub tab auto-overlays
- GitHub email + unrelated tab does not auto-overlay
- medium event produces badge/popup fallback
- mismatch warning works

---

## Phase 9: Privileged actions

Implement:

### Copy
- by action ID
- optional clipboard permission only if needed
- no clipboard read

### Open
- by action ID
- validate again
- `https:` only for normal flow
- new tab
- no prefetch

### Dismiss
- state update
- remove overlay

Acceptance criteria:

- host page cannot choose an arbitrary privileged URL
- copy works
- opening requires click
- auto-copy remains off by default

---

## Phase 10: Lifecycle, cleanup, resilience

Implement:

- action TTL
- cleanup alarm
- startup cleanup
- deduplication digest
- service-worker restart resilience
- browser offline behavior
- multiple actions received close together

UI rule for multiple events:

- prioritize the highest-confidence action matching the active domain
- do not stack five overlays
- popup may list a small number of currently active events

Acceptance criteria:

- stale actions disappear
- duplicate email is not repeatedly shown
- restart does not corrupt history checkpoint

---

## Phase 11: Security hardening

Perform:

- dependency audit
- permission audit
- manifest audit
- search repository for accidental `console.log` of sensitive objects
- search for raw URL/code persistence
- test hostile fixture page
- test CSP-heavy page
- test page that manipulates z-index/iframes
- validate no remote code
- confirm web-accessible resources are minimal

Create release threat-model signoff.

---

## Phase 12: Store/OAuth production readiness

Prepare:

- icons
- screenshots
- Chrome Web Store listing
- home page
- privacy policy
- Google OAuth verification materials
- demo video
- scope justification
- permission justifications
- production zip

Do not add a backend merely for the store website. A static site is enough for product documentation/privacy pages.

---

# 36. Example Gmail sync pseudocode

```ts
async function pollGmail(): Promise<void> {
  const state = await getGmailSyncState();
  if (!state.connected || !state.historyId) return;

  const token = await getTokenNonInteractive();
  if (!token) {
    await setReauthRequired();
    return;
  }

  try {
    const result = await listHistory({
      token,
      startHistoryId: state.historyId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    const ids = uniqueMessageIds(result.messagesAdded);

    for (const messageId of ids) {
      if (await wasProcessed(messageId)) continue;

      const message = await getMessageFull(token, messageId);

      if (isTooOld(message.internalDate)) {
        await markProcessed(messageId);
        continue;
      }

      const parsed = await parseGmailMessage(message);
      const event = detectVerificationEvent(parsed);

      if (event) {
        await routeVerificationEvent(event);
      }

      await markProcessed(messageId);
    }

    await saveHistoryId(result.historyId);
    await recordSuccessfulPoll();
  } catch (error) {
    await handleGmailError(error);
  }
}
```

Production implementation must correctly handle pagination before finalizing the new history checkpoint.

---

# 37. Example action-routing pseudocode

```ts
async function routeVerificationEvent(event: VerificationAction) {
  await activeActionStore.put(event);

  const tab = await getActiveTabForCurrentWindow();

  if (!tab?.id) {
    await updateBadge();
    return;
  }

  const site = await getPermittedSiteIdentity(tab);

  if (!site) {
    await updateBadge();
    return;
  }

  const match = scoreSiteMatch(event, site);

  if (match.risk === "blocked") {
    await updateBadge();
    return;
  }

  if (match.level === "high") {
    await injectOverlayFrame(tab.id);
    await showActionInOverlay(tab.id, event.id);
    return;
  }

  await updateBadge();
}
```

Never pass `event.code.copyValue` or `event.link.exactUrl` to the injected wrapper script.

---

# 38. UX edge cases

Handle deliberately:

### Two codes from the same service
Prefer the newest.
Keep the older only if it remains an active separate event in popup.

### Code email arrives while user is on another site
Badge only.
When they navigate to a matching granted site within the active TTL, the extension may surface it.

### Verification link clicked
Optionally mark as opened and hide after a brief success state.
Do not claim verification succeeded unless the target site communicates that independently.

### User copies code
Keep card visible briefly in case they need to recopy.
Do not auto-dismiss instantly unless user preference says so.

### Site permission revoked
Immediately stop automatic site inspection/injection.

### Gmail permission revoked
Show disconnected/reauth-required state.
Clear active Gmail-derived secrets.

### Browser restart
Active `storage.session` secrets disappear.
That is acceptable.
Persistent Gmail history checkpoint remains and new updates continue.

### Incognito
Disable v1 unless explicitly designed/tested for split incognito behavior. Do not silently expose normal-profile Gmail actions to incognito tabs.

---

# 39. Performance targets

Targets for ordinary use:

- Background no-op sync should be small and network-light.
- No full inbox download.
- No attachment downloads.
- Overlay bundle should be small.
- Website injector should contain no large framework runtime if avoidable.
- No persistent content scanning on websites.
- No MutationObserver watching entire pages.
- No page text scraping.
- No long-lived background worker tricks.

The extension should feel dormant until Gmail has an update or the user opens its UI.

---

# 40. Development configuration

`.env.example`:

```text
GOOGLE_OAUTH_CLIENT_ID=
```

Treat client ID as public build configuration.

Keep separate development and production Google Cloud projects if practical.

Document:

- expected extension ID
- how to preserve dev extension ID
- how to create the Chrome Extension OAuth client
- how to add test users
- how to load unpacked build

Never place a Google client secret in the extension.

---

# 41. README requirements

`README.md` should contain:

- product summary
- architecture summary
- privacy model
- prerequisites
- install dependencies
- dev command
- build
- zip
- load unpacked extension
- Google OAuth setup pointer
- test commands
- project structure
- troubleshooting
- security reporting contact placeholder

Do not place sensitive test Gmail data in the repository.

---

# 42. PROGRESS.md template

```md
# Progress

## Current phase
Phase X: ...

## Completed
- [x] ...

## In progress
- [ ] ...

## Blocked
- None

## Verification
- `pnpm typecheck`: pass/fail
- `pnpm test`: pass/fail
- `pnpm build`: pass/fail

## Security checks
- No secret logging: pass/fail
- No remote Gmail data transfer: pass/fail
- Permission audit: pass/fail

## Next
1. ...
2. ...
```

Update after every meaningful implementation phase.

---

# 43. Release acceptance checklist

The project is not ready for public release until all are true:

## Functionality

- [ ] Gmail connects through explicit user action.
- [ ] New Gmail messages are detected incrementally.
- [ ] OTP extraction passes fixture tests.
- [ ] Verification-link extraction passes fixture tests.
- [ ] Commercial/irrelevant number false-positive fixtures are rejected.
- [ ] Matching site receives high-confidence overlay.
- [ ] Unrelated site does not receive automatic overlay.
- [ ] Copy works.
- [ ] Verification link opens only after user click.
- [ ] Both code + link email is supported.
- [ ] Multiple active events are handled cleanly.
- [ ] Expired events are removed.

## Security

- [ ] Gmail body never leaves the extension.
- [ ] OTP never enters developer logs.
- [ ] Full verification URL never enters developer logs.
- [ ] OAuth token is not manually persisted.
- [ ] Host page cannot read overlay secret.
- [ ] Verification URLs are never pre-fetched.
- [ ] Only HTTPS gets normal link-open action.
- [ ] Domain mismatch produces caution/blocked UI.
- [ ] Automatic clipboard mode is off by default.
- [ ] No clipboard read permission.
- [ ] No remote executable code.
- [ ] All production dependencies reviewed.

## Permissions

- [ ] Every required permission has a user-facing reason.
- [ ] Website access is optional.
- [ ] Gmail scope is only `gmail.readonly`.
- [ ] No unnecessary `tabs`, cookies, history, or network interception permissions.
- [ ] Chrome Web Store privacy form matches actual behavior.

## Compliance

- [ ] Public home page exists.
- [ ] Public privacy policy exists.
- [ ] Google Limited Use disclosures are accurate.
- [ ] Chrome Web Store Limited Use disclosures are accurate.
- [ ] OAuth restricted-scope verification prepared/completed as required.
- [ ] Chrome Web Store review package prepared.

---

# 44. Future roadmap after v1

Do not mix these into the first implementation unless v1 is complete.

## v1.1
- better service alias mapping
- optional keyboard shortcut
- per-site behavior rules
- improved multi-code selection
- optional native browser notification when no matching site is open

## v1.2
- multiple Gmail accounts
- careful account selector UX
- localization

## v2
- Outlook / Microsoft Graph
- optional Android companion for SMS OTPs
- cross-browser Edge/Firefox evaluation
- passkey-aware UX that stays separate from email verification

## Server-side realtime option
Only revisit Gmail Pub/Sub if product requirements genuinely need server-triggered realtime events.

This is a different privacy/compliance architecture because Gmail restricted data or access capability may then involve a third-party server and potentially Google's security-assessment requirements.

Do not migrate to server push merely to save 30 seconds of polling delay without evaluating that cost.

---

# 45. Key architectural decisions

These are intentionally locked for the first build:

1. **Chrome first.**
2. **Manifest V3.**
3. **WXT + React + TypeScript.**
4. **Gmail API, not Gmail DOM scraping.**
5. **`gmail.readonly`, no modify scope.**
6. **Incremental `history.list` polling.**
7. **No application backend in v1.**
8. **No LLM.**
9. **Sensitive actions stored only in `chrome.storage.session`.**
10. **Website secrets rendered in an extension-origin iframe.**
11. **Optional website permissions.**
12. **Click-to-copy by default.**
13. **No automatic link opening.**
14. **No link prefetch/redirect resolution.**
15. **High-confidence site matching required for automatic overlay.**
16. **Popup/badge is the safe fallback for uncertain matches.**

If an implementation change conflicts with one of these decisions, document the reason in `PROGRESS.md` and the threat model before changing it.

---

# 46. Official references

Use official documentation as the primary source when implementation details conflict with assumptions in this plan.

## Chrome Extensions

Chrome Extensions documentation  
https://developer.chrome.com/docs/extensions/

Manifest V3 / manifest format  
https://developer.chrome.com/docs/extensions/reference/manifest

Chrome Identity API  
https://developer.chrome.com/docs/extensions/reference/api/identity

OAuth2 manifest configuration  
https://developer.chrome.com/docs/extensions/reference/manifest/oauth2

Chrome OAuth2 guide  
https://developer.chrome.com/docs/extensions/mv3/tut_oauth

Chrome Alarms API  
https://developer.chrome.com/docs/extensions/reference/api/alarms

Chrome Scripting API  
https://developer.chrome.com/docs/extensions/reference/api/scripting

Chrome permissions declaration  
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions

Chrome Permissions API  
https://developer.chrome.com/docs/extensions/reference/api/permissions

Chrome Offscreen API  
https://developer.chrome.com/docs/extensions/reference/api/offscreen

Chrome Storage API  
https://developer.chrome.com/docs/extensions/reference/api/storage

Extension service workers  
https://developer.chrome.com/docs/extensions/develop/concepts/service-workers

Chrome Web Store Program Policies  
https://developer.chrome.com/docs/webstore/program-policies

Chrome Web Store Limited Use  
https://developer.chrome.com/docs/webstore/program-policies/limited-use/

Chrome Web Store data handling  
https://developer.chrome.com/docs/webstore/program-policies/data-handling/

Chrome Web Store privacy fields  
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/

## Gmail / Google OAuth

Gmail API overview  
https://developers.google.com/workspace/gmail/api/guides

Gmail API scopes  
https://developers.google.com/workspace/gmail/api/auth/scopes

Gmail messages.list  
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list

Gmail messages.get  
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get

Gmail getProfile  
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile

Gmail history.list  
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list

Synchronize clients with Gmail  
https://developers.google.com/workspace/gmail/api/guides/sync

Gmail push notifications  
https://developers.google.com/workspace/gmail/api/guides/push

Gmail API quotas  
https://developers.google.com/workspace/gmail/api/reference/quota

Google restricted-scope verification  
https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

Google OAuth client management  
https://support.google.com/cloud/answer/15549257

## WXT

WXT documentation  
https://wxt.dev/

WXT installation  
https://wxt.dev/guide/installation

WXT entrypoints  
https://wxt.dev/guide/essentials/entrypoints

WXT manifest configuration  
https://wxt.dev/guide/essentials/config/manifest

WXT publishing  
https://wxt.dev/guide/essentials/publishing

---

# 47. Final definition of done

The first production candidate is complete when a user can:

1. Install the extension.
2. Read a clear local-processing/privacy explanation.
3. Click Connect Gmail.
4. Authorize read-only Gmail access.
5. Choose site-access mode.
6. Visit a website such as a test service.
7. Receive a verification email.
8. Have the extension detect only the newly added Gmail message.
9. Extract the correct OTP and/or verification link locally.
10. Match the event to the active website.
11. See a polished secure top-right extension-origin overlay.
12. Copy a code with one click.
13. Open a verification link with one deliberate click.
14. See the real destination hostname before opening.
15. Receive a warning when domains do not match.
16. Dismiss the action.
17. Have the secret disappear automatically after its local relevance window.
18. Disconnect Gmail and stop all Gmail monitoring.

At the same time:

- no Gmail message body reaches the developer's server,
- no OTP or verification token is persisted to disk,
- no verification link is automatically visited,
- no broad website permission is forced on the user,
- and the extension satisfies the documented Google OAuth and Chrome Web Store privacy requirements.

That is the v1 product.
