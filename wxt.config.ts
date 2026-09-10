import { defineConfig } from 'wxt';

// Load .env into process.env so the manifest can read WXT_GOOGLE_CLIENT_ID here in
// the Node config context (Vite only exposes it to extension code, not here).
try {
  process.loadEnvFile('.env');
} catch {
  // No .env (e.g. CI/first run) — fall back to the placeholder below.
}

// See https://wxt.dev/api/config.html
//
// Latch — Chrome MV3 extension manifest configuration.
// Logical manifest shape follows the build spec (§27). WXT generates the final
// manifest.json from this config.

// Public manifest key — pins a stable extension ID during development so the
// Google OAuth client (created in M3) can bind to it. This is the PUBLIC key and
// is safe to commit; the matching private key lives in .keys/ and is gitignored.
// Extension ID derived from this key: gnmhkieamdmhjddhjgpkledmcgbejfec
const MANIFEST_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqbASTVDLw1E++wLRy/oodppT7F7w/MvPpid0beuVUW+KeKtmmOCwQhe05wRhhLr9O+Aa676JZ5xMRz1K2SZadFwpO64JqOmtbDs7TdU245FgfdrjNEr12LShUk5WXoRqEynzMNw0Xrc2wrjTRBbYC9OOnajUff09uTSckkKEbvw2Qg0IvL8Z1DBoyYV5TqtyWf3dCh7516FNMFVH7NFVujr6ZRmqcAQQt3k4/FLJSfVAk+m5vQGJaAn2J3TrJcHg1NpU3d+pbsm1lEu0IPLXp/WRgScQdng9233UbbtjbosP6c2DK+qVJYYg784PNPR5jL5EpAzvuhdmRyW8ErIoxQIDAQAB';

// The Google OAuth "Chrome Extension" client ID is public build configuration
// (not a secret). Set WXT_GOOGLE_CLIENT_ID in .env to override the placeholder.
// Wired to the real value during M3 OAuth setup.
const GOOGLE_CLIENT_ID =
  process.env.WXT_GOOGLE_CLIENT_ID ?? 'PLACEHOLDER_REPLACE_IN_M3.apps.googleusercontent.com';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Latch',
    description:
      'Surface recent Gmail verification codes and links on the site where you need them.',
    minimum_chrome_version: '116',
    key: MANIFEST_KEY,
    permissions: ['identity', 'storage', 'alarms', 'scripting', 'offscreen', 'activeTab'],
    optional_permissions: ['clipboardWrite'],
    host_permissions: ['https://gmail.googleapis.com/*'],
    optional_host_permissions: ['https://*/*'],
    oauth2: {
      client_id: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
    web_accessible_resources: [
      {
        resources: ['overlay.html'],
        matches: ['https://*/*'],
      },
    ],
  },
});
