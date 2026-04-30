import { renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffRequestError, bffRequest } from './client';
import { useWorkspaceSession, type WorkspaceSession } from './use-workspace-session';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  return {
    ...actual,
    bffRequest: vi.fn()
  };
});

describe('useWorkspaceSession', () => {
  const user = { id: 'user-1', email: 'admin@wos.local' } as User;
  const workspaceSession: WorkspaceSession = {
    user: {
      id: 'user-1',
      email: 'admin@wos.local',
      displayName: 'Admin'
    },
    currentTenantId: 'tenant-1',
    memberships: [
      {
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default Tenant',
        role: 'tenant_admin'
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses anonymous workspace state without calling /me when no user is present', () => {
    const { result } = renderHook(() => useWorkspaceSession(null));

    expect(result.current).toMatchObject({
      isReady: true,
      isLoading: false,
      currentTenantId: null,
      memberships: [],
      workspaceError: null,
      error: null
    });
    expect(bffRequest).not.toHaveBeenCalled();
  });

  it('resolves the authenticated workspace session from /me', async () => {
    vi.mocked(bffRequest).mockResolvedValue(workspaceSession);

    const { result } = renderHook(() => useWorkspaceSession(user));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(bffRequest).toHaveBeenCalledTimes(1);
    expect(bffRequest).toHaveBeenCalledWith('/me');
    expect(result.current.currentTenantId).toBe('tenant-1');
    expect(result.current.memberships).toEqual(workspaceSession.memberships);
    expect(result.current.workspaceError).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('maps WORKSPACE_UNAVAILABLE into a workspace error state', async () => {
    vi.mocked(bffRequest).mockRejectedValue(
      new BffRequestError(403, 'WORKSPACE_UNAVAILABLE', 'No workspace assigned', null, null)
    );

    const { result } = renderHook(() => useWorkspaceSession(user));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.currentTenantId).toBeNull();
    expect(result.current.memberships).toEqual([]);
    expect(result.current.workspaceError).toBe('No workspace assigned');
    expect(result.current.error).toBeNull();
  });

  it('surfaces unexpected workspace resolution errors separately', async () => {
    vi.mocked(bffRequest).mockRejectedValue(new Error('BFF unavailable'));

    const { result } = renderHook(() => useWorkspaceSession(user));

    await waitFor(() => {
      expect(result.current.error).toBe('BFF unavailable');
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.workspaceError).toBeNull();
  });
});
