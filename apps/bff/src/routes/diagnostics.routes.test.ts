import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

function createValidHeartbeatPayload() {
  return {
    sessionId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    sequence: 1,
    timestamp: new Date().toISOString(),
    route: '/warehouse/view?debug=1&disableNavigator=1',
    activeWarehouseMode: 'storage',
    floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 3,
    publishedCellCount: 120,
    occupancyRowCount: 45,
    navigatorItemCount: 8,
    recentBreadcrumbs: [
      { name: 'storage-mode-entered', timestamp: new Date().toISOString() },
      { name: 'navigator-mounted', timestamp: new Date().toISOString() }
    ],
    activeDebugFlags: {
      disableOccupancyOverlay: false,
      disableNavigator: true,
      disableInspector: false,
      disableStorageData: false
    },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15'
  };
}

describe('POST /api/diagnostics/heartbeat', () => {
  it('accepts a valid heartbeat payload', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload: createValidHeartbeatPayload()
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      accepted: true,
      requestId: expect.any(String)
    });

    await app.close();
  });

  it('rejects payload with missing required fields', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload: { sessionId: 'not-a-uuid' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('rejects payload with invalid sessionId', async () => {
    const app = buildApp();
    const payload = createValidHeartbeatPayload();
    payload.sessionId = 'not-a-valid-uuid';

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('rejects payload with negative sequence', async () => {
    const app = buildApp();
    const payload = createValidHeartbeatPayload();
    payload.sequence = -1;

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('rejects payload with negative publishedCellCount', async () => {
    const app = buildApp();
    const payload = createValidHeartbeatPayload();
    payload.publishedCellCount = -5;

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('rejects payload with missing debugFlags fields', async () => {
    const app = buildApp();
    const payload = createValidHeartbeatPayload();
    payload.activeDebugFlags = {} as never;

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('accepts minimal heartbeat with null fields', async () => {
    const app = buildApp();
    const payload: Record<string, unknown> = createValidHeartbeatPayload();
    payload.floorId = null;
    payload.devicePixelRatio = null;
    payload.navigatorItemCount = null;
    payload.recentBreadcrumbs = [];

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagnostics/heartbeat',
      payload
    });

    expect(response.statusCode).toBe(202);

    await app.close();
  });
});
