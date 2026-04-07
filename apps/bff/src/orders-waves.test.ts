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
}): {
  id: string;
  tenant_id: string;
  external_number: string;
  status: string;
  priority: number;
  wave_id: string | null;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
} {
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
    order_lines: Array.from({ length: lineCount }, () => ({
      qty_required: 1,
      qty_picked: 0
    })),
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

function toOrderLineDto(row: {
  id: string;
  order_id: string;
  tenant_id: string;
  product_id: string | null;
  sku: string;
  name: string;
  qty_required: number;
  qty_picked: number;
  reserved_qty?: number;
  status: string;
}) {
  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    qtyRequired: row.qty_required,
    qtyPicked: row.qty_picked,
    reservedQty: row.reserved_qty ?? 0,
    status: row.status
  };
}

function toOrderSummaryDto(row: ReturnType<typeof buildOrderSummaryRow>) {
  const waveName = Array.isArray(row.waves) ? row.waves[0]?.name ?? null : row.waves?.name ?? null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    externalNumber: row.external_number,
    status: row.status,
    priority: row.priority,
    waveId: row.wave_id,
    waveName,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    lineCount: row.line_count,
    unitCount: row.unit_count,
    pickedUnitCount: row.picked_unit_count
  };
}

function toOrderDto(
  row: ReturnType<typeof createOrderRow>,
  waveName: string | null,
  lines: Array<{
    id: string;
    order_id: string;
    tenant_id: string;
    product_id: string | null;
    sku: string;
    name: string;
    qty_required: number;
    qty_picked: number;
    reserved_qty?: number;
    status: string;
  }>
) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    externalNumber: row.external_number,
    status: row.status,
    priority: row.priority,
    waveId: row.wave_id,
    waveName,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    lines: lines.map(toOrderLineDto)
  };
}

