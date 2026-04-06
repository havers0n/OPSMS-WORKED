export const env = {
  serviceName: process.env.BFF_SERVICE_NAME ?? '@wos/bff',
  logLevel: process.env.BFF_LOG_LEVEL ?? 'info',
  port: Number(process.env.BFF_PORT ?? '8787'),
  host: process.env.BFF_HOST ?? '127.0.0.1',
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:55821',
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  corsOrigin: process.env.BFF_CORS_ORIGIN ?? /http:\/\/127\.0\.0\.1:(4173|5173)$/
};
