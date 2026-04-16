import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54421';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'dev-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
