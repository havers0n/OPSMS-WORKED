import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { env } from '@/shared/config/env';
import { ensureDevSession, getCurrentSessionUser, subscribeToAuthChanges } from './auth';

type SupabaseAuthState = {
  isReady: boolean;
  user: User | null;
  error: string | null;
};

export function useSupabaseAuthState() {
  const [state, setState] = useState<SupabaseAuthState>({
    isReady: false,
    user: null,
    error: null
  });

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (env.enableDevAutoLogin) {
        await ensureDevSession();
      }

      const user = await getCurrentSessionUser();
      if (!isMounted) return;

      setState({
        isReady: true,
        user,
        error: null
      });
    }

    void bootstrap().catch((authError) => {
      if (!isMounted) return;

      setState((current) => ({
        ...current,
        error: authError instanceof Error ? authError.message : 'Failed to initialize authentication'
      }));
    });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) return;

      setState({
        isReady: true,
        user,
        error: null
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: null
    }));
  }, []);

  return {
    ...state,
    clearError
  };
}
