/**
 * Latch — Gmail MIME parsing (§10, §10.1, §10.2).
 *
 * This module never renders HTML or touches DOMParser — HTML anchor extraction is
 * a separate concern (see `@/src/gmail/links`, invoked from the offscreen document)
 * and is injected here via the optional `htmlLinks` parameter.
 */

import { decodeInternalDate, getHeader, parseFromHeader } from '@/src/gmail/headers';
import { extractPlainTextLinks } from '@/src/gmail/links';
import type { ExtractedLink, GmailMessage, GmailMessagePart, ParsedEmail } from '@/src/gmail/types';

/**
 * Decode Gmail's URL-safe base64 body data as UTF-8 text. Never throws — returns
 * '' for empty/invalid input.
 */
export function decodeBase64Url(data: string): string {
  if (!data) return '';

  try {
    let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = base64.length % 4;
    if (remainder === 2) {
      base64 += '==';
    } else if (remainder === 3) {
      base64 += '=';
    } else if (remainder === 1) {
      // Not a valid base64 length — no padding makes this well-formed.
      return '';
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

interface WalkResult {
  plain: string;
  html: string;
}

function isAttachmentPart(part: GmailMessagePart): boolean {
  return Boolean(part.filename) || Boolean(part.body?.attachmentId);
}

/**
 * Recursively walk a Gmail MIME part tree, accumulating decoded `text/plain` and
 * `text/html` body text. Attachment parts (identified by `filename` or
 * `body.attachmentId`) are skipped. Tolerates missing/empty bodies and arbitrarily
 * nested multipart structures.
 */
function walkPartInto(part: GmailMessagePart | undefined, result: WalkResult): void {
  if (!part) return;
  if (isAttachmentPart(part)) return;

  const mimeType = (part.mimeType ?? '').toLowerCase();
  const data = part.body?.data;

  if (mimeType === 'text/plain' && data) {
    result.plain += decodeBase64Url(data);
  } else if (mimeType === 'text/html' && data) {
    result.html += decodeBase64Url(data);
  }

  if (part.parts && part.parts.length > 0) {
    for (const child of part.parts) {
      walkPartInto(child, result);
    }
  }
}

export function walkParts(payload: GmailMessagePart | undefined): WalkResult {
  const result: WalkResult = { plain: '', html: '' };
  walkPartInto(payload, result);
  return result;
}

/** Dedupe a list of ExtractedLink by href, preferring the first occurrence. */
function dedupeLinksByHref(links: ExtractedLink[]): ExtractedLink[] {
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    out.push(link);
  }
  return out;
}

/**
 * Assemble a `ParsedEmail` from a raw Gmail message. `htmlLinks` (anchors already
 * extracted from the parsed HTML document, e.g. via the offscreen document calling
 * `extractAnchorsFromDocument`) are merged with links found in the plain-text body,
 * deduped by href.
 */
export function parseGmailMessage(msg: GmailMessage, htmlLinks?: ExtractedLink[]): ParsedEmail {
  const headers = msg.payload?.headers;
  const { plain, html } = walkParts(msg.payload);

  const plainTextLinks = extractPlainTextLinks(plain);
  const links = dedupeLinksByHref([...(htmlLinks ?? []), ...plainTextLinks]);

  return {
    messageId: msg.id,
    internalDate: decodeInternalDate(msg.internalDate),
    from: parseFromHeader(getHeader(headers, 'From') ?? ''),
    subject: getHeader(headers, 'Subject') ?? '',
    plainText: plain,
    htmlText: html,
    links,
  };
}
