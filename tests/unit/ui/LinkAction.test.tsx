import { LinkAction } from '@/src/ui/LinkAction';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('LinkAction', () => {
  it('shows a title reflecting the action type and the destination hostname', () => {
    render(<LinkAction type="verification_link" hostname="github.com" onOpen={vi.fn()} />);

    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('github.com')).toBeInTheDocument();
  });

  it('never renders an opaque "click here" label', () => {
    render(<LinkAction type="verification_link" hostname="github.com" onOpen={vi.fn()} />);

    expect(screen.queryByText(/click here/i)).not.toBeInTheDocument();
  });

  it('calls onOpen when the Open verification button is clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(<LinkAction type="verification_link" hostname="github.com" onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: 'Open verification' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('uses the compact "Open" label and hides the title in combined layouts', () => {
    render(<LinkAction type="verification_link" hostname="discord.com" onOpen={vi.fn()} compact />);

    expect(screen.queryByText('Verify your email')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });
});
