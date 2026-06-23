import { describe, expect, it } from 'vitest';
import { resolveSupabaseAuthStorageKey } from './supabase-auth-storage-key';

describe('resolveSupabaseAuthStorageKey', () => {
  it('matches the Supabase auth-js default storage key pattern', () => {
    expect(resolveSupabaseAuthStorageKey('https://my-project.supabase.co')).toBe(
      'sb-my-project-auth-token'
    );
  });

  it('uses the first hostname segment for localhost-like origins', () => {
    expect(resolveSupabaseAuthStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
    expect(resolveSupabaseAuthStorageKey('http://localhost:54321')).toBe('sb-localhost-auth-token');
  });
});
