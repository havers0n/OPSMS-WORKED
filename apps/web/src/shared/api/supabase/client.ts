import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseAuthStorageKey } from '@wos/domain';
import { env } from '@/shared/config/env';

export const SUPABASE_STORAGE_KEY = resolveSupabaseAuthStorageKey(env.supabaseUrl);

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storageKey: SUPABASE_STORAGE_KEY
  }
});
