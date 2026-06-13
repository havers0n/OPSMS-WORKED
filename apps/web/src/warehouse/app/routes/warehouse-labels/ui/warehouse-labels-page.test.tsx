import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n/i18n-provider';
import { BffRequestError } from '@/shared/api/bff/client';
import type { RackSlotLocationRef, WarehouseLabelPreviewResponse } from '@wos/domain';

const mockUseActiveFloorId = vi.hoisted(() => vi.fn());
const mockUseActiveSiteId = vi.hoisted(() => vi.fn());
const mockPreviewMutate = vi.hoisted(() => vi.fn());
const mockPdfMutate = vi.hoisted(() => vi.fn());
const mockTriggerBlobDownload = vi.hoisted(() => vi.fn());
const mockUseFloors = vi.hoisted(() => vi.fn());
const mockUsePublishedCells = vi.hoisted(() => vi.fn());
const mockUseRackSlotLocationRefs = vi.hoisted(() => vi.fn());

vi.mock('@/app/store/ui-selectors', () => ({
  useActiveFloorId: mockUseActiveFloorId,
  useActiveSiteId: mockUseActiveSiteId
}));

vi.mock('@/entities/floor/api/use-floors', () => ({
  useFloors: mockUseFloors
}));

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: mockUsePublishedCells
}));

vi.mock('@/warehouse/shell/ui/warehouse-top-bar', () => ({
  WarehouseTopBar: () => <div data-testid="warehouse-top-bar">TopBar</div>
}));

vi.mock('../api/warehouse-labels-api', () => ({
  useWarehouseLabelPreview: () => ({
    mutate: mockPreviewMutate,
    mutateAsync: mockPreviewMutate,
    isPending: false,
    data: null,
    error: null
  }),
  useWarehouseLabelPdfDownload: () => ({
    mutate: mockPdfMutate,
    mutateAsync: mockPdfMutate,
    isPending: false,
    data: null,
    error: null
  }),
  useRackSlotLocationRefs: () => mockUseRackSlotLocationRefs(),
  computePreviewFingerprint: (floorId: string, preset: string, selection: unknown) => ({
    floorId,
    selection,
    labelPreset: preset,
    layoutMode: 'single-label-page'
  }),
  fingerprintsMatch: (a: unknown, b: unknown) => {
    if (a === null || b === null) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  },
  triggerBlobDownload: mockTriggerBlobDownload
}));

import { WarehouseLabelsPage } from './warehouse-labels-page';

function renderLabelsPage(initialPath = '/warehouse/labels') {
  window.history.pushState({}, '', initialPath);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <WarehouseLabelsPage />
      </I18nProvider>
    </MemoryRouter>
  );
}

const FLOOR_ID = '11111111-1111-4111-8111-111111111111';
const SITE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const LOCATION_REFS: RackSlotLocationRef[] = [
  { locationId: 'loc-2', cellId: 'cell-1' },
  { locationId: 'loc-1', cellId: 'cell-2' },
  { locationId: 'loc-3', cellId: 'cell-3' }
];

const SAMPLE_PREVIEW: WarehouseLabelPreviewResponse = {
  labelCount: 120,
  pageCount: 120,
  resolvedPreset: { id: 'rack-slot-100x50', widthMm: 100, heightMm: 50 },
  resolvedLayout: { mode: 'single-label-page', pageWidthMm: 100, pageHeightMm: 50, labelsPerPage: 1 },
  sampleLabels: [
    { locationId: '22222222-2222-4222-8222-222222222220', address: '01-A.01.01.01', barcodeValue: 'BC-01' },
    { locationId: '22222222-2222-4222-8222-222222222221', address: '01-A.01.01.02', barcodeValue: 'BC-02' }
  ],
  warnings: ['Some warning message']
};

