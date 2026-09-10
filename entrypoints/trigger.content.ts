/**
 * Latch — "verification likely" trigger (§9.2 adaptive cadence).
 *
 * A minimal, event-driven content script registered AT RUNTIME only on the sites
 * the user has granted (never at install; never in on-click mode). It does NOT
 * scan or scrape the page — it listens for two user actions that usually precede
 * a verification email and pings the background to start a fast-poll burst:
 *   - submitting a form that has an email/password/tel/one-time-code field, or
 *   - clicking a "Sign in / Send code / Verify / Continue / Magic link" control.
 * It sends only a `SCAN_NOW` signal — no form data, no page content.
 */

export default defineContentScript({
  // Empty matches on purpose: this is registered at RUNTIME (see
  // src/browser/trigger-registration.ts) only for the origins the user granted,
  // via the optional host permission. Declaring matches here would leak
  // `https://*/*` into required host_permissions and break the optional model.
  matches: [],
  registration: 'runtime',
  runAt: 'document_idle',
  allFrames: false,
  main() {
    let lastFired = 0;
    function fire() {
      const now = Date.now();
      if (now - lastFired < 3000) return; // debounce bursts
      lastFired = now;
      try {
        chrome.runtime.sendMessage({ type: 'SCAN_NOW' });
      } catch {
        // Extension context gone (updated/disabled) — ignore.
      }
    }

    const VERIFY_RE =
      /\b(sign[ -]?in|log[ -]?in|send( me)?( the)? code|verify|continue|magic link|email me|get( the)? code|one[ -]?time)\b/i;

    document.addEventListener(
      'submit',
      (event) => {
        const form = event.target as HTMLFormElement | null;
        if (!form || form.tagName !== 'FORM') return;
        const hasAuthField = form.querySelector(
          'input[type=email], input[type=password], input[type=tel], ' +
            'input[autocomplete*="one-time-code"], input[name*="email" i], ' +
            'input[name*="otp" i], input[name*="code" i]',
        );
        if (hasAuthField) fire();
      },
      true,
    );

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        const el = target?.closest?.(
          'button, a, input[type=submit], input[type=button], [role="button"]',
        );
        if (!el) return;
        const label =
          el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '';
        if (VERIFY_RE.test(label.slice(0, 80))) fire();
      },
      true,
    );
  },
});
