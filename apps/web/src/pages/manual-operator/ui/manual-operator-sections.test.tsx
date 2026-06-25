import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';
import { routes } from '@/shared/config/routes';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

let isDesktop = false;

vi.mock('@/shared/hooks/use-media-query', () => ({
  useMediaQuery: () => isDesktop
}));

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => ({
    currentTenantId: 'tenant-1',
    memberships: [
      {
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default',
        role: 'tenant_admin'
      }
    ]
  })
}));

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const shift = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-06-17',
  name: 'Morning Shift',
  status: 'active' as const,
  createdBy: null,
  createdAt: new Date().toISOString(),
  closedAt: null
};

const line = {
  id: 'line-1',
  tenantId: 'tenant-1',
  shiftId: shift.id,
  name: 'Line A',
  sortOrder: 1,
  status: 'open' as const,
  createdAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null
};

const lineSummary = {
  line,
  totalOrders: 1,
  queuedOrders: 1,
  pickingOrders: 0,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

const waitingOrder = {
  id: 'order-1',
  tenantId: 'tenant-1',
  shiftId: shift.id,
  lineId: line.id,
  orderNumber: '502481',
  customerName: null,
  pointName: 'Point A',
  palletCount: 1,
  pickerName: 'Picker A',
  pickerWorkerId: null,
  checkerName: null,
  lineCount: 5,
  size: 'M',
  status: 'waiting_check' as const,
  startedAt: null,
  waitingCheckAt: new Date().toISOString(),
  checkedAt: null,
  finishedAt: null,
  comment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null,
  checkStartedAt: null
};

const workHierarchy = {
  shiftId: shift.id,
  areas: [
    {
      areaName: 'south',
      displayName: 'South',
      totalLines: 1,
      totalBuckets: 1,
      totalOrders: 1,
      totalQuantity: 5,
      statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
      lines: [
        {
          lineId: line.id,
          lineGroupName: line.name,
          distributionArea: 'South',
          status: 'open',
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
          buckets: [
            {
              bucketName: 'Point A',
              displayName: 'Point A',
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
              orders: [
                {
                  orderId: waitingOrder.id,
                  orderNumber: waitingOrder.orderNumber,
                  customerName: waitingOrder.customerName,
                  pointName: waitingOrder.pointName,
                  status: waitingOrder.status,
                  lineCount: 2,
                  totalQuantity: 5,
                  hasAshlama: false,
                  hasCheckUnits: false
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={makeQueryClient()}>
        <LocationProbe />
        <ManualOperatorPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function mockWorkspaceData(options?: {
  lines?: (typeof lineSummary)[];
  daySummary?: Record<string, unknown>;
  orders?: unknown[];
  workers?: unknown[];
  peopleSummaryItems?: unknown[];
  workHierarchyData?: Record<string, unknown>;
  productRollupResolver?: (url: URL) => unknown;
}) {
  const lines = options?.lines ?? [lineSummary];
  const daySummary =
    options?.daySummary ??
    ({
      shiftId: shift.id,
      totalOrders: 1,
      queuedOrders: 1,
      pickingOrders: 0,
      waitingCheckOrders: 0,
      returnedOrders: 0,
      doneOrders: 0,
      errorsCount: 0,
      byErrorType: [],
      byLine: lines,
      byPicker: []
    } satisfies Record<string, unknown>);
  const orders = options?.orders ?? [waitingOrder];
  const workers =
    options?.workers ?? [{ id: 'worker-1', name: 'Picker A', role: 'picker', active: true, authUserId: null }];
  const peopleSummaryItems = options?.peopleSummaryItems ?? [];
  const workHierarchyData = options?.workHierarchyData ?? workHierarchy;

  mockedBffRequest.mockImplementation((url: string) => {
    const path = String(url);
    if (path.includes('/api/manual-shifts/by-date')) return Promise.resolve({ shift, lines });
    if (path.endsWith(`/api/manual-shifts/${shift.id}/work-hierarchy`)) return Promise.resolve(workHierarchyData);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/day-summary`)) return Promise.resolve(daySummary);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/orders`)) return Promise.resolve(orders);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/workers`)) return Promise.resolve(workers);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/people-summary`)) {
      return Promise.resolve({ shiftId: shift.id, items: peopleSummaryItems });
    }
    if (path.endsWith('/api/manual-shifts/worker-bindable-users')) return Promise.resolve([]);
    if (path.includes('/open-ashlamot')) return Promise.resolve([]);
    if (path.includes('/check-units')) return Promise.resolve([]);
    if (path.includes('/ashlamot')) return Promise.resolve([]);
    if (path.endsWith(`/api/manual-shift-lines/${line.id}/orders`)) return Promise.resolve([]);
    if (path.includes(`/api/manual-shifts/${shift.id}/product-control`)) {
      return Promise.resolve({
        shiftId: shift.id,
        generatedAt: new Date().toISOString(),
        rows: [
          {
            sku: '100001',
            description: 'מחברת A4 100 דפים',
            category: 'ניירת',
            demandQty: 500,
            warehouseQty: 500,
            shortageQty: 0,
            bondedAvailableQty: 0,
            bondedCoverQty: 0,
            finalMissingQty: 0,
            surplusQty: 0,
            status: 'ok'
          }
        ],
        totals: { totalSkus: 1, shortageSkus: 0, coveredByBondedSkus: 0, partialBondedSkus: 0, unresolvedSkus: 0, dataIssueSkus: 0 }
      });
    }
    if (path.includes(`/api/manual-shifts/${shift.id}/buckets/product-rollup`)) {
      const parsedUrl = new URL(path, 'http://localhost');
      return Promise.resolve(
        options?.productRollupResolver?.(parsedUrl) ?? {
          shiftId: shift.id,
          generatedAt: new Date().toISOString(),
          products: []
        }
      );
    }
    return Promise.resolve([]);
  });
}

const sharedPhysicalLineId = 'de488c8d-d17a-43d7-9f4c-fc01645b225b';

function makeAreaScopedRouteGroupHierarchy() {
  return {
    shiftId: shift.id,
    areas: [
      {
        areaName: 'שפלה 2',
        displayName: 'שפלה 2',
        totalLines: 1,
        totalBuckets: 1,
        totalOrders: 1,
        totalQuantity: 5,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [
          {
            lineId: sharedPhysicalLineId,
            areaLineKey: `שפלה 2\u0001${sharedPhysicalLineId}`,
            lineGroupName: 'שפלה 2 כללי',
            distributionArea: 'שפלה 2',
            sourceZone: 'שפלה 2',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: [
              {
                routeGroupKey: 'rg-shefela-general',
                routeGroupName: 'שפלה 2 כללי',
                routeGroupKind: 'general',
                classificationConfidence: 'high',
                classificationReasons: [],
                orderCount: 1,
                itemLinesCount: 1,
                totalQuantity: 5,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                workBuckets: [
                  {
                    workBucketKey: 'wb-cellular',
                    workBucketName: 'סלולר',
                    workBucketDisplayName: 'סלולר',
                    workBucketKind: 'category',
                    classificationConfidence: 'high',
                    classificationReasons: [],
                    orderCount: 1,
                    itemLinesCount: 1,
                    totalQuantity: 5,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'order-shefela-2',
                        orderNumber: 'SO_A',
                        customerName: 'Customer A',
                        pointName: 'סלולר',
                        status: 'queued',
                        lineCount: 1,
                        totalQuantity: 5,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        areaName: 'שפלה אמצעי',
        displayName: 'שפלה אמצעי',
        totalLines: 1,
        totalBuckets: 1,
        totalOrders: 1,
        totalQuantity: 7,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [
          {
            lineId: sharedPhysicalLineId,
            areaLineKey: `שפלה אמצעי\u0001${sharedPhysicalLineId}`,
            lineGroupName: 'שפלה 2 כללי',
            distributionArea: 'שפלה אמצעי',
            sourceZone: 'שפלה אמצעי',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 7,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: [
              {
                routeGroupKey: 'rg-shefela-general',
                routeGroupName: 'שפלה 2 כללי',
                routeGroupKind: 'general',
                classificationConfidence: 'high',
                classificationReasons: [],
                orderCount: 1,
                itemLinesCount: 1,
                totalQuantity: 7,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                workBuckets: [
                  {
                    workBucketKey: 'wb-cellular',
                    workBucketName: 'סלולר',
                    workBucketDisplayName: 'סלולר',
                    workBucketKind: 'category',
                    classificationConfidence: 'high',
                    classificationReasons: [],
                    orderCount: 1,
                    itemLinesCount: 1,
                    totalQuantity: 7,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'order-shefela-center',
                        orderNumber: 'SO_B',
                        customerName: 'Customer B',
                        pointName: 'סלולר',
                        status: 'queued',
                        lineCount: 1,
                        totalQuantity: 7,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

async function openDesktopRouteGroupBucket(areaName: 'שפלה 2' | 'שפלה אמצעי') {
  await waitFor(() => {
    expect(screen.getByTestId(`area-card-${areaName}`)).toBeTruthy();
  });
  fireEvent.click(screen.getByTestId(`area-card-${areaName}`));
  await waitFor(() => {
    expect(screen.getByTestId('route-group-card-rg-shefela-general')).toBeTruthy();
  });
  fireEvent.click(screen.getByTestId('route-group-card-rg-shefela-general'));
  await waitFor(() => {
    expect(screen.getByTestId('work-bucket-card-wb-cellular')).toBeTruthy();
  });
  fireEvent.click(screen.getByTestId('work-bucket-card-wb-cellular'));
}

function getProductRollupSearchParams() {
  return mockedBffRequest.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes(`/api/manual-shifts/${shift.id}/buckets/product-rollup`))
    .map((url) => new URL(url, 'http://localhost').searchParams);
}

function getProductRollupSourceZones() {
  return getProductRollupSearchParams().map((params) => params.get('sourceZone'));
}

function makeChitaHierarchy() {
  const bucketSpecs = [
    { name: 'דרום', lineCount: 2, totalQuantity: 21 },
    { name: 'חיפה', lineCount: 3, totalQuantity: 18 },
    { name: 'עמקים אמצעי', lineCount: 2, totalQuantity: 16 },
    { name: "צ'יטה", lineCount: 2, totalQuantity: 17 },
    { name: 'שפלה 1', lineCount: 2, totalQuantity: 14 },
    { name: 'שפלה 2', lineCount: 3, totalQuantity: 20 },
    { name: 'שפלה אמצעי', lineCount: 2, totalQuantity: 16 }
  ] as const;

  return {
    shiftId: shift.id,
    areas: [
      {
        areaName: "צ'יטה",
        displayName: "צ'יטה",
        totalLines: 1,
        totalBuckets: bucketSpecs.length,
        totalOrders: bucketSpecs.length,
        totalQuantity: 122,
        statusBreakdown: { queued: 7, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [
          {
            lineId: 'line-chita-1',
            areaLineKey: `צ'יטה\u0001line-chita-1`,
            lineGroupName: "צ'יטה",
            lineKind: 'delivery_channel',
            distributionArea: "צ'יטה",
            status: 'open',
            totalBuckets: bucketSpecs.length,
            totalOrders: bucketSpecs.length,
            totalQuantity: 122,
            statusBreakdown: { queued: 7, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: bucketSpecs.map((bucketSpec, index) => ({
              bucketName: bucketSpec.name,
              displayName: bucketSpec.name,
              totalOrders: 1,
              totalQuantity: bucketSpec.totalQuantity,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              orders: [
                {
                  orderId: `chita-order-${index + 1}`,
                  orderNumber: `CH-${index + 1}`,
                  customerName: `Chita customer ${index + 1}`,
                  pointName: bucketSpec.name,
                  sourceZone: bucketSpec.name,
                  status: 'queued',
                  lineCount: bucketSpec.lineCount,
                  totalQuantity: bucketSpec.totalQuantity,
                  hasAshlama: false,
                  hasCheckUnits: false
                }
              ]
            })),
            routeGroups: []
          }
        ]
      }
    ]
  };
}

function makeChitaAndNormalHierarchy() {
  return {
    shiftId: shift.id,
    areas: [
      {
        areaName: "צ'יטה",
        displayName: "צ'יטה",
        totalLines: 1,
        totalBuckets: 1,
        totalOrders: 1,
        totalQuantity: 21,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [
          {
            lineId: 'line-chita-1',
            areaLineKey: "צ'יטה\u0001line-chita-1",
            lineGroupName: "צ'יטה",
            lineKind: 'delivery_channel',
            distributionArea: "צ'יטה",
            status: 'open',
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 21,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [
              {
                bucketName: 'Point A',
                displayName: 'Point A',
                totalOrders: 1,
                totalQuantity: 21,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [
                  {
                    orderId: 'chita-order-1',
                    orderNumber: 'CH-1',
                    customerName: 'Chita customer 1',
                    pointName: 'Point A',
                    sourceZone: 'Point A',
                    status: 'queued',
                    lineCount: 2,
                    totalQuantity: 21,
                    hasAshlama: false,
                    hasCheckUnits: false
                  }
                ]
              }
            ],
            routeGroups: []
          }
        ]
      },
      {
        areaName: 'south',
        displayName: 'South',
        totalLines: 1,
        totalBuckets: 1,
        totalOrders: 1,
        totalQuantity: 5,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [
          {
            lineId: 'line-south-1',
            areaLineKey: 'south\u0001line-south-1',
            lineGroupName: 'South',
            distributionArea: 'South',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [
              {
                bucketName: 'Point South',
                displayName: 'Point South',
                totalOrders: 1,
                totalQuantity: 5,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [
                  {
                    orderId: 'south-order-1',
                    orderNumber: 'SO-1',
                    customerName: 'South customer',
                    pointName: 'Point South',
                    sourceZone: 'Point South',
                    status: 'queued',
                    lineCount: 1,
                    totalQuantity: 5,
                    hasAshlama: false,
                    hasCheckUnits: false
                  }
                ]
              }
            ],
            routeGroups: []
          }
        ]
      }
    ]
  };
}

describe('ManualOperatorPage URL sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDesktop = false;
  });

  it.each([
    routes.operatorManualWork,
    routes.operatorManualSummary,
    routes.operatorManualCheck,
    routes.operatorManualPeople,
    routes.operatorManualProducts,
    routes.operatorManualAshlamot,
    routes.operatorManualPrinting,
    routes.operatorManualImport,
    routes.operatorManualLines
  ])('renders %s content', async (path) => {
    mockWorkspaceData();
    renderAt(path);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(path);
    });

    expect(screen.getByTestId('manual-section-switcher-trigger')).toBeTruthy();
  });

  it('shows the current section label in the switcher trigger', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualImport);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualImport);
    });

    expect(screen.getByTestId('manual-section-switcher-trigger').textContent).toContain('ייבוא');
  });

  it('opens the grouped switcher panel, highlights the active section, and navigates', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualWork);
    });

    fireEvent.click(screen.getByTestId('manual-section-switcher-trigger'));

    expect(screen.getByTestId('manual-section-switcher-panel')).toBeTruthy();
    expect(screen.getByText('תהליך עבודה')).toBeTruthy();
    expect(screen.getByText('ניהול ובקרה')).toBeTruthy();
    expect(screen.getByText('נתונים ותכנון')).toBeTruthy();
    expect(screen.getByTestId('manual-section-work').getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByTestId('manual-section-import'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualImport);
    });

    expect(screen.queryByTestId('manual-section-switcher-panel')).toBeNull();
  });

  it('navigates to printing from the switcher', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualWork);
    });

    fireEvent.click(screen.getByTestId('manual-section-switcher-trigger'));
    fireEvent.click(screen.getByTestId('manual-section-printing'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualPrinting);
    });
  });

  it('closes the switcher on Escape and outside click', async () => {
    isDesktop = true;
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('manual-section-switcher-trigger')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('manual-section-switcher-trigger'));
    expect(screen.getByTestId('manual-section-switcher-panel')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('manual-section-switcher-panel')).toBeNull();
    });

    fireEvent.click(screen.getByTestId('manual-section-switcher-trigger'));
    expect(screen.getByTestId('manual-section-switcher-panel')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByTestId('manual-section-switcher-panel')).toBeNull();
    });
  });

  it('shows work distribution filters only on the work section', async () => {
    isDesktop = true;
    mockWorkspaceData({
      workHierarchyData: {
        shiftId: shift.id,
        areas: [
          {
            areaName: 'galil',
            displayName: 'גליל',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: []
          },
          {
            areaName: 'jerusalem-2',
            displayName: 'ירושלים 2',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: []
          }
        ]
      }
    });
    const renderResult = renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('manual-work-filters')).toBeTruthy();
    });

    expect(screen.getByTestId('manual-work-filter-galil')).toBeTruthy();
    expect(screen.getByTestId('manual-work-filter-jerusalem-2')).toBeTruthy();

    renderResult.unmount();
    mockWorkspaceData();
    renderAt(routes.operatorManualImport);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualImport);
    });

    expect(screen.queryByTestId('manual-work-filters')).toBeNull();
  });

  it('renders product control for products section without mutating data', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualProducts);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualProducts);
    });

    await waitFor(() => {
      expect(screen.getByText('חוסרים להיום + כיסוי בונדד')).toBeTruthy();
    });
    expect(screen.queryByText('המסך הזה עדיין לא מחובר')).toBeNull();
    expect(screen.queryByTestId('manual-placeholder-products')).toBeNull();
    expect(
      mockedBffRequest.mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')
    ).toBe(false);
  });

  it('renders the import route instead of the disconnected placeholder', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualImport);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualImport);
    });

    await waitFor(() => {
      expect(screen.getByTestId('manual-import-section')).toBeTruthy();
    });

    expect(screen.queryByText('המסך הזה עדיין לא מחובר')).toBeNull();
    expect(screen.queryByTestId('manual-placeholder-import')).toBeNull();
    expect(screen.getByText('ייבוא נתונים')).toBeTruthy();
    expect(screen.getByText('טעינת קובץ בונדד')).toBeTruthy();
    expect(screen.getAllByText(/קובץ הבונדד אינו כולל תאריך/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'פתיחת ייבוא יומי' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'פתיחת החלפת ייבוא לפי תאריך' })).toBeTruthy();
  });

  it('keeps the import section available even when no shift exists', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/by-date')) return Promise.resolve({ shift: null, lines: [] });
      return Promise.resolve([]);
    });

    renderAt(routes.operatorManualImport);

    await waitFor(() => {
      expect(screen.getByTestId('manual-import-section')).toBeTruthy();
    });

    expect(screen.getByText('ייבוא נתונים')).toBeTruthy();
    expect(screen.getByText('טעינת קובץ בונדד')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'פתיחת ייבוא יומי' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'פתיחת ייבוא הזמנות לתאריך נבחר' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens the bonded import sheet from the import route entry point', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualImport);

    await waitFor(() => {
      expect(screen.getByTestId('open-bonded-import-sheet')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('open-bonded-import-sheet'));

    await waitFor(() => {
      expect(screen.getAllByText('טעינת קובץ בונדד').length).toBeGreaterThan(1);
    });
  });

  it('renders printing section instead of placeholder', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualPrinting);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualPrinting);
    });

    await waitFor(() => {
      expect(screen.getByTestId('manual-printing-section')).toBeTruthy();
    });

    expect(screen.queryByText('המסך הזה עדיין לא מחובר')).toBeNull();
    expect(screen.queryByTestId('manual-placeholder-printing')).toBeNull();
    expect(screen.getByText('הדפסת מסמכים')).toBeTruthy();
  });

  it('still renders placeholders for other unimplemented sections', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualAshlamot);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualAshlamot);
    });

    await waitFor(() => {
      expect(screen.getByTestId('manual-placeholder-ashlamot')).toBeTruthy();
    });
    expect(
      mockedBffRequest.mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')
    ).toBe(false);
  });

  it('falls back from an invalid section to work', async () => {
    mockWorkspaceData();
    renderAt('/operator/manual/not-a-real-section');

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualWork);
    });
  });

  it.each([
    routes.operatorManualWork,
    routes.operatorManualSummary,
    routes.operatorManualCheck,
    routes.operatorManualPeople,
    routes.operatorManualImport
  ])('desktop renders %s safely', async (path) => {
    isDesktop = true;
    mockWorkspaceData();
    renderAt(path);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(path);
    });
  });

  it('desktop work route requests work hierarchy', async () => {
    isDesktop = true;
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(`/api/manual-shifts/${shift.id}/work-hierarchy`);
    });
  });

  it('scopes desktop orders by areaLineKey when the same physical line exists under two areas', async () => {
    isDesktop = true;
    const scopedHierarchy = makeAreaScopedRouteGroupHierarchy();

    mockWorkspaceData({ workHierarchyData: scopedHierarchy });
    const firstRender = renderAt(routes.operatorManualWork);

    await openDesktopRouteGroupBucket('שפלה 2');
    fireEvent.click(screen.getByTestId('tab-orders'));
    await waitFor(() => {
      expect(screen.getByText('SO_A')).toBeTruthy();
    });
    expect(screen.queryByText('SO_B')).toBeNull();

    firstRender.unmount();

    mockWorkspaceData({ workHierarchyData: scopedHierarchy });
    renderAt(routes.operatorManualWork);

    await openDesktopRouteGroupBucket('שפלה אמצעי');
    fireEvent.click(screen.getByTestId('tab-orders'));
    await waitFor(() => {
      expect(screen.getByText('SO_B')).toBeTruthy();
    });
    expect(screen.queryByText('SO_A')).toBeNull();
  });

  it('sends the correct sourceZone in desktop product rollup queries for each area projection', async () => {
    isDesktop = true;
    const scopedHierarchy = makeAreaScopedRouteGroupHierarchy();

    mockWorkspaceData({
      workHierarchyData: scopedHierarchy,
      productRollupResolver: (url) => ({
        shiftId: shift.id,
        generatedAt: new Date().toISOString(),
        products: [{ sku: `sku-${url.searchParams.get('sourceZone')}`, description: 'Scoped product' }]
      })
    });
    const firstRender = renderAt(routes.operatorManualWork);

    await openDesktopRouteGroupBucket('שפלה 2');
    await waitFor(() => {
      expect(getProductRollupSourceZones()).toContain('שפלה 2');
    });

    firstRender.unmount();

    mockWorkspaceData({
      workHierarchyData: scopedHierarchy,
      productRollupResolver: (url) => ({
        shiftId: shift.id,
        generatedAt: new Date().toISOString(),
        products: [{ sku: `sku-${url.searchParams.get('sourceZone')}`, description: 'Scoped product' }]
      })
    });
    renderAt(routes.operatorManualWork);

    await openDesktopRouteGroupBucket('שפלה אמצעי');
    await waitFor(() => {
      expect(getProductRollupSourceZones()).toContain('שפלה אמצעי');
    });
  });

  it('scopes Chita bucket products by sourceZone instead of the empty line scope', async () => {
    isDesktop = true;
    mockWorkspaceData({
      workHierarchyData: makeChitaHierarchy(),
      productRollupResolver: (url) => ({
        shiftId: shift.id,
        generatedAt: new Date().toISOString(),
        products: url.searchParams.get('sourceZone')
          ? [{ sku: `sku-${url.searchParams.get('sourceZone')}`, description: 'Chita scoped product' }]
          : []
      })
    });
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId("special-area-chip-צ'יטה")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("special-area-chip-צ'יטה"));

    await waitFor(() => {
      expect(screen.getByTestId('work-bucket-card-דרום')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('work-bucket-card-דרום'));

    await waitFor(() => {
      expect(getProductRollupSourceZones()).toContain('דרום');
      expect(screen.getByTestId('product-row-sku-דרום')).toBeTruthy();
    });
    expect(screen.queryByText('ЧђЧ™Чџ ЧћЧ•Ч¦ЧЁЧ™Чќ Ч‘Ч§Ч‘Ч•Ч¦ЧЄ ЧўЧ‘Ч•Ч“Ч” Ч–Ч•')).toBeNull();
  });

  it('separates Chita into a special delivery-channel section on the root areas screen', async () => {
    isDesktop = true;
    mockWorkspaceData({ workHierarchyData: makeChitaAndNormalHierarchy() });
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('special-areas-section')).toBeTruthy();
      expect(screen.getByTestId('normal-areas-section')).toBeTruthy();
    });

    expect(screen.getByText('אזורי הפצה')).toBeTruthy();
    expect(screen.getByTestId("special-area-chip-צ'יטה")).toBeTruthy();
    const chips = screen.getAllByText('צ\'יטה');
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('area-card-south')).toBeTruthy();
    expect(within(screen.getByTestId('special-areas-section')).getByTestId("special-area-chip-צ'יטה")).toBeTruthy();
    expect(within(screen.getByTestId('normal-areas-section')).queryByTestId("special-area-chip-צ'יטה")).toBeNull();

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0].textContent).toBe('אזורי הפצה');

    fireEvent.click(screen.getByTestId("special-area-chip-צ'יטה"));
    await waitFor(() => {
      expect(screen.getByTestId('work-bucket-card-Point A')).toBeTruthy();
    });
  });

  it('keeps single-line area auto-skip area-scoped when two areas share the same physical lineId', async () => {
    isDesktop = true;
    const scopedHierarchy = makeAreaScopedRouteGroupHierarchy();

    mockWorkspaceData({
      workHierarchyData: scopedHierarchy,
      productRollupResolver: (url) => ({
        shiftId: shift.id,
        generatedAt: new Date().toISOString(),
        products: [{ sku: `sku-${url.searchParams.get('sourceZone')}`, description: 'Scoped product' }]
      })
    });
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('area-card-שפלה אמצעי')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('area-card-שפלה אמצעי'));
    await waitFor(() => {
      expect(screen.queryByText('קווים')).toBeNull();
      expect(screen.getByTestId('route-group-card-rg-shefela-general')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('route-group-card-rg-shefela-general'));
    await waitFor(() => {
      expect(screen.getByTestId('work-bucket-card-wb-cellular')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('work-bucket-card-wb-cellular'));
    await waitFor(() => {
      expect(getProductRollupSourceZones()).toContain('שפלה אמצעי');
    });
  });

  it('does not regress normal unique-line desktop hierarchy selection', async () => {
    isDesktop = true;
    mockWorkspaceData({
      workHierarchyData: {
        shiftId: shift.id,
        areas: [
          {
            areaName: 'south',
            displayName: 'South',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
            lines: [
              {
                lineId: 'unique-line-1',
                areaLineKey: 'south\u0001unique-line-1',
                lineGroupName: 'Line A',
                distributionArea: 'South',
                sourceZone: 'South',
                status: 'open',
                totalBuckets: 1,
                totalOrders: 1,
                totalQuantity: 5,
                statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'Point A',
                    displayName: 'Point A',
                    totalOrders: 1,
                    totalQuantity: 5,
                    statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: waitingOrder.id,
                        orderNumber: waitingOrder.orderNumber,
                        customerName: waitingOrder.customerName,
                        pointName: waitingOrder.pointName,
                        status: waitingOrder.status,
                        lineCount: 2,
                        totalQuantity: 5,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    });
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('area-card-south')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('area-card-south'));
    await waitFor(() => {
      expect(screen.getByTestId('work-bucket-card-Point A')).toBeTruthy();
    });
  });
});