describe('WarehouseLabelsPage', () => {
  beforeEach(() => {
    mockUseActiveSiteId.mockReturnValue(SITE_ID);
    mockUseActiveFloorId.mockReturnValue(null);
    mockUseFloors.mockReturnValue({ data: [], isLoading: false });
    mockUsePublishedCells.mockReturnValue({
      data: [
        {
          id: 'cell-1',
          layoutVersionId: 'layout-1',
          rackId: 'rack-1',
          rackFaceId: 'face-1',
          rackSectionId: 'section-1',
          rackLevelId: 'level-1',
          slotNo: 1,
          address: { raw: '01-A.01.01.01', parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 }, sortKey: '0001-A-01-01-01' },
          status: 'active',
          cellCode: 'CELL-1'
        },
        {
          id: 'cell-2',
          layoutVersionId: 'layout-1',
          rackId: 'rack-1',
          rackFaceId: 'face-1',
          rackSectionId: 'section-1',
          rackLevelId: 'level-2',
          slotNo: 1,
          address: { raw: '01-A.01.02.01', parts: { rackCode: '01', face: 'A', section: 1, level: 2, slot: 1 }, sortKey: '0001-A-01-02-01' },
          status: 'active',
          cellCode: 'CELL-2'
        },
        {
          id: 'cell-3',
          layoutVersionId: 'layout-1',
          rackId: 'rack-1',
          rackFaceId: 'face-1',
          rackSectionId: 'section-1',
          rackLevelId: 'level-l1',
          slotNo: 1,
          address: { raw: '01-A.01.L1.01', parts: { rackCode: '01', face: 'A', section: 1, level: 'L1', slot: 1 }, sortKey: '0001-A-01-L1-01' },
          status: 'active',
          cellCode: 'CELL-3'
        }
      ],
      isLoading: false
    });
    mockUseRackSlotLocationRefs.mockReturnValue({ data: LOCATION_REFS, isLoading: false });
    mockPreviewMutate.mockReset();
    mockPdfMutate.mockReset();
    mockTriggerBlobDownload.mockReset();
  });

  it('renders the labels page title', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('default preset is rack-slot-100x50', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('rack-slot-100x50');
  });

  it('renders malformed floorId state', () => {
    renderLabelsPage('/warehouse/labels?floorId=not-a-uuid');
    expect(screen.getByText('מזהה קומה לא תקין.')).toBeTruthy();
  });

  it('renders missing floor state when no floorId and no active floor', () => {
    mockUseActiveFloorId.mockReturnValue(null);
    renderLabelsPage('/warehouse/labels');
    expect(screen.getByText('יש לבחור קומה כדי ליצור תוויות.')).toBeTruthy();
  });

  it('shows the human-readable floor code and name when metadata is available', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockUseFloors.mockReturnValue({
      data: [{ id: FLOOR_ID, siteId: SITE_ID, code: 'F1', name: 'Main Floor', sortOrder: 0 }],
      isLoading: false
    });

    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    expect(screen.getByText('F1 — Main Floor')).toBeTruthy();
    expect(screen.queryByText(FLOOR_ID)).toBeNull();
  });

  it('calls preview with entire-floor payload by default', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));

    expect(mockPreviewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        floorId: FLOOR_ID,
        selection: { mode: 'entire-floor' },
        labelPreset: 'rack-slot-100x50',
        layout: { mode: 'single-label-page' },
        sort: 'address'
      }),
      expect.any(Object)
    );
  });

  it('allows by-rack selection with string level keys', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getAllByRole('radio')[1] as HTMLInputElement);

    expect(screen.getByText('L1')).toBeTruthy();
  });

  it('sends sorted and deduplicated location ids for by-rack selection', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getAllByRole('radio')[1] as HTMLInputElement);
    await user.click(screen.getAllByRole('checkbox')[0] as HTMLInputElement);
    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));

    expect(mockPreviewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: {
          mode: 'location-ids',
          locationIds: ['loc-1', 'loc-2', 'loc-3']
        }
      }),
      expect.any(Object)
    );
  });

  it('renders preview count, warnings, and concrete preview from server data', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));

    expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Some warning message')).toBeTruthy();
    expect(screen.getByText('BC-01')).toBeTruthy();
  });

  it('disables download when no preview data exists', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    const downloadButton = screen.getByRole('button', { name: /הורדת PDF/i }) as HTMLButtonElement;
    expect(downloadButton.disabled).toBe(true);
  });

  it('disables download for label count = 0', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    const emptyPreview: WarehouseLabelPreviewResponse = {
      ...SAMPLE_PREVIEW,
      labelCount: 0,
      pageCount: 0,
      sampleLabels: [],
      warnings: []
    };
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(emptyPreview);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));

    const downloadButton = screen.getByRole('button', { name: /הורדת PDF/i }) as HTMLButtonElement;
    expect(downloadButton.disabled).toBe(true);
  });

  it('changing preset invalidates stale preview', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    let previewCallCount = 0;
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      previewCallCount++;
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));
    expect(previewCallCount).toBe(1);

    await user.selectOptions(screen.getByRole('combobox'), 'rack-slot-70x40');

    const downloadButton = screen.getByRole('button', { name: /הורדת PDF/i }) as HTMLButtonElement;
    expect(downloadButton.disabled).toBe(true);
  });

  it('shows PDF limit exceeded error with selected count and limit', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockUseFloors.mockReturnValue({
      data: [{ id: FLOOR_ID, siteId: SITE_ID, code: 'F1', name: 'Main Floor', sortOrder: 0 }],
      isLoading: false
    });
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess({
        ...SAMPLE_PREVIEW,
        labelCount: 350,
        pageCount: 350
      });
    });
    mockPdfMutate.mockImplementation((_req: unknown, opts: { onError: (error: unknown) => void }) => {
      opts.onError(
        new BffRequestError(
          422,
          'WAREHOUSE_LABEL_PDF_LIMIT_EXCEEDED',
          'Warehouse label PDF generation is limited to 300 labels per request. 350 labels were selected.',
          'request-1',
          null
        )
      );
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    await user.click(screen.getByRole('button', { name: /תצוגה מקדימה/i }));
    await user.click(screen.getByRole('button', { name: /הורדת PDF/i }));

    expect(screen.getByText(/ההורדה מוגבלת ל-300 תוויות\. 350 נבחרו/)).toBeTruthy();
  });

  it('malformed floorId does not call backend', () => {
    mockUseActiveFloorId.mockReturnValue(null);
    renderLabelsPage('/warehouse/labels?floorId=bad-uuid');
    expect(mockPreviewMutate).not.toHaveBeenCalled();
  });
});