function toWaveDto(
  wave: {
    id: string;
    tenant_id: string;
    name: string;
    status: string;
    created_at: string;
    released_at: string | null;
    closed_at: string | null;
  },
  orders: Array<ReturnType<typeof buildOrderSummaryRow>>
) {
  const totalOrders = orders.length;
  const readyOrders = orders.filter((order) => order.status === 'ready').length;
  const blockingOrderCount = orders.filter((order) => order.status !== 'ready').length;

  return {
    id: wave.id,
    tenantId: wave.tenant_id,
    name: wave.name,
    status: wave.status,
    createdAt: wave.created_at,
    releasedAt: wave.released_at,
    closedAt: wave.closed_at,
    totalOrders,
    readyOrders,
    blockingOrderCount,
    orders: orders.map(toOrderSummaryDto)
  };
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
      reservedQty: 0,
      status: 'pending'
    });

    await app.close();
  }, 15000);

  it('rejects adding an inactive product to an order line with stable error contract', async () => {
    const orderId = '11111111-2222-4333-8444-555555555555';
    const inactiveProduct = {
      ...productRow,
      id: '82ec73f2-bf4b-4ec8-8515-2b95bb1f639f',
      is_active: false
    };

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
                  data: inactiveProduct,
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
        productId: inactiveProduct.id,
        qtyRequired: 2
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PRODUCT_INACTIVE',
      message: 'Inactive products cannot be added to orders.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('deletes an order line from an editable order with 204 contract', async () => {
    const orderId = 'fa357435-1202-4aff-bf06-16713fb4b2ea';
    const lineId = '8df66bd7-0ec3-4f8f-b0aa-7c621a13cb07';
    const deleteByOrderId = vi.fn(async () => ({
      error: null
    }));
    const deleteByLineId = vi.fn(() => ({
      eq: deleteByOrderId
    }));
    const deleteOrderLine = vi.fn(() => ({
      eq: deleteByLineId
    }));

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

        if (table === 'order_lines') {
          return {
            delete: deleteOrderLine
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
      method: 'DELETE',
      url: `/api/orders/${orderId}/lines/${lineId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(deleteOrderLine).toHaveBeenCalledTimes(1);
    expect(deleteByLineId).toHaveBeenCalledWith('id', lineId);
    expect(deleteByOrderId).toHaveBeenCalledWith('order_id', orderId);

    await app.close();
  });

  it('blocks deleting an order line when the order is not editable', async () => {
    const orderId = 'cdb0f6a2-f304-4b53-a648-c9a88e4fcf1b';
    const lineId = '0af82f90-2f3e-4a7a-a1c7-8dcaab7ee870';
    const deleteOrderLine = vi.fn();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: orderId, status: 'released' },
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            delete: deleteOrderLine
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
      method: 'DELETE',
      url: `/api/orders/${orderId}/lines/${lineId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_NOT_EDITABLE_IN_READY',
      message: "Cannot remove lines from an order in status 'released'. Roll it back to draft first."
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(deleteOrderLine).not.toHaveBeenCalled();

    await app.close();
  });

  it('blocks adding an order line when the order is ready', async () => {
    const orderId = '44a1ce2d-5e5f-4d16-8c8b-4d10e50bd9ea';
    const insertOrderLine = vi.fn();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: orderId, status: 'ready' },
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            insert: insertOrderLine
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
        qtyRequired: 1
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_NOT_EDITABLE_IN_READY',
      message: "Cannot add lines to an order in status 'ready'. Roll it back to draft first."
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(insertOrderLine).not.toHaveBeenCalled();

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
      code: 'ORDER_HAS_NO_LINES',
      message: 'Cannot mark an order as ready until it has at least one line.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('marks a draft order as ready and returns the updated order contract', async () => {
    const orderId = '71d25372-5516-48be-bd5b-9152f5ccbe1a';
    let order = createOrderRow({
      id: orderId,
      externalNumber: 'ORD-2010',
      status: 'draft',
      waveId: null
    });
    const orderLineRows = [
      {
        id: '7139de5d-ef9f-4d30-9583-e994be2c9e54',
        order_id: orderId,
        tenant_id: tenantId,
        product_id: productRow.id,
        sku: productRow.sku,
        name: productRow.name,
        qty_required: 2,
        qty_picked: 0,
        status: 'pending'
      }
    ];
    const updateOrder = vi.fn();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: buildOrderRow(order, null),
                  error: null
                }))
              }))
            })),
            update: updateOrder
          };
        }

        if (table === 'order_lines') {
          return {
            select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => ({
              eq: vi.fn(() => {
                if (options?.head) {
                  return Promise.resolve({
                    data: null,
                    count: orderLineRows.length,
                    error: null
                  });
                }

                return {
                  order: vi.fn(async () => ({
                    data: orderLineRows,
                    error: null
                  }))
                };
              })
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
        if (fn === 'commit_order_reservations') {
          order = {
            ...order,
            status: 'ready'
          };
        }

        return { data: null, error: null };
      })
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

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(toOrderDto(order, null, orderLineRows));
    expect(updateOrder).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('commit_order_reservations', { order_uuid: orderId });

    await app.close();
  });

  it('returns structured shortage details when ready commit fails ATP checks', async () => {
    const orderId = '4f89b380-0bf8-41fa-8b97-fcb86691e963';
    const order = createOrderRow({
      id: orderId,
      externalNumber: 'ORD-SHORT-STRUCTURED',
      status: 'draft',
      waveId: null
    });
    const orderLineRows = [
      {
        id: '1d34a8a2-df1f-4df2-98c8-65e8cf3b2e47',
        order_id: orderId,
        tenant_id: tenantId,
        product_id: productRow.id,
        sku: productRow.sku,
        name: productRow.name,
        qty_required: 10,
        qty_picked: 0,
        status: 'pending'
      }
    ];
    const shortage = {
      sku: productRow.sku,
      required: 10,
      physical: 5,
      reserved: 3,
      atp: 2
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: buildOrderRow(order, null),
                  error: null
                }))
              }))
            }))
          };
        }

        if (table === 'order_lines') {
          return {
            select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => ({
              eq: vi.fn(() => {
                if (options?.head) {
                  return Promise.resolve({
                    data: null,
                    count: orderLineRows.length,
                    error: null
                  });
                }

                return {
                  order: vi.fn(async () => ({
                    data: orderLineRows,
                    error: null
                  }))
                };
              })
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          code: 'P0001',
          message: 'INSUFFICIENT_STOCK',
          details: JSON.stringify({ shortage })
        }
      }))
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
      code: 'INSUFFICIENT_STOCK',
      message: 'Insufficient available-to-promise stock for one or more order lines.',
      details: {
        shortage
      }
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('routes reservation-sensitive rollback, cancel, and close transitions through reservation RPCs', async () => {
    const scenarios = [
      {
        orderId: '2d49026d-934e-4d79-9419-fce7b34f7e20',
        initialStatus: 'ready',
        targetStatus: 'draft',
        rpc: 'rollback_ready_order_to_draft'
      },
      {
        orderId: 'f450a8a9-51a8-4bc9-a95e-4e4519491ee8',
        initialStatus: 'released',
        targetStatus: 'cancelled',
        rpc: 'cancel_order_with_unreserve'
      },
      {
        orderId: 'c6dc5357-95a6-4278-a186-76a8e02cf813',
        initialStatus: 'picked',
        targetStatus: 'closed',
        rpc: 'close_order_with_unreserve'
      }
    ] as const;

    for (const scenario of scenarios) {
      let order = createOrderRow({
        id: scenario.orderId,
        externalNumber: `ORD-${scenario.targetStatus}`,
        status: scenario.initialStatus,
        waveId: null
      });
      const updateOrder = vi.fn();
      const rpc = vi.fn(async (fn: string) => {
        if (fn === scenario.rpc) {
          order = {
            ...order,
            status: scenario.targetStatus
          };
        }

        return { data: null, error: null };
      });

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'orders') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: buildOrderRow(order, null),
                    error: null
                  }))
                }))
              })),
              update: updateOrder
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
        rpc
      };

      const app = createAppWithSupabase(supabase);
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${scenario.orderId}/status`,
        headers: {
          authorization: 'Bearer token'
        },
        payload: {
          status: scenario.targetStatus
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(toOrderDto(order, null, []));
      expect(updateOrder).not.toHaveBeenCalled();
      if (scenario.rpc === 'close_order_with_unreserve') {
        expect(rpc).toHaveBeenCalledWith(scenario.rpc, { order_uuid: scenario.orderId });
      } else {
        expect(rpc).toHaveBeenCalledWith(scenario.rpc, {
          order_uuid: scenario.orderId,
          reason: null
        });
      }

      await app.close();
    }
  });

  it('releases an order through release_order rpc and returns released status contract', async () => {
    const orderId = '8e1e9f95-eb5a-4e4b-b4a0-6948ce593fa8';
    let order = createOrderRow({
      id: orderId,
      externalNumber: 'ORD-2011',
      status: 'ready',
      waveId: null
    });
    const orderLineRows = [
      {
        id: '41d3f4cd-20e2-4ec5-b82d-d80c8f0e4afd',
        order_id: orderId,
        tenant_id: tenantId,
        product_id: productRow.id,
        sku: productRow.sku,
        name: productRow.name,
        qty_required: 1,
        qty_picked: 0,
        status: 'pending'
      }
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: buildOrderRow(order, null),
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
                  data: orderLineRows,
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
        if (fn === 'release_order') {
          order = {
            ...order,
            status: 'released',
            released_at: '2026-03-15T11:00:00.000Z'
          };
          return { data: null, error: null };
        }

        return { data: null, error: null };
      })
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

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(toOrderDto(order, null, orderLineRows));
    expect(supabase.rpc).toHaveBeenCalledWith('release_order', { order_uuid: orderId });

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
      code: 'ORDER_RELEASE_CONTROLLED_BY_WAVE',
      message: 'This order belongs to a wave. Release is controlled by the wave.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
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

  it('creates a wave and returns wave contract', async () => {
    const createdWaveId = '0f0d9d43-b9ff-4f9f-abde-1846a998c298';
    const createdWave = {
      ...waveDraftRow,
      id: createdWaveId,
      name: 'Wave B'
    };
    const insertWave = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: createdWaveId },
          error: null
        }))
      }))
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            insert: insertWave,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: createdWave,
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
      method: 'POST',
      url: '/api/waves',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        name: 'Wave B'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: createdWaveId,
      tenantId,
      name: 'Wave B',
      status: 'draft',
      createdAt: '2026-03-15T08:00:00.000Z',
      releasedAt: null,
      closedAt: null,
      totalOrders: 0,
      readyOrders: 0,
      blockingOrderCount: 0,
      orders: []
    });
    expect(insertWave).toHaveBeenCalledWith({
      tenant_id: tenantId,
      name: 'Wave B',
      status: 'draft'
    });

    await app.close();
  });

  it('rejects invalid create-wave payloads with validation error', async () => {
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn()
    };
    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: '/api/waves',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        name: ''
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });

  it('moves a wave from draft to ready and returns updated wave contract', async () => {
    let wave = { ...waveDraftRow };
    const orders = [
      buildOrderSummaryRow(
        createOrderRow({
          id: '58fc4fc0-91ed-4337-92fd-c190c6493ca6',
          externalNumber: 'ORD-3003',
          status: 'ready',
          waveId: wave.id
        }),
        wave.name
      )
    ];
    const updateWave = vi.fn((patch: Record<string, unknown>) => {
      wave = {
        ...wave,
        status: patch.status as string
      };
      return {
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: wave.id },
              error: null
            }))
          }))
        }))
      };
    });

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
            })),
            update: updateWave
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
      url: `/api/waves/${waveDraftRow.id}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'ready'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(toWaveDto(wave, orders));
    expect(updateWave).toHaveBeenCalledWith({
      status: 'ready'
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
      code: 'WAVE_HAS_NO_ORDERS',
      message: 'Cannot mark an empty wave as ready.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

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
      code: 'WAVE_HAS_BLOCKING_ORDERS',
      message: 'All attached orders must be ready before wave release.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
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
    expect(response.json()).toEqual(toWaveDto(wave, orders));
    expect(supabase.rpc).toHaveBeenCalledWith('release_wave', { wave_uuid: waveReadyRow.id });

    await app.close();
  });

  it('serves orders list and detail reads through repo-backed routes without using orders service', async () => {
    const listedOrder = buildOrderSummaryRow(
      createOrderRow({
        id: 'ab18734c-15c0-4ea5-8d5c-7bd68d555ca9',
        externalNumber: 'ORD-READ-100',
        status: 'draft',
        waveId: null
      }),
      null,
      2
    );
    const detailOrder = toOrderDto(
      createOrderRow({
        id: listedOrder.id,
        externalNumber: listedOrder.external_number,
        status: listedOrder.status,
        waveId: listedOrder.wave_id
      }),
      null,
      []
    );

    const ordersSelect = vi.fn((columns: string) => {
      if (columns.includes('order_lines(qty_required, qty_picked)')) {
        return {
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [listedOrder],
              error: null
            }))
          }))
        };
      }

      if (columns.includes('external_number')) {
        return {
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: buildOrderRow(
                createOrderRow({
                  id: detailOrder.id,
                  externalNumber: detailOrder.externalNumber,
                  status: detailOrder.status,
                  waveId: detailOrder.waveId
                }),
                null
              ),
              error: null
            }))
          }))
        };
      }

      throw new Error(`Unexpected orders select: ${columns}`);
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: ordersSelect
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

        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc: vi.fn()
    };

    const getOrdersService = vi.fn(() => ({
      createOrder: vi.fn(),
      addOrderLine: vi.fn(),
      removeOrderLine: vi.fn(),
      transitionOrderStatus: vi.fn()
    }) as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
      getOrdersService
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([toOrderSummaryDto(listedOrder)]);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/orders/${detailOrder.id}`,
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toEqual(detailOrder);

    expect(getOrdersService).not.toHaveBeenCalled();

    await app.close();
  });

  it('delegates orders command routes to orders service factory', async () => {
    const orderId = '8f38af74-57af-4e9c-b44b-2deac0b9f2aa';
    const lineId = '870f8de6-9332-4db4-bc0f-8102be509fe8';
    const createdOrder = toOrderDto(
      createOrderRow({
        id: orderId,
        externalNumber: 'ORD-SVC-100',
        status: 'draft',
        waveId: null
      }),
      null,
      []
    );
    const transitionedOrder = {
      ...createdOrder,
      status: 'ready' as const
    };
    const createdLine = {
      id: lineId,
      orderId,
      tenantId,
      productId: productRow.id,
      sku: productRow.sku,
      name: productRow.name,
      qtyRequired: 2,
      qtyPicked: 0,
      status: 'pending' as const
    };

    const ordersService = {
      createOrder: vi.fn(async () => createdOrder),
      addOrderLine: vi.fn(async () => createdLine),
      removeOrderLine: vi.fn(async () => undefined),
      transitionOrderStatus: vi.fn(async () => transitionedOrder)
    };
    const getOrdersService = vi.fn(() => ordersService as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(
        () =>
          ({
            from: vi.fn(),
            rpc: vi.fn()
          }) as never
      ),
      getOrdersService
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        externalNumber: 'ORD-SVC-100'
      }
    });
    expect(createResponse.statusCode).toBe(200);

    const addLineResponse = await app.inject({
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
    expect(addLineResponse.statusCode).toBe(201);

    const removeLineResponse = await app.inject({
      method: 'DELETE',
      url: `/api/orders/${orderId}/lines/${lineId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(removeLineResponse.statusCode).toBe(204);

    const transitionResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${orderId}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'ready'
      }
    });
    expect(transitionResponse.statusCode).toBe(200);

    expect(getOrdersService).toHaveBeenCalledTimes(4);
    expect(ordersService.createOrder).toHaveBeenCalledWith({
      tenantId,
      externalNumber: 'ORD-SVC-100',
      priority: 0,
      waveId: undefined
    });
    expect(ordersService.addOrderLine).toHaveBeenCalledWith({
      tenantId,
      orderId,
      productId: productRow.id,
      qtyRequired: 2
    });
    expect(ordersService.removeOrderLine).toHaveBeenCalledWith({
      orderId,
      lineId
    });
    expect(ordersService.transitionOrderStatus).toHaveBeenCalledWith({
      orderId,
      status: 'ready'
    });

    await app.close();
  });

  it('delegates waves command routes to waves service factory', async () => {
    const waveId = '0f0d9d43-b9ff-4f9f-abde-1846a998c298';
    const orderId = '08c6f61c-9f0c-4b01-af9f-57076d18b2cf';
    const createdWave = toWaveDto(
      {
        ...waveDraftRow,
        id: waveId,
        name: 'Wave Service Delegation'
      },
      []
    );
    const transitionedWave = {
      ...createdWave,
      status: 'ready' as const
    };

    const wavesService = {
      createWave: vi.fn(async () => createdWave),
      transitionWaveStatus: vi.fn(async () => transitionedWave),
      attachOrderToWave: vi.fn(async () => transitionedWave),
      detachOrderFromWave: vi.fn(async () => transitionedWave)
    };
    const getWavesService = vi.fn(() => wavesService as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(
        () =>
          ({
            from: vi.fn(),
            rpc: vi.fn()
          }) as never
      ),
      getWavesService
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/waves',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        name: 'Wave Service Delegation'
      }
    });
    expect(createResponse.statusCode).toBe(200);

    const transitionResponse = await app.inject({
      method: 'PATCH',
      url: `/api/waves/${waveId}/status`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        status: 'ready'
      }
    });
    expect(transitionResponse.statusCode).toBe(200);

    const attachResponse = await app.inject({
      method: 'POST',
      url: `/api/waves/${waveId}/orders`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        orderId
      }
    });
    expect(attachResponse.statusCode).toBe(200);

    const detachResponse = await app.inject({
      method: 'DELETE',
      url: `/api/waves/${waveId}/orders/${orderId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(detachResponse.statusCode).toBe(200);

    expect(getWavesService).toHaveBeenCalledTimes(4);
    expect(wavesService.createWave).toHaveBeenCalledWith({
      tenantId,
      name: 'Wave Service Delegation'
    });
    expect(wavesService.transitionWaveStatus).toHaveBeenCalledWith({
      waveId,
      status: 'ready'
    });
    expect(wavesService.attachOrderToWave).toHaveBeenCalledWith({
      waveId,
      orderId
    });
    expect(wavesService.detachOrderFromWave).toHaveBeenCalledWith({
      waveId,
      orderId
    });

    await app.close();
  });

  it('serves waves list and detail reads through repo-backed routes without using waves service', async () => {
    const listedWave = {
      ...waveDraftRow,
      orders: [{ status: 'ready' }]
    };
    const detailOrderRow = buildOrderSummaryRow(
      createOrderRow({
        id: 'd3496cc8-8bb5-4260-99d6-67d33ab7a22a',
        externalNumber: 'ORD-WAVE-READ-1',
        status: 'ready',
        waveId: waveDraftRow.id
      }),
      waveDraftRow.name
    );
    const detailWave = toWaveDto(
      {
        ...waveDraftRow,
        id: waveDraftRow.id
      },
      [detailOrderRow]
    );

    const wavesSelect = vi.fn((columns: string) => {
      if (columns.includes('orders(status)')) {
        return {
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [listedWave],
              error: null
            }))
          }))
        };
      }

      if (columns === 'id,tenant_id,name,status,created_at,released_at,closed_at') {
        return {
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: waveDraftRow,
              error: null
            }))
          }))
        };
      }

      throw new Error(`Unexpected waves select: ${columns}`);
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'waves') {
          return {
            select: wavesSelect
          };
        }

        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [detailOrderRow],
                  error: null
                }))
              }))
            }))
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc: vi.fn()
    };

    const getWavesService = vi.fn(() => ({
      createWave: vi.fn(),
      transitionWaveStatus: vi.fn(),
      attachOrderToWave: vi.fn(),
      detachOrderFromWave: vi.fn()
    }) as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
      getWavesService
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/waves',
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id: waveDraftRow.id,
        tenantId,
        name: waveDraftRow.name,
        status: waveDraftRow.status,
        createdAt: waveDraftRow.created_at,
        releasedAt: waveDraftRow.released_at,
        closedAt: waveDraftRow.closed_at,
        totalOrders: 1,
        readyOrders: 1,
        blockingOrderCount: 0
      }
    ]);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/waves/${detailWave.id}`,
      headers: {
        authorization: 'Bearer token'
      }
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toEqual(detailWave);

    expect(getWavesService).not.toHaveBeenCalled();

    await app.close();
  });

  it('attaches an editable order to an editable wave', async () => {
    const orderId = '6f96d767-1662-4f9f-b7a0-8a3d111f7b40';
    let order = createOrderRow({
      id: orderId,
      externalNumber: 'ORD-5001',
      status: 'draft',
      waveId: null
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
            select: vi.fn(() => ({
              eq: vi.fn((column: string) => {
                if (column !== 'wave_id') {
                  throw new Error(`Unexpected orders filter column: ${column}`);
                }

                return {
                  order: vi.fn(async () => ({
                    data: order.wave_id === waveDraftRow.id ? [buildOrderSummaryRow(order, waveDraftRow.name)] : [],
                    error: null
                  }))
                };
              })
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'attach_order_to_wave') {
          expect(args).toEqual({
            wave_uuid: waveDraftRow.id,
            order_uuid: orderId
          });
          order = {
            ...order,
            wave_id: waveDraftRow.id
          };
          return { data: orderId, error: null };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: `/api/waves/${waveDraftRow.id}/orders`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        orderId
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      toWaveDto(waveDraftRow, [buildOrderSummaryRow(order, waveDraftRow.name)])
    );
    expect(supabase.rpc).toHaveBeenCalledWith('attach_order_to_wave', {
      wave_uuid: waveDraftRow.id,
      order_uuid: orderId
    });

    await app.close();
  });

  it('detaches an order from a wave and returns updated wave contract', async () => {
    const orderId = '8dea2f29-b8e6-40d0-92eb-5118e6177d36';
    let order = createOrderRow({
      id: orderId,
      externalNumber: 'ORD-5002',
      status: 'ready',
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
            select: vi.fn(() => ({
              eq: vi.fn((column: string) => {
                if (column !== 'wave_id') {
                  throw new Error(`Unexpected orders filter column: ${column}`);
                }

                return {
                  order: vi.fn(async () => ({
                    data: order.wave_id === waveDraftRow.id ? [buildOrderSummaryRow(order, waveDraftRow.name)] : [],
                    error: null
                  }))
                };
              })
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null }))
          }))
        };
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'detach_order_from_wave') {
          expect(args).toEqual({
            wave_uuid: waveDraftRow.id,
            order_uuid: orderId
          });
          order = {
            ...order,
            wave_id: null
          };
          return { data: orderId, error: null };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/waves/${waveDraftRow.id}/orders/${orderId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(toWaveDto(waveDraftRow, []));
    expect(supabase.rpc).toHaveBeenCalledWith('detach_order_from_wave', {
      wave_uuid: waveDraftRow.id,
      order_uuid: orderId
    });

    await app.close();
  });

  it('rejects detach when order is not attached to the requested wave', async () => {
    const orderId = '117f4d37-cf2b-45bc-a234-cf034eaf70d8';

    const supabase = {
      from: vi.fn(() => {
        throw new Error('from() should not be used when detach RPC fails');
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'detach_order_from_wave') {
          expect(args).toEqual({
            wave_uuid: waveDraftRow.id,
            order_uuid: orderId
          });
          return { data: null, error: { message: 'ORDER_NOT_IN_WAVE', code: 'P0001' } };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/waves/${waveDraftRow.id}/orders/${orderId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_NOT_IN_WAVE',
      message: 'Order is not attached to this wave.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('detach_order_from_wave', {
      wave_uuid: waveDraftRow.id,
      order_uuid: orderId
    });
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });

  it('locks wave membership after release', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('from() should not be used when attach RPC fails');
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'attach_order_to_wave') {
          expect(args).toEqual({
            wave_uuid: waveReleasedRow.id,
            order_uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
          });
          return { data: null, error: { message: 'WAVE_MEMBERSHIP_LOCKED', code: 'P0001' } };
        }

        return { data: null, error: null };
      })
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
      code: 'WAVE_MEMBERSHIP_LOCKED',
      message: 'Released waves have immutable membership.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('attach_order_to_wave', {
      wave_uuid: waveReleasedRow.id,
      order_uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    });
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });

  it('maps attach rpc ORDER_NOT_ATTACHABLE to stable HTTP contract', async () => {
    const orderId = 'ce8bc2e7-02e2-46f7-a07e-0ca50bc49baf';
    const supabase = {
      from: vi.fn(() => {
        throw new Error('from() should not be used when attach RPC fails');
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'attach_order_to_wave') {
          expect(args).toEqual({
            wave_uuid: waveDraftRow.id,
            order_uuid: orderId
          });
          return { data: null, error: { message: 'ORDER_NOT_ATTACHABLE', code: 'P0001' } };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'POST',
      url: `/api/waves/${waveDraftRow.id}/orders`,
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        orderId
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_NOT_ATTACHABLE',
      message: 'Only draft or ready orders can be attached to a wave.'
    });
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });

  it('maps detach rpc ORDER_NOT_DETACHABLE to stable HTTP contract', async () => {
    const orderId = '3635f3e4-b811-4950-a9a0-ec9c1bc4dd1c';
    const supabase = {
      from: vi.fn(() => {
        throw new Error('from() should not be used when detach RPC fails');
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'detach_order_from_wave') {
          expect(args).toEqual({
            wave_uuid: waveDraftRow.id,
            order_uuid: orderId
          });
          return { data: null, error: { message: 'ORDER_NOT_DETACHABLE', code: 'P0001' } };
        }

        return { data: null, error: null };
      })
    };

    const app = createAppWithSupabase(supabase);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/waves/${waveDraftRow.id}/orders/${orderId}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'ORDER_NOT_DETACHABLE',
      message: 'Only draft or ready orders can be detached from a wave.'
    });
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });
});
