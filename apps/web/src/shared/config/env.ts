type FrontendEnvSource = {
  readonly DEV?: boolean;
  readonly PROD?: boolean;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_BFF_URL?: string;
  readonly VITE_ENABLE_DEV_AUTO_LOGIN?: string;
  readonly VITE_DEV_AUTH_EMAIL?: string;
  readonly VITE_DEV_AUTH_PASSWORD?: string;
};

function requiredFrontendEnv(source: FrontendEnvSource, name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = source[name];
  if (!value) {
    throw new Error(`Missing required frontend environment variable: ${name}`);
  }

  return value;
}

export function resolveFrontendEnv(source: FrontendEnvSource) {
  const isDev = source.DEV === true;
  const isProd = source.PROD === true;
  const enableDevAutoLoginFlag = source.VITE_ENABLE_DEV_AUTO_LOGIN === 'true';

  if (isProd && enableDevAutoLoginFlag) {
    throw new Error('VITE_ENABLE_DEV_AUTO_LOGIN cannot be true in production.');
  }

  return {
    supabaseUrl: requiredFrontendEnv(source, 'VITE_SUPABASE_URL'),
    supabaseAnonKey: requiredFrontendEnv(source, 'VITE_SUPABASE_ANON_KEY'),
    bffUrl: source.VITE_BFF_URL ?? '/api',
    enableDevAutoLogin: isDev && enableDevAutoLoginFlag,
    devAuthEmail: isDev ? (source.VITE_DEV_AUTH_EMAIL ?? 'admin@wos.local') : '',
    devAuthPassword: isDev ? (source.VITE_DEV_AUTH_PASSWORD ?? 'warehouse123') : ''
  };
}

export const env = resolveFrontendEnv(import.meta.env);
