import { RiskWarning } from '@/src/ui/RiskWarning';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('RiskWarning', () => {
  it('shows a Domain mismatch warning and the hostname', () => {
    render(
      <RiskWarning
        level="blocked"
        hostname="unrelated-example.net"
        service="GitHub"
        reasons={['Link domain does not match the sender domain']}
        hasOpen={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Domain mismatch')).toBeInTheDocument();
    expect(screen.getByText(/unrelated-example\.net/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub/)).toBeInTheDocument();
  });

  it('renders View details instead of a normal Open button when blocked', () => {
    render(
      <RiskWarning
        level="blocked"
        hostname="unrelated-example.net"
        reasons={['reason one']}
        hasOpen={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /open/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('expands to reveal risk reasons when View details is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RiskWarning
        level="blocked"
        hostname="unrelated-example.net"
        reasons={['Link domain does not match the sender domain']}
        hasOpen={false}
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.queryByText('Link domain does not match the sender domain'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View details' }));

    expect(screen.getByText('Link domain does not match the sender domain')).toBeInTheDocument();
  });

  it('still shows Open when caution allows it, calling onOpen when clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <RiskWarning
        level="caution"
        hostname="paypa1-secure.net"
        reasons={['Link domain differs from the sender domain']}
        hasOpen
        onOpen={onOpen}
      />,
    );

    const openButton = screen.getByRole('button', { name: /open/i });
    await user.click(openButton);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
