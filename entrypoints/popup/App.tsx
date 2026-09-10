import {
  hasAllHttps,
  hasOriginAccess,
  listGrantedOrigins,
  removeOrigin,
  requestAllHttps,
  requestOrigin,
} from '@/src/browser/permissions';
import { FIXTURE_IDS, type FixtureId } from '@/src/dev/fixtures';
import { sendMessage } from '@/src/messaging/client';
import { PRODUCT_NAME } from '@/src/shared/constants';
import { receivedAgo } from '@/src/shared/time';
import type { ConnectionStatus, SiteAccessMode } from '@/src/shared/types';
import { DEFAULT_SETTINGS, type Settings } from '@/src/storage/schemas';
import type { VerificationActionView } from '@/src/verification/types';
import { useEffect, useState } from 'react';
import './App.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const ALL_HTTPS_PATTERN = 'https://*/*';

/** `receivedAgo` always prefixes "Received " — strip it for label contexts like "Last Gmail check: …". */
function relativeLabel(ms: number): string {
  return receivedAgo(ms).replace(/^Received /, '');
}

function connectionStateLabel(state: ConnectionStatus['state']): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'reauth_required':
      return 'Reconnect required';
    case 'error':
      return 'Error';
    default:
      return 'Not connected';
  }
}

function openErrorLabel(reason: string | undefined): string {
  switch (reason) {
    case 'not_https':
      return 'Not a secure (https) link.';
    case 'blocked':
      return 'Blocked for safety.';
    case 'not_found':
      return 'No longer available.';
    case 'invalid':
      return 'Invalid link.';
    default:
      return 'Unable to open.';
  }
}

