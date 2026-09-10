/**
 * Latch — email HTML parsing via the offscreen document (§10.2, §29).
 *
 * The service worker has no DOM, so email HTML is parsed in the offscreen document
 * with DOMParser (never rendered, no remote resources). Returns visible-ish text
 * and extracted anchors for the verification pipeline.
 */

import { sendToOffscreen } from './offscreen-doc';
import { OFFSCREEN_TARGET, type OffscreenParseResult } from './offscreen-protocol';

export async function parseEmailHtml(html: string): Promise<OffscreenParseResult> {
  if (!html.trim()) return { text: '', links: [] };
  try {
    return await sendToOffscreen<OffscreenParseResult>({
      target: OFFSCREEN_TARGET,
      op: 'parse_html',
      html,
    });
  } catch {
    return { text: '', links: [] };
  }
}
