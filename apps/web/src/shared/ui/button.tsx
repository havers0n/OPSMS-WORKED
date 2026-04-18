import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'solid' | 'ghost';
type ButtonSize = 'sm' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BASE_CLASSNAME =
  'inline-flex items-center justify-center rounded-md disabled:cursor-not-allowed';

const VARIANT_CLASSNAME: Record<ButtonVariant, string> = {
  solid: 'transition-opacity hover:opacity-90',
  ghost: 'transition-colors hover:bg-slate-100'
};

const SIZE_CLASSNAME: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs font-semibold',
  icon: 'h-7 w-7'
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function Button({
  variant = 'ghost',
  size = 'sm',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(BASE_CLASSNAME, VARIANT_CLASSNAME[variant], SIZE_CLASSNAME[size], className)}
      {...props}
    />
  );
}
