import type { ReactNode } from 'react';

interface PrintPageProps {
  children: ReactNode;
  className?: string;
}

export function PrintPage({ children, className = '' }: PrintPageProps) {
  return (
    <div className="print-root">
      <div className={`print-page ${className}`}>
        {children}
      </div>
    </div>
  );
}
