import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/shared/ui/button';

type IconButtonVariant = 'solid' | 'ghost';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: ReactNode;
  variant?: IconButtonVariant;
};

export function IconButton({
  icon,
  variant = 'ghost',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <Button type={type} size="icon" variant={variant} className={className} {...props}>
      {icon}
    </Button>
  );
}
