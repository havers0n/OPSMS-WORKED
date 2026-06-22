import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequestContext } from './auth.js';
import { buildApp } from './app.js';

type WarehouseStockSnapshotLookup = {
  getLatestCompletedSnapshot: ReturnType<typeof vi.fn>;
};

type CapturedFactoryArgs = {
  supabase: unknown;
  bondedService: unknown;
  warehouseStockService: WarehouseStockSnapshotLookup | undefined;
};

const authContext: AuthenticatedRequestContext = {
  accessToken: 'token',
  user: {
    id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d',
    email: 'operator@wos.local',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-06-11T07:00:00.000Z'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
};

var capturedFactoryArgs: CapturedFactoryArgs | null = null;

const warehouseStockService = {
  getLatestCompletedSnapshot: vi.fn(async (tenantId: string, planningDate: string) => ({
    id: '4b5bcafb-b89f-47c7-8180-fc21e6e82cb1',
    planningDate,
    importedAt: '2026-06-11T08:00:00.000Z',
    fileName: 'פיבוט מילניום 2026.xlsx',
    sourceRowCount: 1348,
    uniqueSkuCount: 300,
    status: 'completed',
    rows: [
      {
        sku: '519526',
        availableQty: 300
      }
    ]
  }))
} satisfies WarehouseStockSnapshotLookup;

const bondedService = {
  getLatestCompletedSnapshot: vi.fn(async () => null)
} as never;

vi.mock('./features/manual-shifts/service.js', () => ({
  createManualShiftsService: vi.fn((supabase: unknown, bonded: unknown, stock: WarehouseStockSnapshotLookup | undefined) => {
    capturedFactoryArgs = {
      supabase,
      bondedService: bonded,
      warehouseStockService: stock
    };

    return {
      async getProductControl(input: { tenantId: string; shiftId: string }) {
        const snapshot = stock ? await stock.getLatestCompletedSnapshot(input.tenantId, '2026-06-11') : null;

        return {
          shiftId: input.shiftId,
          generatedAt: '2026-06-11T12:00:00.000Z',
          rows: [
            {
              sku: '519526',
              description: 'כסא במאי ירוק/כחול/אדום',
              category: 'קמפינג',
              demandQty: 564,
              warehouseQty: 300,
              shortageQty: 264,
              bondedAvailableQty: 2979,
              bondedCoverQty: 264,
              finalMissingQty: 0,
              surplusQty: 0,
              status: 'covered_by_bonded' as const,
              affectedOrdersCount: 1,
              affectedLinesCount: 1
            }
          ],
          totals: {
            totalSkus: 1,
            shortageSkus: 1,
            coveredByBondedSkus: 1,
            partialBondedSkus: 0,
            unresolvedSkus: 0,
            dataIssueSkus: 0
          },
          bondedSnapshot: null,
          warehouseStockSnapshot: snapshot
        };
      }
    };
  })
}));

async function buildTestApp() {
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getUserSupabase: () => ({}) as never,
    getBondedService: () => bondedService,
    getWarehouseStockService: () => warehouseStockService as never
  });

  await app.ready();
  return app;
}

describe('manual shifts product control app wiring', () => {
  it('passes WarehouseStockService from buildApp into the product-control service factory', async () => {
    capturedFactoryArgs = null;
    vi.mocked(warehouseStockService.getLatestCompletedSnapshot).mockClear();

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/manual-shifts/33333333-3333-4333-8333-333333333333/product-control'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.warehouseStockSnapshot).toEqual({
      id: '4b5bcafb-b89f-47c7-8180-fc21e6e82cb1',
      planningDate: '2026-06-11',
      importedAt: '2026-06-11T08:00:00.000Z',
      fileName: 'פיבוט מילניום 2026.xlsx',
      sourceRowCount: 1348,
      uniqueSkuCount: 300
    });
    expect(body.rows[0]).toMatchObject({
      sku: '519526',
      demandQty: 564,
      warehouseQty: 300,
      shortageQty: 264,
      bondedAvailableQty: 2979,
      bondedCoverQty: 264,
      finalMissingQty: 0,
      status: 'covered_by_bonded'
    });

    expect(capturedFactoryArgs).toMatchObject({
      warehouseStockService
    });
    if (!capturedFactoryArgs) {
      throw new Error('Expected manual shifts factory args to be captured.');
    }
    const factoryArgs = capturedFactoryArgs as CapturedFactoryArgs;
    expect(factoryArgs.bondedService).toBe(bondedService);
    expect(factoryArgs.supabase).toBeDefined();
    expect(vi.mocked(warehouseStockService.getLatestCompletedSnapshot)).toHaveBeenCalledWith(
      authContext.currentTenant!.tenantId,
      '2026-06-11'
    );

    await app.close();
  });
});
