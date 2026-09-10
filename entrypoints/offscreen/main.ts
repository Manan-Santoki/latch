import { isOffscreenMessage } from '@/src/browser/offscreen-protocol';

// Offscreen document (reason CLIPBOARD, §29). Writes a code to the clipboard via
// a hidden textarea + execCommand('copy') — no clipboardWrite permission needed.
// The code arrives from the trusted background only; it is never logged.

function copyToClipboard(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOffscreenMessage(message)) return undefined;
  if (message.op === 'copy') {
    sendResponse({ ok: copyToClipboard(message.text) });
  }
  return undefined;
});
