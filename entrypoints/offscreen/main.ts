import { type OffscreenParseResult, isOffscreenMessage } from '@/src/browser/offscreen-protocol';
import { extractAnchorsFromDocument } from '@/src/gmail/links';

// Offscreen document (§29). Two jobs, both in a trusted extension context:
//  - CLIPBOARD: write a code via a hidden textarea + execCommand('copy').
//  - DOM_PARSER: parse email HTML with DOMParser — never rendered, scripts never
//    run, no remote resources load. Inputs come from the background only and are
//    never logged.

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

function parseEmailHtml(html: string): OffscreenParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of Array.from(doc.querySelectorAll('script, style, template, noscript'))) {
    el.remove();
  }
  const links = extractAnchorsFromDocument(doc);
  const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { text, links };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOffscreenMessage(message)) return undefined;
  if (message.op === 'copy') {
    sendResponse({ ok: copyToClipboard(message.text) });
  } else if (message.op === 'parse_html') {
    sendResponse(parseEmailHtml(message.html));
  }
  return undefined;
});
