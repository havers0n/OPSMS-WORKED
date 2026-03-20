import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const tenantId = '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a';
const actorId = '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d';

const authContext = {
  accessToken: 'token',
  user: {
    id: actorId,
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin'
    }
  ],
  currentTenant: {
    tenantId,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin'
  }
};

const productRow = {
  id: '8c393d26-d4d8-4e84-b772-c1f7b9d8c111',
  source: 'artos.co.il',
  external_product_id: '19917',
  sku: '7290122461749',
  name: 'USB-C Wired Earbuds',
  permalink: 'https://artos.co.il/product/19917',
  image_urls: [],
  image_files: [],
  is_active: true,
  created_at: '2026-01-16T16:19:05.000Z',
  updated_at: '2026-01-16T16:19:05.000Z'
};

const waveDraftRow = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: tenantId,
  name: 'Wave A',
  status: 'draft',
  created_at: '2026-03-15T08:00:00.000Z',
  released_at: null,
  closed_at: null
};

const waveReadyRow = {
  ...waveDraftRow,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Wave Ready',
  status: 'ready'
};

const waveReleasedRow = {
  ...waveDraftRow,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Wave Released',
  status: 'released',
  released_at: '2026-03-15T09:00:00.000Z'
};

function createOrderRow(args: {
  id: string;
  externalNumber: string;
  status: string;
  waveId?: string | null;
}) {
  return {
    id: args.id,
    tenant_id: tenantId,
    external_number: args.externalNumber,
    status: args.status,
    priority: 0,
    wave_id: args.waveId ?? null,
    created_at: '2026-03-15T08:30:00.000Z',
    released_at: null,
    closed_at: null
  };
}

function buildOrderSummaryRow(order: ReturnType<typeof createOrderRow>, waveName: string | null, lineCount = 1) {
  return {
    ...order,
    waves: waveName ? { name: waveName } : null,
    line_count: lineCount,
    unit_count: lineCount,
    picked_unit_count: 0
  };
}

function buildOrderRow(order: ReturnType<typeof createOrderRow>, waveName: string | null) {
  return {
    ...order,
    waves: waveName ? { name: waveName } : null
  };
}

function createAppWithSupabase(supabase: { from: ReturnType<typeof vi.fn>; rpc?: ReturnType<typeof vi.fn> }) {
  return buildApp({
    getAuthContext: vi.fn(async () => authContext as never),
    getUserSupabase: vi.fn(() => ({ ...supabase, rpc: supabase.rpc ?? vi.fn() }) as never)
  });
}

