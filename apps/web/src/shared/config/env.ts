export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  bffUrl: import.meta.env.VITE_BFF_URL ?? '/api',
  devAuthEmail: import.meta.env.VITE_DEV_AUTH_EMAIL ?? 'operator@wos.local',
  devAuthPassword: import.meta.env.VITE_DEV_AUTH_PASSWORD ?? 'warehouse123'
};
