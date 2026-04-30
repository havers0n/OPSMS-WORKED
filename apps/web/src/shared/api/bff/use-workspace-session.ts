import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { bffRequest, BffRequestError } from './client';

export type TenantMembership = {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: 'platform_admin' | 'tenant_admin' | 'operator';
};

export type WorkspaceSession = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  currentTenantId: string | null;
  memberships: TenantMembership[];
};

type WorkspaceSessionState = {
  isReady: boolean;
  isLoading: boolean;
  currentTenantId: string | null;
  memberships: TenantMembership[];
  workspaceError: string | null;
  error: string | null;
};

type InternalWorkspaceSessionState = WorkspaceSessionState & {
  userId: string | null;
};

const anonymousWorkspaceState: InternalWorkspaceSessionState = {
  userId: null,
  isReady: true,
  isLoading: false,
  currentTenantId: null,
  memberships: [],
  workspaceError: null,
  error: null
};

export async function resolveWorkspaceSession(): Promise<WorkspaceSession> {
  return bffRequest<WorkspaceSession>('/me');
}

function loadingWorkspaceState(userId: string): InternalWorkspaceSessionState {
  return {
    ...anonymousWorkspaceState,
    userId,
    isReady: false,
    isLoading: true
  };
}

export function useWorkspaceSession(user: User | null): WorkspaceSessionState {
  const [state, setState] = useState<InternalWorkspaceSessionState>(anonymousWorkspaceState);
  const userId = user?.id ?? null;

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setState(anonymousWorkspaceState);
      return () => {
        isMounted = false;
      };
    }

    setState(loadingWorkspaceState(user.id));

    void resolveWorkspaceSession()
      .then((workspaceSession) => {
        if (!isMounted) return;

        setState({
          userId: user.id,
          isReady: true,
          isLoading: false,
          currentTenantId: workspaceSession.currentTenantId,
          memberships: workspaceSession.memberships,
          workspaceError: null,
          error: null
        });
      })
      .catch((authError) => {
        if (!isMounted) return;

        if (authError instanceof BffRequestError && authError.code === 'WORKSPACE_UNAVAILABLE') {
          setState({
            userId: user.id,
            isReady: true,
            isLoading: false,
            currentTenantId: null,
            memberships: [],
            workspaceError: authError.message,
            error: null
          });
          return;
        }

        setState({
          ...anonymousWorkspaceState,
          userId: user.id,
          isReady: false,
          error: authError instanceof Error ? authError.message : 'Failed to initialize authentication'
        });
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!userId) {
    return anonymousWorkspaceState;
  }

  if (state.userId !== userId) {
    return loadingWorkspaceState(userId);
  }

  return state;
}
