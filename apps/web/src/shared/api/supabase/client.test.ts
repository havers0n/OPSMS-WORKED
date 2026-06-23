import { describe, expect, it, vi } from 'vitest';
import { resolveSupabaseAuthStorageKey } from '@wos/domain';

const createClient = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient
}));

vi.mock('@/shared/config/env', () => ({
  env: {
    supabaseUrl: 'https://my-project.supabase.co',
    supabaseAnonKey: 'anon-key'
  }
}));

describe('supabase client', () => {
  it('passes the frontend storage key into createClient auth options', async () => {
    vi.resetModules();
    await import('./client');

    expect(createClient).toHaveBeenCalledWith(
      'https://my-project.supabase.co',
      'anon-key',
      {
        auth: {
          storageKey: resolveSupabaseAuthStorageKey('https://my-project.supabase.co')
        }
      }
    );
  });
});