describe('orders and waves', () => {
  it('creates an order line from an existing product and snapshots sku/name', async () => {
    const orderId = '44444444-4444-4444-8444-444444444444';

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: orderId, status: 'draft' },
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: productRow,
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            insert: vi.fn((payload: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: '55555555-5555-4555-8555-555555555555',
                    order_id: payload.order_id,
                    tenant_id: payload.tenant_id,
                    product_id: payload.product_id,
                    sku: payload.sku,
                    name: payload.name,
                    qty_required: payload.qty_required,
                    qty_picked: 0,
                    status: 'pending'
                  },
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/lines`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        productId: productRow.id,
        qtyRequired: 2
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: '55555555-5555-4555-8555-555555555555',
      orderId,
      tenantId,
      productId: productRow.id,
      sku: productRow.sku,
      name: productRow.name,
      qtyRequired: 2,
      qtyPicked: 0,
      status: 'pending'
    });

    await app.close();
  });

  it('rejects marking an empty order as ready', async () => {
    const orderId = '66666666-6666-4666-8666-666666666666';

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: orderId, status: 'draft', wave_id: null },
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => ({
              eq: vi.fn(async () => ({
                data: options?.head ? null : [],
                count: 0,
                error: null
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${orderId}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'ready'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_HAS_NO_LINES'
    });

    await app.close();
  });

  it('blocks individual release for orders owned by a wave', async () => {
    const orderId = '77777777-7777-4777-8777-777777777777';

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: orderId, status: 'ready', wave_id: waveReadyRow.id },
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${orderId}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'released'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_RELEASE_CONTROLLED_BY_WAVE'
    });
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('creates a new order directly inside an editable wave', async () => {
    const createdOrderId = '88888888-8888-4888-8888-888888888888';
    const orderRow = createOrderRow({
      id: createdOrderId,
      externalNumber: 'ORD-2001',
      status: 'draft',
      waveId: waveDraftRow.id
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: waveDraftRow,
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'orders') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: createdOrderId },
                  error: null
                }))
              }))
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: buildOrderRow(orderRow, waveDraftRow.name),
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        externalNumber: 'ORD-2001',
        waveId: waveDraftRow.id
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: createdOrderId,
      externalNumber: 'ORD-2001',
      status: 'draft',
      waveId: waveDraftRow.id,
      waveName: waveDraftRow.name,
      lines: []
    });

    await app.close();
  });

  it('rejects creating a new order inside a released wave', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: waveReleasedRow,
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        externalNumber: 'ORD-2002',
        waveId: waveReleasedRow.id
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'WAVE_NOT_EDITABLE'
    });

    await app.close();
  });

  it('rejects marking an empty wave as ready', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: waveDraftRow,
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/waves/${waveDraftRow.id}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'ready'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'WAVE_HAS_NO_ORDERS'
    });

    await app.close();
  });

  it('rejects wave release while blocking orders are attached', async () => {
    const orders = [
      buildOrderSummaryRow(
        createOrderRow({
          id: '99999999-9999-4999-8999-999999999999',
          externalNumber: 'ORD-3001',
          status: 'ready',
          waveId: waveReadyRow.id
        }),
        waveReadyRow.name
      ),
      buildOrderSummaryRow(
        createOrderRow({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          externalNumber: 'ORD-3002',
          status: 'draft',
          waveId: waveReadyRow.id
        }),
        waveReadyRow.name
      )
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: waveReadyRow,
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: orders,
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/waves/${waveReadyRow.id}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'released'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'WAVE_HAS_BLOCKING_ORDERS'
    });
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('releases a wave through the release rpc when every attached order is ready', async () => {
    let wave: {
      id: string;
      tenant_id: string;
      name: string;
      status: string;
      created_at: string;
      released_at: string | null;
      closed_at: string | null;
    } = { ...waveReadyRow };
    let orders = [
      buildOrderSummaryRow(
        createOrderRow({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          externalNumber: 'ORD-4001',
          status: 'ready',
          waveId: waveReadyRow.id
        }),
        waveReadyRow.name
      ),
      buildOrderSummaryRow(
        createOrderRow({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          externalNumber: 'ORD-4002',
          status: 'ready',
          waveId: waveReadyRow.id
        }),
        waveReadyRow.name
      )
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: wave,
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: orders,
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn(async (fn: string) => {
        if (fn === 'release_wave') {
          wave = {
            ...wave,
            status: 'released',
            released_at: '2026-03-15T10:00:00.000Z'
          };
          orders = orders.map((order) => ({
            ...order,
            status: 'released'
          }));
          return { data: null, error: null };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/waves/${waveReadyRow.id}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'released'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: waveReadyRow.id,
      status: 'released'
    });
    expect(supabase.rpc).toHaveBeenCalledWith('release_wave', { wave_uuid: waveReadyRow.id });

    await app.close();
  });

  it('locks wave membership after release', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: waveReleasedRow,
                  error: null
                }))
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: null, error: null }))
              }))
            }))
          }))
        };
      }),
      rpc: vi.fn()
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: `/api/waves/${waveReleasedRow.id}/orders`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        orderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'WAVE_MEMBERSHIP_LOCKED'
    });

    await app.close();
  });
});
