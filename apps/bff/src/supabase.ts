import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error('BFF requires SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_* equivalents).');
}

export function createAnonClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
