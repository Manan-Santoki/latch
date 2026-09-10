import type { RiskLevel } from '@/src/verification/types';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from './primitives/Button';

export interface RiskWarningProps {
  level: Extract<RiskLevel, 'caution' | 'blocked'>;
  /** Destination hostname only — never the exact/secret URL (§17.1). */
  hostname: string;
  service?: string;
  reasons: string[];
  /** Mirrors `VerificationActionView.hasOpen` — false whenever level is 'blocked' (§3.5). */
  hasOpen: boolean;
  onOpen: () => void;
}

/**
 * Suspicious/mismatched-link warning (§3.5). A 'blocked' risk never renders
 * the normal one-click Open button — only a local "View details" disclosure
 * of the (already-sanitized) risk reasons already present on the view model.
 * A 'caution' risk still allows Open, but wrapped in a visible warning.
 */
export function RiskWarning({
  level,
  hostname,
  service,
  reasons,
  hasOpen,
  onOpen,
}: RiskWarningProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`latch-risk latch-risk--${level}`} role="alert">
      <p className="latch-risk-title">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>Domain mismatch</span>
      </p>
      {service && <p className="latch-risk-sub">Email appears related to {service}</p>}
      <p className="latch-risk-hostname">Link: {hostname}</p>
      {level === 'blocked' ? (
        <>
          <Button
            variant="secondary"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            View details
          </Button>
          {expanded && reasons.length > 0 && (
            <ul className="latch-risk-reasons">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        hasOpen && (
          <Button variant="warning" onClick={onOpen}>
            Open verification
          </Button>
        )
      )}
    </div>
  );
}
