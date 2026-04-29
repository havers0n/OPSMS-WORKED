import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
