import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only buttons must always announce their purpose (§17.2). */
  ariaLabel: string;
  children: ReactNode;
}

/** Icon-only button (e.g. the card dismiss `×`). Always carries an aria-label. */
export function IconButton({
  ariaLabel,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  const classes = ['latch-icon-btn', className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  );
}
