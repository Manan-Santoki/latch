import { sendMessage } from '@/src/messaging/client';
import type { OverlayFrameMessage } from '@/src/messaging/overlay-channel';
import { OVERLAY_FRAME_SOURCE } from '@/src/messaging/overlay-channel';
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

/** Demo mode (standalone viewing) when a `?demo=` param is present. */
function demoParam(): string | null {
  return new URLSearchParams(window.location.search).get('demo');
}

function readDemoFixture(): VerificationActionView {
  const param = demoParam() ?? 'code';
  return DEMO_FIXTURES[param] ?? DEFAULT_DEMO_FIXTURE;
}

const IS_DEMO = demoParam() !== null;

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
  const [action, setAction] = useState<VerificationActionView | null>(
    IS_DEMO ? readDemoFixture() : null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  // In the real extension, fetch the action assigned to this tab from the
  // background. The wrapper reloads this page (re-setting src) to refresh, so a
  // one-shot fetch on mount is sufficient. If there is nothing to show, dismiss.
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    void sendMessage({ type: 'GET_ACTIVE_ACTION' }).then((view) => {
      if (cancelled) return;
      if (view) setAction(view);
      else postDismissed();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCopy(id: string) {
    if (IS_DEMO) return;
    void sendMessage({ type: 'COPY_ACTION', actionId: id });
  }

  function handleOpen(id: string) {
    if (IS_DEMO) return;
    void sendMessage({ type: 'OPEN_ACTION', actionId: id });
  }

  function handleDismiss(id: string) {
    if (!IS_DEMO) void sendMessage({ type: 'DISMISS_ACTION', actionId: id });
    setAction(null);
    postDismissed();
  }

  // Escape dismisses the overlay (§17.2). Wired here, not inside the pure card,
  // so the card component stays free of global document listeners.
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleDismiss closes only over stable values; re-run on action change.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && action) {
        handleDismiss(action.id);
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
    // Report the border-box height (offsetHeight), not contentRect.height — the
    // root has padding for the card's shadow, and using the content box would
    // size the iframe too short and produce a scrollbar.
    const observer = new ResizeObserver(() => {
      postResize(el.offsetHeight);
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

if (IS_DEMO) document.body.classList.add('latch-demo');

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>,
  );
}
