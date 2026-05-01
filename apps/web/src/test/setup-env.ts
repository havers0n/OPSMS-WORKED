import { vi } from 'vitest';

// Keep Vitest reproducible from a clean checkout without weakening runtime env validation.
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
