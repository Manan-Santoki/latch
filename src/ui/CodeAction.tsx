import { useEffect, useRef, useState } from 'react';
import { Button } from './primitives/Button';

export interface CodeActionProps {
  /** Human display form only — never the clipboard value (§3.2, §17.1). */
  display: string;
  /** Ask the background to place the real value on the clipboard by action id. */
  onCopy: () => void;
}

const COPIED_RESET_MS = 1500;

/**
 * OTP/code block (§3.2): large readable code + primary Copy button. Clicking
 * Copy never touches the clipboard itself — that is a privileged background
 * operation reached through `onCopy` — it only shows a brief local
 * confirmation and keeps the card visible.
 */
export function CodeAction({ display, onCopy }: CodeActionProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function handleCopy() {
    onCopy();
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  return (
    <div className="latch-code-action">
      <p className="latch-label">Verification code</p>
      <div className="latch-code-row">
        <span className="latch-code-display">{display}</span>
        <Button
          variant="primary"
          className={copied ? 'latch-btn--copied' : undefined}
          onClick={handleCopy}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
