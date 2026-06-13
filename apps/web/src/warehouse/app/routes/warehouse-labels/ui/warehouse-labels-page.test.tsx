import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n/i18n-provider';
import { BffRequestError } from '@/shared/api/bff/client';
import type { WarehouseLabelPreviewResponse } from '@wos/domain';

const mockUseActiveFloorId = vi.hoisted(() => vi.fn());
const mockUseActiveSiteId = vi.hoisted(() => vi.fn());
const mockPreviewMutate = vi.hoisted(() => vi.fn());
const mockPdfMutate = vi.hoisted(() => vi.fn());
const mockTriggerBlobDownload = vi.hoisted(() => vi.fn());
const mockUseFloors = vi.hoisted(() => vi.fn());

vi.mock('@/app/store/ui-selectors', () => ({
  useActiveFloorId: mockUseActiveFloorId,
  useActiveSiteId: mockUseActiveSiteId
}));

vi.mock('@/entities/floor/api/use-floors', () => ({
  useFloors: mockUseFloors
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
  computePreviewFingerprint: (floorId: string, preset: string) => ({
    floorId,
    selectionMode: 'entire-floor',
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

const SAMPLE_PREVIEW: WarehouseLabelPreviewResponse = {
  labelCount: 120,
  pageCount: 120,
  resolvedPreset: { id: 'rack-slot-100x50', widthMm: 100, heightMm: 50 },
  resolvedLayout: { mode: 'single-label-page', pageWidthMm: 100, pageHeightMm: 50, labelsPerPage: 1 },
  sampleLabels: [
    { locationId: '22222222-2222-4222-8222-222222222220', address: '01-A.01.01.01', barcodeValue: '01-A.01.01.01' },
    { locationId: '22222222-2222-4222-8222-222222222221', address: '01-A.01.01.02', barcodeValue: '01-A.01.01.02' }
  ],
  warnings: ['Some warning message']
};

describe('WarehouseLabelsPage', () => {
  beforeEach(() => {
    mockUseActiveSiteId.mockReturnValue(SITE_ID);
    mockUseActiveFloorId.mockReturnValue(null);
    mockUseFloors.mockReturnValue({ data: [], isLoading: false });
    mockPreviewMutate.mockReset();
    mockPdfMutate.mockReset();
    mockTriggerBlobDownload.mockReset();
  });

  it('renders the labels page title', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    expect(screen.getByText('הדפסת תוויות מיקום')).toBeTruthy();
  });

  it('default preset is rack-slot-100x50', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('rack-slot-100x50');
  });

  it('shows entire-floor selection summary', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    expect(screen.getByText('כל המיקומים בקומה')).toBeTruthy();
  });

  it('shows single-label-page layout summary', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);
    expect(screen.getByText('תווית אחת בכל עמוד')).toBeTruthy();
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

  it('uses active floor when floorId param is missing', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    renderLabelsPage('/warehouse/labels');
    expect(screen.getByText(FLOOR_ID)).toBeTruthy();
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

  it('shows a neutral loading state while floor metadata is loading', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockUseFloors.mockReturnValue({
      data: [],
      isLoading: true
    });

    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    expect(screen.getByText('טוען...')).toBeTruthy();
  });

  it('falls back safely when floor metadata cannot be resolved', () => {
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockUseFloors.mockReturnValue({
      data: [{ id: '22222222-2222-4222-8222-222222222222', siteId: SITE_ID, code: 'F2', name: 'Other Floor', sortOrder: 1 }],
      isLoading: false
    });

    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    expect(screen.getByText(FLOOR_ID)).toBeTruthy();
  });

  it('calls preview with correct payload', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

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

  it('renders preview count and page count', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

    const all120 = screen.getAllByText('120');
    expect(all120.length).toBeGreaterThanOrEqual(2);
  });

  it('renders sample labels', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

    expect(screen.getByText('01-A.01.01.01')).toBeTruthy();
    expect(screen.getByText('01-A.01.01.02')).toBeTruthy();
  });

  it('renders warnings', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue(FLOOR_ID);
    mockPreviewMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: unknown) => void }) => {
      opts.onSuccess(SAMPLE_PREVIEW);
    });
    renderLabelsPage(`/warehouse/labels?floorId=${FLOOR_ID}`);

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

    expect(screen.getByText('Some warning message')).toBeTruthy();
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

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

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

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);
    expect(previewCallCount).toBe(1);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'rack-slot-70x40');

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

    const previewButton = screen.getByRole('button', { name: /תצוגה מקדימה/i });
    await user.click(previewButton);

    const downloadButton = screen.getByRole('button', { name: /הורדת PDF/i });
    await user.click(downloadButton);

    expect(screen.getByText(/ההורדה מוגבלת ל-300 תוויות\. 350 נבחרו/)).toBeTruthy();
  });

  it('malformed floorId does not call backend', () => {
    mockUseActiveFloorId.mockReturnValue(null);
    renderLabelsPage('/warehouse/labels?floorId=bad-uuid');
    expect(mockPreviewMutate).not.toHaveBeenCalled();
  });
});
