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

function parsePrintRenderUrl(value: string | undefined, fallback: string): string {
  const resolved = value ?? fallback;
  let parsed: URL;

  try {
    parsed = new URL(resolved);
  } catch {
    throw new Error(
      `Invalid PRINT_RENDER_FRONTEND_URL: "${resolved}". Must be a valid absolute URL.`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid PRINT_RENDER_FRONTEND_URL: "${resolved}". Must use http or https protocol.`
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      `Invalid PRINT_RENDER_FRONTEND_URL: "${resolved}". URL must not contain credentials.`
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    parsed.hostname === '127.0.0.1' &&
    process.env.ALLOW_LOCAL_PRINT_RENDER_URL !== 'true'
  ) {
    throw new Error(
      `PRINT_RENDER_FRONTEND_URL is "${resolved}" in production. ` +
      `Set PRINT_RENDER_FRONTEND_URL to a reachable internal origin (e.g. http://web) ` +
      `or set ALLOW_LOCAL_PRINT_RENDER_URL=true to allow localhost URLs.`
    );
  }

  return parsed.origin;
}

export const env = {
  serviceName: process.env.BFF_SERVICE_NAME ?? '@wos/bff',
  logLevel: process.env.BFF_LOG_LEVEL ?? 'info',
  port: parsePort(process.env.BFF_PORT, 8787),
  host: process.env.BFF_HOST ?? '127.0.0.1',
  supabaseUrl: requiredEnv('SUPABASE_URL'),
  supabaseAnonKey: requiredEnv('SUPABASE_ANON_KEY'),
  corsOrigin: process.env.BFF_CORS_ORIGIN ?? /http:\/\/127\.0\.0\.1:(4173|5173)$/,
  printRenderFrontendUrl: parsePrintRenderUrl(process.env.PRINT_RENDER_FRONTEND_URL, 'http://127.0.0.1:5173')
};
