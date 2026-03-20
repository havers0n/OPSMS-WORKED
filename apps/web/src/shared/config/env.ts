export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  bffUrl: import.meta.env.VITE_BFF_URL ?? '/api',
  enableDevAutoLogin: import.meta.env.VITE_ENABLE_DEV_AUTO_LOGIN === 'true',
  devAuthEmail: import.meta.env.VITE_DEV_AUTH_EMAIL ?? 'admin@wos.local',
  devAuthPassword: import.meta.env.VITE_DEV_AUTH_PASSWORD ?? 'warehouse123'
};
