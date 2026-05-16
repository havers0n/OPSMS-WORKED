import type { PropsWithChildren } from 'react';
import { I18nProvider } from '@/shared/i18n';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </I18nProvider>
  );
}
