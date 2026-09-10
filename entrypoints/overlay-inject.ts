import {
  OVERLAY_FRAME_SOURCE,
  type OverlayFrameMessage,
  isOverlayControlMessage,
} from '@/src/messaging/overlay-channel';

/**
 * Latch — injected overlay wrapper (§17, §18).
 *
 * Runs in the host page's isolated content-script world (injected on demand via
 * chrome.scripting.executeScript). It creates ONLY a container + an
 * extension-origin <iframe src="overlay.html">. The host page cannot read the
 * iframe's document (cross-origin), and this wrapper never receives the OTP/URL —
 * the iframe asks the background for the action itself. The only cross-frame
 * messages here carry layout/lifecycle (resize/dismissed), never secrets.
 */
export default defineUnlistedScript(() => {
  const HOST_ID = 'latch-overlay-host';
  if (document.getElementById(HOST_ID)) return; // already mounted

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'width:min(360px, calc(100vw - 24px))',
    'z-index:2147483647',
    'border:0',
    'background:transparent',
    'color-scheme:normal',
  ].join(';');

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('overlay.html');
  iframe.title = 'Latch verification';
  iframe.setAttribute('allow', 'clipboard-write');
  // The embedded card fills the iframe edge-to-edge, so the iframe itself carries
  // the rounded corners (which clip the iframe's opaque canvas) and the drop
  // shadow (which paints outside the iframe, onto the host page). This sidesteps
  // iframe-transparency quirks entirely — the canvas is fully covered.
  iframe.style.cssText = [
    'width:100%',
    'height:0', // grows via resize messages from the iframe
    'border:0',
    'border-radius:14px',
    'box-shadow:0 12px 30px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
    'background:transparent',
    'color-scheme:normal',
    'display:block',
  ].join(';');

  host.appendChild(iframe);
  document.documentElement.appendChild(host);

  function remove(): void {
    window.removeEventListener('message', onFrameMessage);
    chrome.runtime.onMessage.removeListener(onControl);
    host.remove();
  }

  // Layout/lifecycle messages FROM the extension iframe only. Validate the source
  // window and tag; never trust or read any other field as data.
  function onFrameMessage(event: MessageEvent): void {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as Partial<OverlayFrameMessage> | undefined;
    if (!data || data.source !== OVERLAY_FRAME_SOURCE) return;
    if (data.kind === 'resize' && typeof data.height === 'number') {
      iframe.style.height = `${Math.max(0, Math.ceil(data.height))}px`;
    } else if (data.kind === 'dismissed') {
      remove();
    }
  }

  // Control messages FROM the background (remove/refresh). No secret content.
  function onControl(message: unknown): undefined {
    if (!isOverlayControlMessage(message)) return undefined;
    if (message.kind === 'remove') {
      remove();
    } else if (message.kind === 'refresh') {
      // Reload the extension-origin page so it re-fetches its action. (The host
      // page cannot touch the iframe's document; re-setting src is allowed.)
      iframe.src = chrome.runtime.getURL('overlay.html');
    }
    return undefined;
  }

  window.addEventListener('message', onFrameMessage);
  chrome.runtime.onMessage.addListener(onControl);
});
