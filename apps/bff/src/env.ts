function requiredEnv(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  const resolved = value ?? String(fallback);
  const parsed = Number(resolved);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid BFF_PORT: "${resolved}". Expected a positive integer.`);
  }

  return parsed;
}

export const env = {
  serviceName: process.env.BFF_SERVICE_NAME ?? '@wos/bff',
  logLevel: process.env.BFF_LOG_LEVEL ?? 'info',
  port: parsePort(process.env.BFF_PORT, 8787),
  host: process.env.BFF_HOST ?? '127.0.0.1',
  supabaseUrl: requiredEnv('SUPABASE_URL'),
  supabaseAnonKey: requiredEnv('SUPABASE_ANON_KEY'),
  corsOrigin: process.env.BFF_CORS_ORIGIN ?? /http:\/\/127\.0\.0\.1:(4173|5173)$/
};
