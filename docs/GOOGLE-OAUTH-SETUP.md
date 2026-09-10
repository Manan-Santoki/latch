# Google OAuth setup for Latch

Latch signs in to Gmail with `chrome.identity` using an OAuth client of type **Chrome
Extension**, bound to the extension's fixed item ID. This is a one-time ~15-minute setup.
The client ID is **public** build configuration — there is no client secret in a browser
extension.

**Your extension ID (dev, fixed by the manifest key):**

```
gnmhkieamdmhjddhjgpkledmcgbejfec
```

## Steps (Google Cloud Console)

1. **Create a project.** Go to <https://console.cloud.google.com>, click the project
   picker → **New Project**, name it `Latch`, create, and select it.

2. **Enable the Gmail API.** APIs & Services → **Library** → search **Gmail API** →
   **Enable**.

3. **Configure the OAuth consent screen** (APIs & Services → **OAuth consent screen**,
   a.k.a. Google Auth Platform → Branding/Audience):
   - User type: **External** → Create.
   - App name: `Latch`; user support email: your email; developer contact: your email.
   - **Publishing status: Testing** (leave it in Testing — no Google verification needed
     for your own testing).
   - **Test users** → Add your own Gmail address (the account you'll test with).
   - Scopes: you may add `.../auth/gmail.readonly` here, but Latch also requests it at
     runtime, so this is optional.

4. **Create the OAuth client.** APIs & Services → **Credentials** → **Create Credentials**
   → **OAuth client ID**:
   - Application type: **Chrome Extension**.
   - Name: `Latch extension`.
   - **Item ID:** `gnmhkieamdmhjddhjgpkledmcgbejfec`
   - **Create**, then copy the **Client ID** (looks like
     `1234567890-abc...xyz.apps.googleusercontent.com`).

5. **Give Latch the client ID.** Either:
   - paste it back to me and I'll wire it into `wxt.config.ts`, **or**
   - copy `.env.example` to `.env` and set
     `WXT_GOOGLE_CLIENT_ID=<your client id>`, then rebuild.

## Notes
- The OAuth client is tied to the item ID above. Because Latch ships a fixed manifest
  `key`, the ID stays the same across rebuilds and machines, so the client keeps working.
- `gmail.readonly` is a **restricted** scope. In **Testing** mode with your account added as
  a test user, no Google verification is required. Public Chrome Web Store release later
  needs restricted-scope verification (tracked for M5).
- Never put a Google **client secret** in the extension (there isn't one for this flow).
