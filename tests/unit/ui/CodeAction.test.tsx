import { CodeAction } from '@/src/ui/CodeAction';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CodeAction', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the code display text', () => {
    render(<CodeAction display="824 193" onCopy={vi.fn()} />);
    expect(screen.getByText('824 193')).toBeInTheDocument();
    expect(screen.getByText('Verification code')).toBeInTheDocument();
  });

  it('calls onCopy when Copy is clicked', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(<CodeAction display="824 193" onCopy={onCopy} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('shows a Copied confirmation that reverts after ~1.5s', () => {
    vi.useFakeTimers();
    const onCopy = vi.fn();

    render(<CodeAction display="824 193" onCopy={onCopy} />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
