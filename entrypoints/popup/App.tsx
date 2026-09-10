import {
  hasAllHttps,
  hasOriginAccess,
  listGrantedOrigins,
  removeOrigin,
  requestAllHttps,
  requestOrigin,
} from '@/src/browser/permissions';
import { sendMessage } from '@/src/messaging/client';
import { receivedAgo } from '@/src/shared/time';
import type { ConnectionStatus, SiteAccessMode } from '@/src/shared/types';
import { DEFAULT_SETTINGS, type Settings } from '@/src/storage/schemas';
import type { VerificationActionView } from '@/src/verification/types';
import { BarChart3, Globe, Mail, Settings as SettingsIcon, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import './App.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const ALL_HTTPS_PATTERN = 'https://*/*';

/** `receivedAgo` always prefixes "Received " — strip it for label contexts. */
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

/** Turn a granted match pattern ("https://github.com/*") back into a plain origin. */
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

function Card(props: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <section className="latch-card">
      <div className="latch-card-icon" aria-hidden="true">
        {props.icon}
      </div>
      <div className="latch-card-body">
        <h2 className="latch-card-label">{props.label}</h2>
        {props.children}
      </div>
    </section>
  );
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
      // Leave last-known permission state in place.
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; loaders only close over stable setters + module helpers.
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

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

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
        window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
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
      if (!granted) return; // user denied — leave the current mode as-is
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

  const visibleGrantedOrigins = grantedOrigins.filter((o) => o !== ALL_HTTPS_PATTERN);
  const modes: { value: SiteAccessMode; label: string }[] = [
    { value: 'on_click', label: 'On click only' },
    { value: 'selected', label: 'Selected sites' },
    { value: 'all_https', label: 'All HTTPS sites' },
  ];

  return (
    <main className="latch-popup">
      <header className="latch-topbar">
        <div className="latch-brand">
          <img className="latch-logo" src="/icon/48.png" alt="" width="28" height="28" />
          <div>
            <h1 className="latch-wordmark">Latch</h1>
            <p className="latch-tagline">
              Gmail verification codes &amp; links, where you need them.
            </p>
          </div>
        </div>
        <button type="button" className="latch-gear" aria-label="Settings" onClick={openOptions}>
          <SettingsIcon size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      <Card icon={<Mail size={20} strokeWidth={1.75} />} label="Gmail">
        {connectionStatus === 'error' ? (
          <p className="latch-error">Unable to load Gmail status.</p>
        ) : connectionStatus === 'loading' || !connection ? (
          <p className="latch-muted">Loading…</p>
        ) : connection.connected ? (
          <div className="latch-inline">
            <div>
              <p className="latch-line">Connected as</p>
              <p className="latch-strong latch-truncate">
                {connection.accountEmail ?? 'your account'}
              </p>
              {connection.reauthRequired && <p className="latch-warn">Reconnect required.</p>}
            </div>
            <button
              type="button"
              className="latch-btn latch-btn-outline"
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="latch-stack">
            <p className="latch-strong">Not connected</p>
            <button
              type="button"
              className="latch-btn latch-btn-primary"
              onClick={() => void handleConnect()}
            >
              Connect Gmail
            </button>
            {gmailNote && <p className="latch-muted">Gmail sign-in is set up in the next step.</p>}
          </div>
        )}
      </Card>

      <Card icon={<Zap size={20} strokeWidth={1.75} />} label="Active actions">
        {actionsStatus === 'error' ? (
          <p className="latch-error">Unable to load active actions.</p>
        ) : actionsStatus === 'loading' ? (
          <p className="latch-muted">Loading…</p>
        ) : actions.length === 0 ? (
          <p className="latch-muted">No active verification actions.</p>
        ) : (
          <ul className="latch-action-list">
            {actions.map((action) => (
              <li key={action.id} className="latch-action-item" data-risk={action.risk.level}>
                <div className="latch-action-row">
                  <span className="latch-strong latch-truncate">
                    {action.service ?? 'Verification'}
                  </span>
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
                    <span className="latch-action-host latch-truncate">{action.link.hostname}</span>
                    {action.hasOpen && (
                      <button
                        type="button"
                        className="latch-btn latch-btn-outline latch-btn-sm"
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
      </Card>

      <Card icon={<Globe size={20} strokeWidth={1.75} />} label="Site access">
        {settingsStatus === 'error' ? (
          <p className="latch-error">Unable to load settings.</p>
        ) : settingsStatus === 'loading' ? (
          <p className="latch-muted">Loading…</p>
        ) : (
          <>
            <fieldset className="latch-radios">
              <legend className="latch-visually-hidden">Site access mode</legend>
              {modes.map((m) => (
                <label key={m.value} className="latch-radio-label">
                  <input
                    type="radio"
                    className="latch-radio"
                    name="site-mode"
                    value={m.value}
                    checked={settings.siteMode === m.value}
                    onChange={() => void handleModeChange(m.value)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </fieldset>

            {settings.siteMode === 'selected' && (
              <div className="latch-site-detail">
                {currentOrigin ? (
                  currentOriginGranted ? (
                    <p className="latch-muted">This site ({currentOrigin}) is already granted.</p>
                  ) : (
                    <button
                      type="button"
                      className="latch-btn latch-btn-outline latch-btn-sm"
                      onClick={() => void handleGrantCurrentSite()}
                    >
                      Grant this site
                    </button>
                  )
                ) : (
                  <p className="latch-muted">Open a website to grant it access.</p>
                )}

                <span className="latch-sublabel">Granted sites</span>
                {visibleGrantedOrigins.length === 0 ? (
                  <p className="latch-muted">No sites granted yet.</p>
                ) : (
                  <ul className="latch-origin-list">
                    {visibleGrantedOrigins.map((pattern) => (
                      <li key={pattern} className="latch-origin-item">
                        <span className="latch-origin-value latch-truncate">
                          {patternToOrigin(pattern)}
                        </span>
                        <button
                          type="button"
                          className="latch-btn latch-btn-outline latch-btn-sm"
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
                  className="latch-btn latch-btn-outline latch-btn-sm"
                  onClick={() => void handleModeChange('all_https')}
                >
                  Grant access
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      <Card icon={<BarChart3 size={20} strokeWidth={1.75} />} label="Status">
        <p className="latch-line">
          <span className="latch-muted">Last Gmail check: </span>
          <span className="latch-strong">
            {connection?.lastPollAt ? relativeLabel(connection.lastPollAt) : 'never'}
          </span>
        </p>
        <p className="latch-line">
          <span className="latch-muted">Status: </span>
          <span className="latch-accent-text">
            {connection ? connectionStateLabel(connection.state) : 'Unknown'}
          </span>
        </p>
      </Card>
    </main>
  );
}

export default App;
