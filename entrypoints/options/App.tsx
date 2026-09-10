import {
  hasAllHttps,
  listGrantedOrigins,
  removeOrigin,
  requestAllHttps,
} from '@/src/browser/permissions';
import { sendMessage } from '@/src/messaging/client';
import { HIDE_TIMEOUT_OPTIONS_MIN, PRODUCT_NAME } from '@/src/shared/constants';
import { receivedAgo } from '@/src/shared/time';
import type { Appearance, ConnectionStatus, SiteAccessMode } from '@/src/shared/types';
import { DEFAULT_SETTINGS, type Settings } from '@/src/storage/schemas';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import './App.css';

type LoadStatus = 'loading' | 'ready' | 'error';

const ALL_HTTPS_PATTERN = 'https://*/*';
const APPEARANCE_OPTIONS: Appearance[] = ['system', 'light', 'dark'];

/** `receivedAgo` always prefixes "Received " — strip it for a plain timestamp label. */
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

function pollingStatusLabel(status: ConnectionStatus): string {
  if (!status.connected) return 'Not connected';
  if (status.reauthRequired) return 'Paused (reconnect required)';
  return 'Active';
}

/** Turn a granted match pattern ("https://github.com/*") back into a plain origin for display. */
function patternToOrigin(pattern: string): string {
  return pattern.replace(/\/\*$/, '');
}

function isHideTimeout(n: number): n is Settings['hideTimeoutMinutes'] {
  return (HIDE_TIMEOUT_OPTIONS_MIN as readonly number[]).includes(n);
}

function isAppearance(value: string): value is Appearance {
  return (APPEARANCE_OPTIONS as string[]).includes(value);
}

