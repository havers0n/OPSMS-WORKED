import type { PropsWithChildren } from 'react';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
