import { act, renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSupabaseAuthState } from './use-supabase-auth-state';

const envMock = vi.hoisted(() => ({
  env: {
    enableDevAutoLogin: false
  }
}));

const authMocks = vi.hoisted(() => ({
  ensureDevSession: vi.fn(),
  getCurrentSessionUser: vi.fn(),
  subscribeToAuthChanges: vi.fn()
}));

vi.mock('@/shared/config/env', () => envMock);
vi.mock('./auth', () => authMocks);

describe('useSupabaseAuthState', () => {
  const user = { id: 'user-1', email: 'admin@wos.local' } as User;
  let emitAuthChange: ((user: User | null) => void) | null = null;
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    envMock.env.enableDevAutoLogin = false;
    emitAuthChange = null;
    unsubscribe = vi.fn();
    authMocks.ensureDevSession.mockResolvedValue(null);
    authMocks.getCurrentSessionUser.mockResolvedValue(null);
    authMocks.subscribeToAuthChanges.mockImplementation((callback: (user: User | null) => void) => {
      emitAuthChange = callback;
      return unsubscribe;
    });
  });

  it('bootstraps the current Supabase user and unsubscribes on unmount', async () => {
    authMocks.getCurrentSessionUser.mockResolvedValue(user);

    const { result, unmount } = renderHook(() => useSupabaseAuthState());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.user).toBe(user);
    expect(authMocks.subscribeToAuthChanges).toHaveBeenCalledTimes(1);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ensures a dev session before resolving the current user when enabled', async () => {
    envMock.env.enableDevAutoLogin = true;

    const { result } = renderHook(() => useSupabaseAuthState());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(authMocks.ensureDevSession).toHaveBeenCalledTimes(1);
    expect(authMocks.getCurrentSessionUser).toHaveBeenCalledTimes(1);
  });

  it('updates from Supabase auth change notifications', async () => {
    const { result } = renderHook(() => useSupabaseAuthState());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      emitAuthChange?.(user);
    });

    expect(result.current.user).toBe(user);
    expect(result.current.error).toBeNull();
  });

  it('surfaces bootstrap errors and allows clearing them', async () => {
    authMocks.getCurrentSessionUser.mockRejectedValue(new Error('Supabase unavailable'));

    const { result } = renderHook(() => useSupabaseAuthState());

    await waitFor(() => {
      expect(result.current.error).toBe('Supabase unavailable');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
