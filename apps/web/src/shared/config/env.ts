function requiredFrontendEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required frontend environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: requiredFrontendEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requiredFrontendEnv('VITE_SUPABASE_ANON_KEY'),
  bffUrl: import.meta.env.VITE_BFF_URL ?? '/api',
  enableDevAutoLogin: import.meta.env.VITE_ENABLE_DEV_AUTO_LOGIN === 'true',
  devAuthEmail: import.meta.env.VITE_DEV_AUTH_EMAIL ?? 'admin@wos.local',
  devAuthPassword: import.meta.env.VITE_DEV_AUTH_PASSWORD ?? 'warehouse123'
};