function App() {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<LoadStatus>('loading');
  const [gmailNote, setGmailNote] = useState(false);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsStatus, setSettingsStatus] = useState<LoadStatus>('loading');

  const [grantedOrigins, setGrantedOrigins] = useState<string[]>([]);
  const [allHttpsGranted, setAllHttpsGranted] = useState(false);

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

  async function refreshPermissions() {
    try {
      const [granted, allHttps] = await Promise.all([listGrantedOrigins(), hasAllHttps()]);
      setGrantedOrigins(granted);
      setAllHttpsGranted(allHttps);
    } catch {
      // Leave last-known permission state in place.
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; the loader functions above only close over stable setState setters and module-level helpers.
  useEffect(() => {
    void loadConnection();
    void loadSettings();
    void refreshPermissions();
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

  async function updateSettings(patch: Partial<Settings>) {
    try {
      const next = await sendMessage({ type: 'SET_SETTINGS', patch });
      setSettings(next);
      setSettingsStatus('ready');
    } catch {
      setSettingsStatus('error');
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
      if (!granted) return; // user denied — leave current mode as-is
    }
    await updateSettings({ siteMode: mode });
    await refreshPermissions();
  }

  async function handleRemoveOrigin(pattern: string) {
    try {
      await removeOrigin(patternToOrigin(pattern));
    } finally {
      await refreshPermissions();
    }
  }

  function handleHideTimeoutChange(e: ChangeEvent<HTMLSelectElement>) {
    const n = Number(e.target.value);
    if (isHideTimeout(n)) void updateSettings({ hideTimeoutMinutes: n });
  }

  function handleAppearanceChange(e: ChangeEvent<HTMLSelectElement>) {
    if (isAppearance(e.target.value)) void updateSettings({ appearance: e.target.value });
  }

  const visibleGrantedOrigins = grantedOrigins.filter((o) => o !== ALL_HTTPS_PATTERN);

  return (
    <main className="latch-options">
      <header className="latch-options-header">
        <h1 className="latch-title-main">{PRODUCT_NAME} settings</h1>
      </header>

      <section className="latch-card-section">
        <h2 className="latch-h2">Gmail</h2>
        {connectionStatus === 'error' ? (
          <p className="latch-error">Unable to load Gmail status.</p>
        ) : connectionStatus === 'loading' || !connection ? (
          <p className="latch-hint">Loading…</p>
        ) : connection.connected ? (
          <>
            <p className="latch-body">Account: {connection.accountEmail ?? 'unknown'}</p>
            {connection.reauthRequired && <p className="latch-warn">Reconnect required.</p>}
            <div className="latch-button-row">
              <button
                type="button"
                className="latch-btn latch-btn-secondary"
                onClick={() => void handleConnect()}
              >
                {connection.reauthRequired ? 'Reconnect' : 'Refresh'}
              </button>
              <button
                type="button"
                className="latch-btn latch-btn-secondary"
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </button>
            </div>
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

      <section className="latch-card-section">
        <h2 className="latch-h2">Behavior</h2>
        {settingsStatus === 'error' ? (
          <p className="latch-error">Unable to load settings.</p>
        ) : (
          <div className="latch-behavior-list">
            <label className="latch-check-label">
              <input
                type="checkbox"
                checked={settings.overlayEnabled}
                onChange={(e) => void updateSettings({ overlayEnabled: e.target.checked })}
              />
              Show the overlay on matching sites
            </label>

            <label className="latch-check-label">
              <input
                type="checkbox"
                checked={settings.clickToCopy}
                onChange={(e) => void updateSettings({ clickToCopy: e.target.checked })}
              />
              Click to copy
            </label>
            <p className="latch-hint latch-indent">
              Default behavior: click a code in the overlay to copy it.
            </p>

            <label className="latch-check-label">
              <input
                type="checkbox"
                checked={settings.autoCopy}
                onChange={(e) => void updateSettings({ autoCopy: e.target.checked })}
              />
              Automatically copy new matching codes
            </label>
            <p className="latch-warn latch-indent">
              This can replace whatever is currently on your clipboard.
            </p>

            <label className="latch-check-label">
              <input
                type="checkbox"
                checked={settings.autoShowLinkCards}
                onChange={(e) => void updateSettings({ autoShowLinkCards: e.target.checked })}
              />
              Automatically show high-confidence link cards
            </label>

            <div className="latch-select-row">
              <label htmlFor="hide-timeout" className="latch-select-label">
                Hide actions after
              </label>
              <select
                id="hide-timeout"
                value={settings.hideTimeoutMinutes}
                onChange={handleHideTimeoutChange}
              >
                {HIDE_TIMEOUT_OPTIONS_MIN.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="latch-card-section">
        <h2 className="latch-h2">Website permissions</h2>
        {settingsStatus === 'error' ? (
          <p className="latch-error">Unable to load settings.</p>
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

            {settings.siteMode === 'all_https' && !allHttpsGranted && (
              <p className="latch-warn">Access to all HTTPS sites isn't currently granted.</p>
            )}

            <span className="latch-label">Granted sites</span>
            {visibleGrantedOrigins.length === 0 ? (
              <p className="latch-hint">
                No sites granted yet. Use the popup to grant the site you're on.
              </p>
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
          </>
        )}
      </section>

      <section className="latch-card-section">
        <h2 className="latch-h2">Appearance</h2>
        {settingsStatus === 'error' ? (
          <p className="latch-error">Unable to load settings.</p>
        ) : (
          <div className="latch-select-row">
            <label htmlFor="appearance" className="latch-select-label">
              Theme
            </label>
            <select id="appearance" value={settings.appearance} onChange={handleAppearanceChange}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
      </section>

      <section className="latch-card-section">
        <h2 className="latch-h2">Privacy</h2>
        <ul className="latch-privacy-list">
          <li>Gmail is accessed read-only.</li>
          <li>Messages are processed locally.</li>
          <li>Active codes and verification URLs are kept only temporarily.</li>
          <li>Verification links never open automatically.</li>
          <li>No mailbox contents are sent to the developer's server.</li>
        </ul>
      </section>

      <section className="latch-card-section">
        <h2 className="latch-h2">Diagnostics</h2>
        {connectionStatus === 'error' ? (
          <p className="latch-error">Unable to load diagnostics.</p>
        ) : connectionStatus === 'loading' || !connection ? (
          <p className="latch-hint">Loading…</p>
        ) : (
          <dl className="latch-diagnostics">
            <div className="latch-diagnostics-row">
              <dt>OAuth status</dt>
              <dd>{connectionStateLabel(connection.state)}</dd>
            </div>
            <div className="latch-diagnostics-row">
              <dt>Last successful sync</dt>
              <dd>{connection.lastPollAt ? relativeLabel(connection.lastPollAt) : 'never'}</dd>
            </div>
            <div className="latch-diagnostics-row">
              <dt>Last error class</dt>
              <dd>{connection.lastErrorClass ?? 'none'}</dd>
            </div>
            <div className="latch-diagnostics-row">
              <dt>Polling status</dt>
              <dd>{pollingStatusLabel(connection)}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}

export default App;
