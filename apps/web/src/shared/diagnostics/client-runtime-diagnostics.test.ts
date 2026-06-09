// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getClientRuntimeDiagnosticsSnapshot,
  installGlobalClientRuntimeDiagnostics,
  reportClientRuntimeError,
  setClientRuntimeRoute
} from './client-runtime-diagnostics';

describe('client runtime diagnostics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    setClientRuntimeRoute('/warehouse/view?debug=1');
  });

  it('stores and posts reported runtime errors', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 202 })
    );

    const errorId = reportClientRuntimeError({
      source: 'manual-debug',
      message: 'Storage view crashed',
      context: {
        stage: 'test'
      }
    });

    expect(errorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(getClientRuntimeDiagnosticsSnapshot().lastError).toMatchObject({
      clientErrorId: errorId,
      route: '/warehouse/view?debug=1',
      message: 'Storage view crashed'
    });

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/client-errors',
      expect.objectContaining({
        method: 'POST',
        keepalive: true
      })
    );
  });

  it('installs global error listeners that capture window errors', () => {
    const cleanup = installGlobalClientRuntimeDiagnostics();

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'phone crash',
        error: new Error('phone crash')
      })
    );

    expect(getClientRuntimeDiagnosticsSnapshot().lastError).toMatchObject({
      source: 'window-error',
      message: 'phone crash'
    });

    cleanup();
  });
});
