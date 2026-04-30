import { describe, expect, it } from 'vitest';
import { resolveFrontendEnv } from './env';

describe('resolveFrontendEnv', () => {
  const requiredEnv = {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_ANON_KEY: 'anon-key'
  };

  it('allows default dev credentials only in dev mode', () => {
    expect(resolveFrontendEnv({ ...requiredEnv, DEV: true, PROD: false })).toMatchObject({
      enableDevAutoLogin: false,
      devAuthEmail: 'admin@wos.local',
      devAuthPassword: 'warehouse123'
    });

    expect(resolveFrontendEnv({ ...requiredEnv, DEV: false, PROD: true })).toMatchObject({
      enableDevAutoLogin: false,
      devAuthEmail: '',
      devAuthPassword: ''
    });
  });

  it('throws when dev auto-login is enabled in production', () => {
    expect(() =>
      resolveFrontendEnv({
        ...requiredEnv,
        DEV: false,
        PROD: true,
        VITE_ENABLE_DEV_AUTO_LOGIN: 'true'
      })
    ).toThrow('VITE_ENABLE_DEV_AUTO_LOGIN cannot be true in production.');
  });

  it('enables dev auto-login only in dev mode', () => {
    expect(
      resolveFrontendEnv({
        ...requiredEnv,
        DEV: true,
        PROD: false,
        VITE_ENABLE_DEV_AUTO_LOGIN: 'true'
      }).enableDevAutoLogin
    ).toBe(true);
  });
});
