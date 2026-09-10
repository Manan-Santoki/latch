import type { OverlayFrameMessage } from '@/src/messaging/protocol';
import { OVERLAY_FRAME_SOURCE } from '@/src/messaging/protocol';
import { VerificationCard } from '@/src/ui/VerificationCard';
import type { VerificationActionView } from '@/src/verification/types';
import { useEffect, useRef, useState } from 'react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/src/ui/tokens.css';
import '@/src/ui/card.css';
import './style.css';

/**
 * Standalone overlay page (§17). This is the extension-origin document that
 * later gets embedded in the injected wrapper's `<iframe src="…/overlay.html">`
 * (§17.1). For THIS phase there is no background/messaging wiring yet — the
 * page is driven by a mock view model selected via `?demo=` so the UI is
 * viewable and testable on its own.
 */

const DEMO_NOW = Date.now();

const DEMO_FIXTURES: Record<string, VerificationActionView> = {
  code: {
    id: 'demo-code',
    type: 'otp_code',
    service: 'GitHub',
    senderDisplay: 'GitHub <noreply@github.com>',
    receivedAt: DEMO_NOW - 12_000,
    code: { display: '824 193' },
    risk: { level: 'normal', reasons: [] },
    state: 'shown',
    hasCopy: true,
    hasOpen: false,
  },
  link: {
    id: 'demo-link',
    type: 'verification_link',
    service: 'GitHub',
    senderDisplay: 'GitHub <noreply@github.com>',
    receivedAt: DEMO_NOW - 18_000,
    link: { hostname: 'github.com', registrableDomain: 'github.com' },
    risk: { level: 'normal', reasons: [] },
    state: 'shown',
    hasCopy: false,
    hasOpen: true,
  },
  both: {
    id: 'demo-both',
    type: 'account_confirmation',
    service: 'Discord',
    senderDisplay: 'Discord <noreply@discord.com>',
    receivedAt: DEMO_NOW - 30_000,
    code: { display: '483 921' },
    link: { hostname: 'discord.com', registrableDomain: 'discord.com' },
    risk: { level: 'normal', reasons: [] },
    state: 'shown',
    hasCopy: true,
    hasOpen: true,
  },
  caution: {
    id: 'demo-caution',
    type: 'verification_link',
    service: 'PayPal',
    senderDisplay: 'PayPal <service@paypal.com>',
    receivedAt: DEMO_NOW - 25_000,
    link: { hostname: 'paypa1-secure.net' },
    risk: {
      level: 'caution',
      reasons: ['Link domain differs from the sender domain'],
    },
    state: 'shown',
    hasCopy: false,
    hasOpen: true,
  },
  blocked: {
    id: 'demo-blocked',
    type: 'verification_link',
    service: 'GitHub',
    senderDisplay: 'GitHub <noreply@github.com>',
    receivedAt: DEMO_NOW - 40_000,
    link: { hostname: 'unrelated-example.net' },
    risk: {
      level: 'blocked',
      reasons: [
        'Link domain does not match the sender or any known GitHub domain',
        'Sender display name only, no verified domain match',
      ],
    },
    state: 'shown',
    hasCopy: false,
    hasOpen: false,
  },
};

// Non-null: 'code' is always present in DEMO_FIXTURES, guaranteeing a fallback.
const DEFAULT_DEMO_FIXTURE: VerificationActionView = DEMO_FIXTURES.code as VerificationActionView;

function readDemoFixture(): VerificationActionView {
  const param = new URLSearchParams(window.location.search).get('demo') ?? 'code';
  return DEMO_FIXTURES[param] ?? DEFAULT_DEMO_FIXTURE;
}

/** Post only a height — never a secret payload — to the injected wrapper (§17.1). */
function postResize(height: number) {
  if (window.parent === window) return;
  const message: OverlayFrameMessage = {
    source: OVERLAY_FRAME_SOURCE,
    kind: 'resize',
    height,
  };
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // Best-effort only; the standalone demo page has no parent to receive this.
  }
}

/** Post the dismissed lifecycle event to the injected wrapper (§17.1). */
function postDismissed() {
  if (window.parent === window) return;
  const message: OverlayFrameMessage = { source: OVERLAY_FRAME_SOURCE, kind: 'dismissed' };
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // Best-effort only.
  }
}

function OverlayApp() {
  const [action, setAction] = useState<VerificationActionView | null>(readDemoFixture);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // TODO(orchestrator): replace mock with GET_ACTIVE_ACTION message + COPY/OPEN/DISMISS_ACTION via background
  function handleCopy(id: string) {
    console.info('[overlay] copy', id);
  }

  function handleOpen(id: string) {
    console.info('[overlay] open', id);
  }

  function handleDismiss(id: string) {
    console.info('[overlay] dismiss', id);
    setAction(null);
    postDismissed();
  }

  // Escape dismisses the overlay (§17.2). Wired here, not inside the pure card,
  // so the card component stays free of global document listeners.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && action) {
        console.info('[overlay] dismiss', action.id);
        setAction(null);
        postDismissed();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [action]);

  // Report our rendered size to the parent frame so it can size the iframe
  // to content instead of guessing (§17.1) — dimensions only, never content.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    postResize(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) postResize(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="latch-overlay-root" ref={rootRef}>
      {action && (
        <VerificationCard
          action={action}
          onCopy={handleCopy}
          onOpen={handleOpen}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>,
  );
}
