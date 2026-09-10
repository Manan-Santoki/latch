/**
 * Latch — toolbar badge (§14.2 medium-confidence fallback, §21).
 * The badge signals "there is an active verification action" without exposing any
 * content. Never put a code/domain in the badge.
 */

const BADGE_COLOR = '#2563eb';

export async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  }
}

export async function clearBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: '' });
}
