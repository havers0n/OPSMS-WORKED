import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_ENV: Record<string, string> = {
  SUPABASE_URL: 'http://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
};

describe('PRINT_RENDER_FRONTEND_URL validation', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, BASE_ENV);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts http://web for Docker internal service DNS', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'http://web';
    const mod = await import('./env.js');
    expect(mod.env.printRenderFrontendUrl).toBe('http://web');
  });

  it('accepts http://wos-web-1 as valid internal origin', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'http://wos-web-1';
    const mod = await import('./env.js');
    expect(mod.env.printRenderFrontendUrl).toBe('http://wos-web-1');
  });

  it('accepts https URLs', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'https://web';
    const mod = await import('./env.js');
    expect(mod.env.printRenderFrontendUrl).toBe('https://web');
  });

  it('rejects default http://127.0.0.1:5173 in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PRINT_RENDER_FRONTEND_URL;
    delete process.env.ALLOW_LOCAL_PRINT_RENDER_URL;
    await expect(import('./env.js')).rejects.toThrowError(/PRINT_RENDER_FRONTEND_URL/);
  });

  it('allows http://127.0.0.1:5173 in production when ALLOW_LOCAL_PRINT_RENDER_URL=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_LOCAL_PRINT_RENDER_URL = 'true';
    delete process.env.PRINT_RENDER_FRONTEND_URL;
    const mod = await import('./env.js');
    expect(mod.env.printRenderFrontendUrl).toBe('http://127.0.0.1:5173');
  });

  it('rejects credentials in URL', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'http://user:pass@web';
    await expect(import('./env.js')).rejects.toThrowError(/credentials/i);
  });

  it('rejects ftp protocol', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'ftp://web';
    await expect(import('./env.js')).rejects.toThrowError(/protocol/i);
  });

  it('rejects file protocol', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'file:///path/to/page';
    await expect(import('./env.js')).rejects.toThrowError(/protocol/i);
  });

  it('rejects invalid URL strings', async () => {
    process.env.PRINT_RENDER_FRONTEND_URL = 'not-a-url';
    await expect(import('./env.js')).rejects.toThrowError(/PRINT_RENDER_FRONTEND_URL/);
  });

  it('does not reject valid http://127.0.0.1:5173 outside production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.PRINT_RENDER_FRONTEND_URL;
    const mod = await import('./env.js');
    expect(mod.env.printRenderFrontendUrl).toBe('http://127.0.0.1:5173');
  });
});
