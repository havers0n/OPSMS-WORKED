process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54421';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'test-anon-key-for-vitest-only';
process.env.BFF_PORT = process.env.BFF_PORT ?? '8787';
process.env.BFF_HOST = process.env.BFF_HOST ?? '127.0.0.1';
process.env.BFF_LOG_LEVEL = process.env.BFF_LOG_LEVEL ?? 'silent';
process.env.BFF_CORS_ORIGIN = process.env.BFF_CORS_ORIGIN ?? 'http://127.0.0.1:5173';
