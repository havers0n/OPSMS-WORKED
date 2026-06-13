import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  createRenderableWarehouseLabel,
  generateWarehouseLabelsPdf,
  getLabelPageSizePoints,
  mmToPoints,
  type ResolvedWarehouseLabel
} from './pdf.js';

const PDF_TOLERANCE = 0.01;

function createResolvedLabel(
  locationId: string,
  locationCode: string,
  addressSortKey: string
): ResolvedWarehouseLabel {
  return {
    locationId,
    locationCode,
    addressSortKey
  };
}

function createTinyPng(): Uint8Array {
  return new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9WZkAAAAASUVORK5CYII=',
      'base64'
    )
  );
}

async function loadPdf(bytes: Uint8Array) {
  return PDFDocument.load(bytes);
}

describe('warehouse label PDF dimensions', () => {
  it('converts millimeters to points', () => {
    expect(mmToPoints(25.4)).toBeCloseTo(72, 10);
  });

  it('returns 100 x 50 mm preset size in points', () => {
    const size = getLabelPageSizePoints('rack-slot-100x50');
    expect(size.width).toBeCloseTo(mmToPoints(100), 10);
    expect(size.height).toBeCloseTo(mmToPoints(50), 10);
  });

  it('returns 100 x 60 mm preset size in points', () => {
    const size = getLabelPageSizePoints('rack-slot-100x60');
    expect(size.width).toBeCloseTo(mmToPoints(100), 10);
    expect(size.height).toBeCloseTo(mmToPoints(60), 10);
  });

  it('returns 70 x 40 mm preset size in points', () => {
    const size = getLabelPageSizePoints('rack-slot-70x40');
    expect(size.width).toBeCloseTo(mmToPoints(70), 10);
    expect(size.height).toBeCloseTo(mmToPoints(40), 10);
  });
});

describe('warehouse label PDF generation', () => {
  const barcodeRenderer = vi.fn(async (_value: string) => createTinyPng());

  it.each([
    ['rack-slot-100x50', 100, 50],
    ['rack-slot-100x60', 100, 60],
    ['rack-slot-70x40', 70, 40]
  ] as const)('creates one page per label for %s', async (presetId, widthMm, heightMm) => {
    barcodeRenderer.mockClear();
    const bytes = await generateWarehouseLabelsPdf({
      labelPreset: presetId,
      labels: [createResolvedLabel('10000000-0000-4000-8000-000000000001', '03-A.02.03.04', '0001')],
      barcodeRenderer
    });

    const pdf = await loadPdf(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(barcodeRenderer).toHaveBeenCalledWith('03-A.02.03.04');

    const page = pdf.getPage(0);
    expect(Math.abs(page.getWidth() - mmToPoints(widthMm))).toBeLessThan(PDF_TOLERANCE);
    expect(Math.abs(page.getHeight() - mmToPoints(heightMm))).toBeLessThan(PDF_TOLERANCE);
  });

  it('creates N pages for N labels and preserves resolver order in barcode rendering', async () => {
    barcodeRenderer.mockClear();
    const labels = [
      createResolvedLabel('10000000-0000-4000-8000-000000000001', '03-A.02.03.04', '0001'),
      createResolvedLabel('10000000-0000-4000-8000-000000000002', '03-A.02.03.05', '0002'),
      createResolvedLabel('10000000-0000-4000-8000-000000000003', '03-A.02.03.06', '0003')
    ];
    const bytes = await generateWarehouseLabelsPdf({
      labelPreset: 'rack-slot-100x50',
      labels,
      barcodeRenderer
    });

    const pdf = await loadPdf(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(barcodeRenderer.mock.calls.map((call) => call[0])).toEqual(labels.map((label) => label.locationCode));
  });

  it('uses locations.code as the visible address and barcode source', async () => {
    const label = createResolvedLabel('10000000-0000-4000-8000-000000000001', '03-A.02.03.04', '0001');
    const renderable = createRenderableWarehouseLabel(label);

    expect(renderable).toEqual({
      addressText: '03-A.02.03.04',
      barcodeValue: '03-A.02.03.04',
      captionText: '03-A.02.03.04'
    });
  });

  it('fails with a stable overflow error when the address cannot fit the preset', async () => {
    await expect(
      generateWarehouseLabelsPdf({
        labelPreset: 'rack-slot-70x40',
        labels: [
          createResolvedLabel(
            '10000000-0000-4000-8000-000000000001',
            '03-A.02.03.04-EXTREMELY-LONG-LABEL-CODE-THAT-WILL-NOT-FIT',
            '0001'
          )
        ],
        barcodeRenderer
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'WAREHOUSE_LABEL_TEXT_OVERFLOW'
    });
  });

  it('maps failing injected barcode renderers to the stable barcode rendering error', async () => {
    const failingBarcodeRenderer = vi.fn(async (_value: string) => {
      throw new Error('bwip exploded');
    });

    await expect(
      generateWarehouseLabelsPdf({
        labelPreset: 'rack-slot-100x50',
        labels: [createResolvedLabel('10000000-0000-4000-8000-000000000001', '03-A.02.03.04', '0001')],
        barcodeRenderer: failingBarcodeRenderer
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'WAREHOUSE_LABEL_BARCODE_RENDER_FAILED',
      message: 'Warehouse label barcode rendering failed.'
    });
  });
});
