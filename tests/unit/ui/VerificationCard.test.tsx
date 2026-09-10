import { VerificationCard } from '@/src/ui/VerificationCard';
import type { VerificationActionView } from '@/src/verification/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const NOW = 1_700_000_000_000;

function baseAction(overrides: Partial<VerificationActionView> = {}): VerificationActionView {
  return {
    id: 'action-1',
    type: 'otp_code',
    service: 'GitHub',
    receivedAt: NOW - 12_000,
    risk: { level: 'normal', reasons: [] },
    state: 'shown',
    hasCopy: false,
    hasOpen: false,
    ...overrides,
  };
}

describe('VerificationCard', () => {
  it('renders the code display and copies via onCopy(id), showing a Copied confirmation', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const action = baseAction({
      code: { display: '824 193' },
      hasCopy: true,
    });

    render(
      <VerificationCard
        action={action}
        onCopy={onCopy}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.getByText('824 193')).toBeInTheDocument();
    expect(screen.getByText(/Received 12 seconds ago/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledWith('action-1');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('renders the hostname and opens via onOpen(id)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const action = baseAction({
      type: 'verification_link',
      link: { hostname: 'github.com' },
      hasOpen: true,
    });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={onOpen}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.getByText('github.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open verification' }));

    expect(onOpen).toHaveBeenCalledWith('action-1');
  });

  it('calls onDismiss(id) when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const action = baseAction({ code: { display: '111 222' }, hasCopy: true });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onDismiss={onDismiss}
        nowMs={NOW}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledWith('action-1');
  });

  it('shows both the code and the hostname for a combined code+link action', () => {
    const action = baseAction({
      type: 'account_confirmation',
      service: 'Discord',
      code: { display: '483 921' },
      link: { hostname: 'discord.com' },
      hasCopy: true,
      hasOpen: true,
    });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.getByText('483 921')).toBeInTheDocument();
    expect(screen.getByText('discord.com')).toBeInTheDocument();
    expect(screen.getByText('Or verify by email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('does not render the normal Open button for a blocked-risk link', () => {
    const action = baseAction({
      type: 'verification_link',
      link: { hostname: 'unrelated-example.net' },
      risk: {
        level: 'blocked',
        reasons: ['Link domain does not match the sender domain'],
      },
      hasOpen: false,
    });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open verification' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(screen.getByText('Domain mismatch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('still shows an Open button with a warning for a caution-risk link', () => {
    const action = baseAction({
      type: 'verification_link',
      service: 'PayPal',
      link: { hostname: 'paypa1-secure.net' },
      risk: { level: 'caution', reasons: ['Link domain differs from the sender domain'] },
      hasOpen: true,
    });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.getByText('Domain mismatch')).toBeInTheDocument();
    expect(screen.getByText('paypa1-secure.net', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open verification' })).toBeInTheDocument();
  });

  it('never claims a specific expiry when explicitExpiryAt is absent', () => {
    const action = baseAction({ code: { display: '000 000' }, hasCopy: true });

    render(
      <VerificationCard
        action={action}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
        nowMs={NOW}
      />,
    );

    expect(screen.queryByText(/expires/i)).not.toBeInTheDocument();
  });
});
