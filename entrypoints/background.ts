import {
  associateTab,
  clearTab,
  getAction,
  getActionForTab,
  listActionViews,
  listActions,
  putAction,
  removeAction,
  setActionState,
} from '@/src/actions/action-store';
import { cleanupExpiredActions } from '@/src/actions/cleanup';
import { getActiveTab } from '@/src/browser/active-tab';
import { clearBadge, updateBadge } from '@/src/browser/badges';
import { copyActionCode } from '@/src/browser/clipboard';
import { injectOverlay, refreshOverlay, removeOverlay } from '@/src/browser/overlay';
import { type FixtureId, createFakeAction } from '@/src/dev/fixtures';
import { type ExtensionMessage, extensionMessageSchema } from '@/src/messaging/protocol';
import { logger, sanitizeError } from '@/src/security/redaction';
import { isAllowedForOneClick } from '@/src/security/url-policy';
import {
  ALARM_CLEANUP,
  ALARM_POLL,
  CLEANUP_ALARM_PERIOD_MIN,
  POLL_ALARM_PERIOD_MIN,
} from '@/src/shared/constants';
import type { ConnectionStatus } from '@/src/shared/types';
import { getGmailSync, getSettings, setGmailSync, setSettings } from '@/src/storage/local';
import { getTabActionMap } from '@/src/storage/session';
import { toActionView } from '@/src/verification/types';

export default defineBackground(() => {
  // ─── Lifecycle ──────────────────────────────────────────────────────────────
  chrome.runtime.onInstalled.addListener(() => {
    void bootstrap();
  });
  chrome.runtime.onStartup.addListener(() => {
    void onStartup();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_CLEANUP) void runCleanup();
    else if (alarm.name === ALARM_POLL) void pollGmail();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearTab(tabId);
  });

  // Revoking website access removes any overlays we are currently showing.
  chrome.permissions.onRemoved.addListener(() => {
    void removeAllOverlays();
  });

  // ─── Message router (validated typed protocol, §24) ──────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const parsed = extensionMessageSchema.safeParse(message);
    if (!parsed.success) return undefined; // not our app protocol (e.g. offscreen) — ignore
    handleMessage(parsed.data, sender)
      .then(sendResponse)
      .catch((err) => {
        logger.error('message handler failed', sanitizeError(err));
        sendResponse(undefined);
      });
    return true; // async response
  });
});

async function bootstrap(): Promise<void> {
  await setSettings({}); // persist defaults if unset
  await ensureAlarms();
  await runCleanup();
}

async function onStartup(): Promise<void> {
  await ensureAlarms();
  await runCleanup();
}

async function ensureAlarms(): Promise<void> {
  await chrome.alarms.create(ALARM_POLL, { periodInMinutes: POLL_ALARM_PERIOD_MIN });
  await chrome.alarms.create(ALARM_CLEANUP, {
    periodInMinutes: CLEANUP_ALARM_PERIOD_MIN,
  });
}

async function refreshBadge(): Promise<void> {
  const count = (await listActions()).length;
  if (count > 0) await updateBadge(count);
  else await clearBadge();
}

async function runCleanup(): Promise<void> {
  const { affectedTabIds } = await cleanupExpiredActions();
  for (const tabId of affectedTabIds) {
    await removeOverlay(tabId);
  }
  await refreshBadge();
}

async function removeAllOverlays(): Promise<void> {
  const map = await getTabActionMap();
  for (const tabId of Object.keys(map)) {
    const numeric = Number(tabId);
    if (!Number.isNaN(numeric)) await removeOverlay(numeric);
  }
}

/** Placeholder — Gmail polling is wired in M4 after OAuth setup. */
async function pollGmail(): Promise<void> {
  const sync = await getGmailSync();
  if (!sync.connected) return;
  // M4: incremental history.list sync → detect → route.
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

async function connectionStatus(): Promise<ConnectionStatus> {
  const sync = await getGmailSync();
  return {
    connected: sync.connected,
    accountEmail: sync.accountEmail,
    reauthRequired: sync.reauthRequired,
    state: sync.reauthRequired ? 'reauth_required' : sync.connected ? 'connected' : 'disconnected',
    lastPollAt: sync.lastSuccessfulPollAt,
    lastErrorClass: sync.lastErrorClass,
  };
}

async function dismissEverywhere(actionId: string): Promise<void> {
  const map = await getTabActionMap();
  for (const [tabId, id] of Object.entries(map)) {
    if (id === actionId) {
      const numeric = Number(tabId);
      if (!Number.isNaN(numeric)) await removeOverlay(numeric);
    }
  }
  await removeAction(actionId);
  await refreshBadge();
}

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'GET_CONNECTION_STATUS':
      return connectionStatus();

    case 'CONNECT_GMAIL':
      // Real interactive OAuth is wired in M3/M4; for now report current state.
      return connectionStatus();

    case 'DISCONNECT_GMAIL':
      await setGmailSync({
        connected: false,
        accountEmail: undefined,
        historyId: undefined,
        reauthRequired: false,
      });
      return { ok: true };

    case 'GET_ACTIVE_ACTION': {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId === undefined) return null;
      const action = await getActionForTab(tabId);
      return action ? toActionView(action) : null;
    }

    case 'GET_ACTIVE_ACTIONS':
      return listActionViews();

    case 'COPY_ACTION': {
      const ok = await copyActionCode(message.actionId);
      if (ok) await setActionState(message.actionId, 'copied');
      return { ok };
    }

    case 'OPEN_ACTION': {
      const action = await getAction(message.actionId);
      if (!action?.link) return { ok: false, reason: 'not_found' as const };
      if (action.risk.level === 'blocked') return { ok: false, reason: 'blocked' as const };
      if (!isAllowedForOneClick(action.link.exactUrl)) {
        return { ok: false, reason: 'not_https' as const };
      }
      await chrome.tabs.create({ url: action.link.exactUrl });
      await setActionState(message.actionId, 'opened');
      return { ok: true };
    }

    case 'DISMISS_ACTION':
      await dismissEverywhere(message.actionId);
      return { ok: true };

    case 'REQUEST_SITE_PERMISSION':
      // Permission prompts require a user gesture, so the popup/options page calls
      // chrome.permissions.request directly. This path only reports current state.
      return { granted: false };

    case 'SET_SITE_MODE':
      return setSettings({ siteMode: message.mode });

    case 'GET_SETTINGS':
      return getSettings();

    case 'SET_SETTINGS':
      return setSettings(message.patch);

    case 'DEV_INJECT_FAKE_ACTION': {
      const fixtureId = (message.fixtureId ?? 'code') as FixtureId;
      const action = createFakeAction(fixtureId);
      await putAction(action);
      const tab = message.tabId !== undefined ? { id: message.tabId } : await getActiveTab();
      if (tab?.id !== undefined) {
        await associateTab(tab.id, action.id);
        try {
          await injectOverlay(tab.id);
          await refreshOverlay(tab.id);
        } catch (err) {
          logger.warn('overlay inject failed', sanitizeError(err));
          return { ok: false, error: 'inject_failed' };
        }
      }
      await refreshBadge();
      return { ok: true };
    }
  }
}
