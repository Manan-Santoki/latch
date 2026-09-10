import { receivedAgo } from '@/src/shared/time';
import type { VerificationActionView } from '@/src/verification/types';
import { ShieldCheck, X } from 'lucide-react';
import { CodeAction } from './CodeAction';
import { LinkAction } from './LinkAction';
import { RiskWarning } from './RiskWarning';
import { IconButton } from './primitives/IconButton';

export interface VerificationCardProps {
  action: VerificationActionView;
  onCopy: (id: string) => void;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
  /** Injectable "now" for deterministic relative-time rendering in tests. */
  nowMs?: number;
}

/**
 * Top-right secure overlay card (§3.2–§3.5, §17). Renders exclusively from
 * the redacted `VerificationActionView` — it never sees `code.copyValue` or
 * `link.exactUrl`; Copy/Open are opaque callbacks the background resolves by
 * action id.
 */
export function VerificationCard({
  action,
  onCopy,
  onOpen,
  onDismiss,
  nowMs,
}: VerificationCardProps) {
  const showCode = Boolean(action.code) && action.hasCopy;
  const isRisky = action.risk.level === 'caution' || action.risk.level === 'blocked';
  const showRiskWarning = isRisky && action.link != null;
  const showPlainLink = !showRiskWarning && action.link != null && action.hasOpen;
  const showDivider = showCode && (showRiskWarning || showPlainLink);

  return (
    <section className="latch-card" data-risk={action.risk.level}>
      <header className="latch-card-header">
        <div className="latch-card-header-title">
          <ShieldCheck size={18} className="latch-card-header-icon" aria-hidden="true" />
          <span>{action.service ?? 'Verification'}</span>
        </div>
        <IconButton ariaLabel="Dismiss" onClick={() => onDismiss(action.id)}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="latch-card-body">
        {showCode && action.code && (
          <CodeAction display={action.code.display} onCopy={() => onCopy(action.id)} />
        )}

        {showDivider && <div className="latch-divider">Or verify by email</div>}

        {showRiskWarning && action.link && (
          <RiskWarning
            level={action.risk.level as 'caution' | 'blocked'}
            service={action.service}
            hostname={action.link.hostname}
            reasons={action.risk.reasons}
            hasOpen={action.hasOpen}
            onOpen={() => onOpen(action.id)}
          />
        )}

        {showPlainLink && action.link && (
          <LinkAction
            type={action.type}
            hostname={action.link.hostname}
            onOpen={() => onOpen(action.id)}
            compact={showCode}
          />
        )}
      </div>

      <footer className="latch-card-footer">{receivedAgo(action.receivedAt, nowMs)}</footer>
    </section>
  );
}
