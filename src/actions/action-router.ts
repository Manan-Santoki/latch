/**
 * Latch — action assembly + routing (§37).
 *
 * Builds a VerificationAction from a detected event, then decides how to surface
 * it: auto-inject the secure overlay only when the current site is permitted AND
 * the combined confidence is high AND the risk is not blocked; otherwise fall back
 * to the toolbar badge (the popup shows the details, including any warning).
 */

import { getActiveTabSite } from '../browser/active-tab';
import { clearBadge, updateBadge } from '../browser/badges';
import { injectOverlay, refreshOverlay } from '../browser/overlay';
import { canAutoInject } from '../browser/permissions';
import type { ParsedEmail } from '../gmail/types';
import {
  combinedConfidence,
  scoreSiteMatch,
  shouldAutoOverlay,
} from '../matching/score-site-match';
import { inferService } from '../matching/service';
import { logger } from '../security/redaction';
import { DEFAULT_ACTION_TTL_MS } from '../shared/constants';
import { now } from '../shared/time';
import { getSettings } from '../storage/local';
import type {
  ActionRisk,
  DetectedEvent,
  RiskLevel,
  VerificationAction,
} from '../verification/types';
import { associateTab, listActions, putAction } from './action-store';

const RISK_ORDER: Record<RiskLevel, number> = { normal: 0, caution: 1, blocked: 2 };

/** Merge a detected-action risk with a site-match risk, keeping the more severe. */
export function worseRisk(
  base: ActionRisk,
  matchRisk: RiskLevel,
  matchReasons: string[],
): ActionRisk {
  const worse = RISK_ORDER[matchRisk] > RISK_ORDER[base.level] ? matchRisk : base.level;
  const reasons = [...new Set([...base.reasons, ...matchReasons])];
  return { level: worse, reasons };
}

export function buildAction(
  event: DetectedEvent,
  email: ParsedEmail,
  digest: string,
  nowMs: number = now(),
): VerificationAction {
  const service = event.service ?? inferService(email.from.domain, email.subject);
  return {
    id: crypto.randomUUID(),
    messageDigest: digest,
    type: event.type,
    service,
    senderDisplay: email.from.displayName,
    senderDomain: email.from.domain,
    receivedAt: email.internalDate,
    detectedAt: nowMs,
    code: event.code,
    link: event.link,
    explicitExpiryAt: event.explicitExpiryAt,
    localHideAfter: nowMs + DEFAULT_ACTION_TTL_MS,
    confidence: {
      intent: event.intentScore,
      action: event.actionScore,
      total: event.intentScore + event.actionScore,
    },
    risk: event.risk,
    state: 'detected',
  };
}

async function refreshBadge(): Promise<void> {
  const count = (await listActions()).length;
  if (count > 0) await updateBadge(count);
  else await clearBadge();
}

/** Store and surface an action (§37). */
export async function routeAction(action: VerificationAction, event: DetectedEvent): Promise<void> {
  const active = await getActiveTabSite();
  if (!active) {
    await putAction(action);
    await refreshBadge();
    logger.info(`route: ${action.type} stored, no readable active site → badge`);
    return;
  }

  const match = scoreSiteMatch(event, action.senderDomain, active.site);
  const total = combinedConfidence(event.intentScore, event.actionScore, match.score);
  const routed: VerificationAction = {
    ...action,
    confidence: { ...action.confidence, siteMatch: match.score, total },
    risk: worseRisk(action.risk, match.risk, match.reasons),
  };
  await putAction(routed);

  const settings = await getSettings();
  const allowed = await canAutoInject(active.site.origin, settings.siteMode);
  const inject =
    settings.overlayEnabled &&
    allowed &&
    routed.risk.level !== 'blocked' &&
    shouldAutoOverlay(match, total);
  if (inject) {
    await associateTab(active.tabId, routed.id);
    await injectOverlay(active.tabId);
    await refreshOverlay(active.tabId);
  }
  await refreshBadge();
  logger.info(
    `route: ${routed.type} stored matchLevel=${match.level} siteScore=${match.score} ` +
      `total=${total} risk=${routed.risk.level} mode=${settings.siteMode} injected=${inject}`,
  );
}
