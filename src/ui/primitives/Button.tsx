import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'warning';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/**
 * Text-labelled action button (Copy / Open / View details / …). Icon-only
 * buttons should use `IconButton` instead so they always get an aria-label.
 */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = ['latch-btn', `latch-btn--${variant}`, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