function fixtureLabel(id: FixtureId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Turn a granted match pattern ("https://github.com/*") back into a plain origin for display. */
function patternToOrigin(pattern: string): string {
  return pattern.replace(/\/\*$/, '');
}

async function getCurrentTabOrigin(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function App() {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<LoadStatus>('loading');
  const [gmailNote, setGmailNote] = useState(false);

  const [actions, setActions] = useState<VerificationActionView[]>([]);
  const [actionsStatus, setActionsStatus] = useState<LoadStatus>('loading');
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsStatus, setSettingsStatus] = useState<LoadStatus>('loading');

  const [currentOrigin, setCurrentOrigin] = useState<string | null>(null);
  const [grantedOrigins, setGrantedOrigins] = useState<string[]>([]);
  const [allHttpsGranted, setAllHttpsGranted] = useState(false);
  const [currentOriginGranted, setCurrentOriginGranted] = useState(false);

  const [devBusy, setDevBusy] = useState<FixtureId | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  async function loadConnection() {
    setConnectionStatus('loading');
    try {
      const status = await sendMessage({ type: 'GET_CONNECTION_STATUS' });
      setConnection(status);
      setConnectionStatus('ready');
    } catch {
      setConnection(null);
      setConnectionStatus('error');
    }
  }

  async function loadActions() {
    setActionsStatus('loading');
    try {
      const list = await sendMessage({ type: 'GET_ACTIVE_ACTIONS' });
      setActions(list);
      setActionsStatus('ready');
    } catch {
      setActions([]);
      setActionsStatus('error');
    }
  }

  async function loadSettings() {
    setSettingsStatus('loading');
    try {
      const s = await sendMessage({ type: 'GET_SETTINGS' });
      setSettings(s);
      setSettingsStatus('ready');
    } catch {
      setSettingsStatus('error');
    }
  }

  async function refreshPermissions(origin: string | null) {
    try {
      const [granted, allHttps, current] = await Promise.all([
        listGrantedOrigins(),
        hasAllHttps(),
        origin ? hasOriginAccess(origin) : Promise.resolve(false),
      ]);
      setGrantedOrigins(granted);
      setAllHttpsGranted(allHttps);
      setCurrentOriginGranted(current);
    } catch {
      // Leave last-known permission state in place; controls simply won't update.
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; the loader functions above only close over stable setState setters and module-level helpers.
  useEffect(() => {
    void loadConnection();
    void loadActions();
    void loadSettings();
    // Opening the popup means the user is looking for a code now — poll fast.
    void sendMessage({ type: 'SCAN_NOW' }).catch(() => {});
    void (async () => {
      const origin = await getCurrentTabOrigin();
      setCurrentOrigin(origin);
      await refreshPermissions(origin);
    })();
  }, []);

  useEffect(() => {
    if (settings.appearance === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = settings.appearance;
    }
  }, [settings.appearance]);

  async function handleConnect() {
    try {
      const status = await sendMessage({ type: 'CONNECT_GMAIL' });
      setConnection(status);
      setConnectionStatus('ready');
      setGmailNote(!status.connected);
    } catch {
      setConnectionStatus('error');
    }
  }

  async function handleDisconnect() {
    try {
      await sendMessage({ type: 'DISCONNECT_GMAIL' });
      setGmailNote(false);
      await loadConnection();
    } catch {
      setConnectionStatus('error');
    }
  }

  async function handleCopy(id: string) {
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const result = await sendMessage({ type: 'COPY_ACTION', actionId: id });
      if (result.ok) {
        setActionError((e) => {
          const next = { ...e };
          delete next[id];
          return next;
        });
        setCopiedId(id);
        window.setTimeout(() => {
          setCopiedId((cur) => (cur === id ? null : cur));
        }, 1500);
      } else {
        setActionError((e) => ({ ...e, [id]: 'Copy failed.' }));
      }
    } catch {
      setActionError((e) => ({ ...e, [id]: 'Copy failed.' }));
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleOpen(id: string) {
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const result = await sendMessage({ type: 'OPEN_ACTION', actionId: id });
      if (result.ok) {
        setActionError((e) => {
          const next = { ...e };
          delete next[id];
          return next;
        });
      } else {
        setActionError((e) => ({ ...e, [id]: openErrorLabel(result.reason) }));
      }
    } catch {
      setActionError((e) => ({ ...e, [id]: 'Unable to open.' }));
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleDismiss(id: string) {
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      await sendMessage({ type: 'DISMISS_ACTION', actionId: id });
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setActionError((e) => ({ ...e, [id]: 'Dismiss failed.' }));
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleModeChange(mode: SiteAccessMode) {
    if (mode === 'all_https') {
      let granted = false;
      try {
        granted = await requestAllHttps();
      } catch {
        granted = false;
      }
      setAllHttpsGranted(granted);
      if (!granted) return; // user denied — leave the current mode/radio as-is
    }
    try {
      const next = await sendMessage({ type: 'SET_SITE_MODE', mode });
      setSettings(next);
    } catch {
      setSettingsStatus('error');
      return;
    }
    await refreshPermissions(currentOrigin);
  }

  async function handleGrantCurrentSite() {
    if (!currentOrigin) return;
    try {
      await requestOrigin(currentOrigin);
    } finally {
      await refreshPermissions(currentOrigin);
    }
  }

  async function handleRemoveOrigin(pattern: string) {
    try {
      await removeOrigin(patternToOrigin(pattern));
    } finally {
      await refreshPermissions(currentOrigin);
    }
  }

  async function handleInject(fixtureId: FixtureId) {
    setDevBusy(fixtureId);
    setDevError(null);
    try {
      const result = await sendMessage({ type: 'DEV_INJECT_FAKE_ACTION', fixtureId });
      if (result.ok) {
        window.close();
        return;
      }
      setDevError(result.error ?? 'Inject failed.');
    } catch {
      setDevError('Inject failed.');
    } finally {
      setDevBusy(null);
    }
  }

  const visibleGrantedOrigins = grantedOrigins.filter((o) => o !== ALL_HTTPS_PATTERN);

  return (
    <main className="latch-popup">
      <header className="latch-section latch-header">
        <h1 className="latch-title-main">{PRODUCT_NAME}</h1>
        <p className="latch-tagline">
          Recent Gmail verification codes and links, on the site where you need them.
        </p>
      </header>

      <section className="latch-section">
        <h2 className="latch-h2">Gmail</h2>
        {connectionStatus === 'error' ? (
          <p className="latch-error">Unable to load Gmail status.</p>
        ) : connectionStatus === 'loading' || !connection ? (
          <p className="latch-hint">Loading…</p>
        ) : connection.connected ? (
          <>
            <p className="latch-body">Connected as {connection.accountEmail ?? 'your account'}</p>
            {connection.reauthRequired && <p className="latch-warn">Reconnect required.</p>}
            <button
              type="button"
              className="latch-btn latch-btn-secondary"
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="latch-body">Not connected</p>
            <button
              type="button"
              className="latch-btn latch-btn-primary"
              onClick={() => void handleConnect()}
            >
              Connect Gmail
            </button>
            {gmailNote && <p className="latch-hint">Gmail sign-in is set up in the next step.</p>}
          </>
        )}
      </section>

      <section className="latch-section">
        <h2 className="latch-h2">Active actions</h2>
        {actionsStatus === 'error' ? (
          <p className="latch-error">Unable to load active actions.</p>
        ) : actionsStatus === 'loading' ? (
          <p className="latch-hint">Loading…</p>
        ) : actions.length === 0 ? (
          <p className="latch-hint">No active verification actions.</p>
        ) : (
          <ul className="latch-action-list">
            {actions.map((action) => (
              <li key={action.id} className="latch-action-item" data-risk={action.risk.level}>
                <div className="latch-action-row">
                  <span className="latch-action-service">{action.service ?? 'Verification'}</span>
                  <button
                    type="button"
                    className="latch-icon-btn"
                    aria-label={`Dismiss ${action.service ?? 'verification'}`}
                    disabled={actionBusy[action.id]}
                    onClick={() => void handleDismiss(action.id)}
                  >
                    ×
                  </button>
                </div>
                {action.code && (
                  <div className="latch-action-row">
                    <code className="latch-action-code">{action.code.display}</code>
                    <button
                      type="button"
                      className="latch-btn latch-btn-primary latch-btn-sm"
                      disabled={actionBusy[action.id]}
                      onClick={() => void handleCopy(action.id)}
                    >
                      {copiedId === action.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                {action.link && (
                  <div className="latch-action-row">
                    <span className="latch-action-host">{action.link.hostname}</span>
                    {action.hasOpen && (
                      <button
                        type="button"
                        className="latch-btn latch-btn-secondary latch-btn-sm"
                        disabled={actionBusy[action.id]}
                        onClick={() => void handleOpen(action.id)}
                      >
                        Open
                      </button>
                    )}
                  </div>
                )}
                <div className="latch-action-meta">{receivedAgo(action.receivedAt)}</div>
                {actionError[action.id] && (
                  <p className="latch-error latch-error-sm">{actionError[action.id]}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="latch-section">
        <h2 className="latch-h2">Site access</h2>
        {settingsStatus === 'error' ? (
          <p className="latch-error">Unable to load settings.</p>
        ) : settingsStatus === 'loading' ? (
          <p className="latch-hint">Loading…</p>
        ) : (
          <>
            <fieldset className="latch-fieldset">
              <legend className="latch-visually-hidden">Site access mode</legend>
              <label className="latch-radio-label">
                <input
                  type="radio"
                  name="site-mode"
                  value="on_click"
                  checked={settings.siteMode === 'on_click'}
                  onChange={() => void handleModeChange('on_click')}
                />
                On click only
              </label>
              <label className="latch-radio-label">
                <input
                  type="radio"
                  name="site-mode"
                  value="selected"
                  checked={settings.siteMode === 'selected'}
                  onChange={() => void handleModeChange('selected')}
                />
                Selected sites
              </label>
              <label className="latch-radio-label">
                <input
                  type="radio"
                  name="site-mode"
                  value="all_https"
                  checked={settings.siteMode === 'all_https'}
                  onChange={() => void handleModeChange('all_https')}
                />
                All HTTPS sites
              </label>
            </fieldset>

            {settings.siteMode === 'selected' && (
              <div className="latch-site-detail">
                {currentOrigin ? (
                  currentOriginGranted ? (
                    <p className="latch-hint">This site ({currentOrigin}) is already granted.</p>
                  ) : (
                    <button
                      type="button"
                      className="latch-btn latch-btn-secondary latch-btn-sm"
                      onClick={() => void handleGrantCurrentSite()}
                    >
                      Grant this site ({currentOrigin})
                    </button>
                  )
                ) : (
                  <p className="latch-hint">Open a website to grant it access.</p>
                )}

                <span className="latch-label">Granted sites</span>
                {visibleGrantedOrigins.length === 0 ? (
                  <p className="latch-hint">No sites granted yet.</p>
                ) : (
                  <ul className="latch-origin-list">
                    {visibleGrantedOrigins.map((pattern) => (
                      <li key={pattern} className="latch-origin-item">
                        <span className="latch-origin-value">{patternToOrigin(pattern)}</span>
                        <button
                          type="button"
                          className="latch-btn latch-btn-secondary latch-btn-sm"
                          onClick={() => void handleRemoveOrigin(pattern)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {settings.siteMode === 'all_https' && !allHttpsGranted && (
              <div className="latch-site-detail">
                <p className="latch-warn">Access to all HTTPS sites isn't currently granted.</p>
                <button
                  type="button"
                  className="latch-btn latch-btn-secondary latch-btn-sm"
                  onClick={() => void handleModeChange('all_https')}
                >
                  Grant access
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="latch-section">
        <h2 className="latch-h2">Status</h2>
        <p className="latch-body">
          Last Gmail check:{' '}
          {connection?.lastPollAt ? relativeLabel(connection.lastPollAt) : 'never'}
        </p>
        <p className="latch-body">
          Status: {connection ? connectionStateLabel(connection.state) : 'Unknown'}
        </p>
      </section>

      <section className="latch-section latch-dev-section">
        <h2 className="latch-h2">Developer</h2>
        <p className="latch-hint">Test the overlay without Gmail.</p>
        <div className="latch-dev-grid">
          {FIXTURE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="latch-btn latch-btn-secondary latch-btn-sm"
              disabled={devBusy !== null}
              onClick={() => void handleInject(id)}
            >
              {devBusy === id ? 'Injecting…' : `Inject test — ${fixtureLabel(id)}`}
            </button>
          ))}
        </div>
        {devError && <p className="latch-error">{devError}</p>}
      </section>
    </main>
  );
}

export default App;
