import type { VerificationActionType } from '@/src/verification/types';
import { Button } from './primitives/Button';

export interface LinkActionProps {
  type: VerificationActionType;
  /** Destination hostname only — never the exact/secret URL (§3.3, §17.1). */
  hostname: string;
  /** Ask the background to open the real URL by action id. */
  onOpen: () => void;
  /**
   * Combined code+link layout (§3.4): the "Or verify by email" divider
   * already supplies the heading, so hide the per-type title and use the
   * shorter "Open" button label.
   */
  compact?: boolean;
}

const LINK_TITLES: Partial<Record<VerificationActionType, string>> = {
  verification_link: 'Verify your email',
  account_confirmation: 'Confirm your account',
  account_activation: 'Activate your account',
  magic_sign_in: 'Sign in',
};

function titleFor(type: VerificationActionType): string {
  return LINK_TITLES[type] ?? 'Verification link';
}

/**
 * Verification-link block (§3.3): a title describing the action, the
 * destination hostname shown prominently (never just "Click here"), and a
 * primary Open button that requires an explicit click.
 */
export function LinkAction({ type, hostname, onOpen, compact = false }: LinkActionProps) {
  return (
    <div className="latch-link-action">
      {!compact && <p className="latch-title">{titleFor(type)}</p>}
      <p className="latch-hostname">{hostname}</p>
      <Button variant="primary" onClick={onOpen}>
        {compact ? 'Open' : 'Open verification'}
      </Button>
    </div>
  );
}
