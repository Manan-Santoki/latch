/**
 * Latch — process one fetched Gmail message (§36/§37 pipeline step).
 *
 * dedupe → age gate → MIME parse (+ offscreen HTML parse for anchors/text) →
 * detect verification event → build action → route. Runs entirely locally; no
 * Gmail data leaves the extension, and nothing here is logged.
 */

import { buildAction, routeAction } from '../actions/action-router';
import { isProcessed, markProcessed } from '../actions/dedupe';
import { parseEmailHtml } from '../browser/html-parser';
import { messageDigest } from '../security/hashing';
import { MAX_RELEVANT_MESSAGE_AGE_MS } from '../shared/constants';
import { now } from '../shared/time';
import { detectVerificationEvent } from '../verification/detect';
import { decodeInternalDate } from './headers';
import { parseGmailMessage } from './mime';
import type { GmailMessage } from './types';

export type ProcessOutcome = 'skipped' | 'no_event' | 'routed';

export async function processGmailMessage(
  msg: GmailMessage,
  accountId: string,
  nowMs: number = now(),
): Promise<ProcessOutcome> {
  const digest = await messageDigest(accountId, msg.id);
  if (await isProcessed(digest)) return 'skipped';

  const internalDate = decodeInternalDate(msg.internalDate);
  if (internalDate > 0 && nowMs - internalDate > MAX_RELEVANT_MESSAGE_AGE_MS) {
    await markProcessed(digest, nowMs);
    return 'skipped';
  }

  // Parse HTML anchors/text in the offscreen document (never rendered).
  const raw = parseGmailMessage(msg);
  const htmlParse = raw.htmlText.trim()
    ? await parseEmailHtml(raw.htmlText)
    : { text: '', links: [] };
  const email = {
    ...parseGmailMessage(msg, htmlParse.links),
    htmlText: htmlParse.text || raw.htmlText,
  };

  const event = detectVerificationEvent(email);
  if (!event) {
    await markProcessed(digest, nowMs);
    return 'no_event';
  }

  const action = buildAction(event, email, digest, nowMs);
  await routeAction(action, event);
  await markProcessed(digest, nowMs);
  return 'routed';
}
