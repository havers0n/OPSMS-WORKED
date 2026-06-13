import bwipjs from 'bwip-js';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage
} from 'pdf-lib';
import {
  getWarehouseLabelPreset,
  type WarehouseLabelPresetId
} from '@wos/domain';
import { ApiError } from '../../errors.js';

export type ResolvedWarehouseLabel = {
  locationId: string;
  locationCode: string;
  addressSortKey: string;
};

export type RenderableWarehouseLabel = {
  addressText: string;
  barcodeValue: string;
  captionText: string;
};

type PresetLayoutSpec = {
  pageWidthMm: number;
  pageHeightMm: number;
  outerPaddingMm: number;
  addressMaxFontSize: number;
  addressMinFontSize: number;
  addressTopGapMm: number;
  addressBottomGapMm: number;
  barcodeTopGapMm: number;
  barcodeHeightMm: number;
  quietZoneMm: number;
  captionTopGapMm: number;
  captionFontSize: number;
  captionMinFontSize: number;
};

type BarcodeRenderer = (value: string) => Promise<Uint8Array>;

type WarehouseLabelPdfOptions = {
  labels: ResolvedWarehouseLabel[];
  labelPreset: WarehouseLabelPresetId;
  barcodeRenderer?: BarcodeRenderer;
};

const MM_TO_POINTS_RATIO = 72 / 25.4;
const BARCODE_SCALE = 3;
const BARCODE_HEIGHT = 40;

const presetLayoutSpecs: Record<WarehouseLabelPresetId, PresetLayoutSpec> = {
  'rack-slot-100x50': {
    pageWidthMm: 100,
    pageHeightMm: 50,
    outerPaddingMm: 4,
    addressMaxFontSize: 26,
    addressMinFontSize: 16,
    addressTopGapMm: 4,
    addressBottomGapMm: 4,
    barcodeTopGapMm: 2,
    barcodeHeightMm: 16,
    quietZoneMm: 4,
    captionTopGapMm: 1.5,
    captionFontSize: 8,
    captionMinFontSize: 6
  },
  'rack-slot-100x60': {
    pageWidthMm: 100,
    pageHeightMm: 60,
    outerPaddingMm: 4,
    addressMaxFontSize: 30,
    addressMinFontSize: 18,
    addressTopGapMm: 5,
    addressBottomGapMm: 5,
    barcodeTopGapMm: 3,
    barcodeHeightMm: 18,
    quietZoneMm: 4,
    captionTopGapMm: 2,
    captionFontSize: 9,
    captionMinFontSize: 6
  },
  'rack-slot-70x40': {
    pageWidthMm: 70,
    pageHeightMm: 40,
    outerPaddingMm: 3,
    addressMaxFontSize: 18,
    addressMinFontSize: 11,
    addressTopGapMm: 3,
    addressBottomGapMm: 3,
    barcodeTopGapMm: 2,
    barcodeHeightMm: 14,
    quietZoneMm: 3,
    captionTopGapMm: 1,
    captionFontSize: 6,
    captionMinFontSize: 5
  }
};

export function mmToPoints(mm: number): number {
  return mm * MM_TO_POINTS_RATIO;
}

export function getLabelPageSizePoints(labelPreset: WarehouseLabelPresetId) {
  const preset = getWarehouseLabelPreset(labelPreset);

  return {
    width: mmToPoints(preset.widthMm),
    height: mmToPoints(preset.heightMm)
  };
}

function barcodeRenderError(): ApiError {
  return new ApiError(500, 'WAREHOUSE_LABEL_BARCODE_RENDER_FAILED', 'Warehouse label barcode rendering failed.');
}

function pdfGenerationError(): ApiError {
  return new ApiError(500, 'WAREHOUSE_LABEL_PDF_GENERATION_FAILED', 'Warehouse label PDF generation failed.');
}

function textOverflowError(locationCode: string): ApiError {
  return new ApiError(422, 'WAREHOUSE_LABEL_TEXT_OVERFLOW', 'Warehouse label address does not fit the selected preset.', {
    locationCode
  });
}

export function createRenderableWarehouseLabel(label: ResolvedWarehouseLabel): RenderableWarehouseLabel {
  return {
    addressText: label.locationCode,
    barcodeValue: label.locationCode,
    captionText: label.locationCode
  };
}

function findFittingFontSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number
): number {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return fontSize;
    }
  }

  throw textOverflowError(text);
}

function fitCaptionFontSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  preferredFontSize: number,
  minFontSize: number
): number {
  for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return fontSize;
    }
  }

  return 0;
}

export async function renderCode128Png(value: string): Promise<Uint8Array> {
  if (value.trim().length === 0) {
    throw new ApiError(422, 'WAREHOUSE_LABEL_BARCODE_VALUE_REQUIRED', 'Warehouse label barcode value is required.');
  }

  try {
    const bytes = await bwipjs.toBuffer({
      bcid: 'code128',
      text: value,
      scale: BARCODE_SCALE,
      height: BARCODE_HEIGHT,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: 'FFFFFF'
    });

    return new Uint8Array(bytes);
  } catch {
    throw barcodeRenderError();
  }
}

async function embedBarcodeImage(pdf: PDFDocument, barcodeBytes: Uint8Array): Promise<PDFImage> {
  try {
    return await pdf.embedPng(barcodeBytes);
  } catch {
    throw barcodeRenderError();
  }
}

function drawLabelPage(
  page: ReturnType<PDFDocument['addPage']>,
  font: PDFFont,
  barcodeImage: PDFImage,
  label: ResolvedWarehouseLabel,
  spec: PresetLayoutSpec
) {
  const pageWidth = mmToPoints(spec.pageWidthMm);
  const pageHeight = mmToPoints(spec.pageHeightMm);
  const outerPadding = mmToPoints(spec.outerPaddingMm);
  const quietZone = mmToPoints(spec.quietZoneMm);
  const contentWidth = pageWidth - outerPadding * 2;
  const renderableLabel = createRenderableWarehouseLabel(label);
  const addressFontSize = findFittingFontSize(
    font,
    renderableLabel.addressText,
    contentWidth,
    spec.addressMaxFontSize,
    spec.addressMinFontSize
  );
  const addressLineHeight = addressFontSize * 1.1;
  const addressWidth = font.widthOfTextAtSize(renderableLabel.addressText, addressFontSize);
  const addressY = pageHeight - outerPadding - mmToPoints(spec.addressTopGapMm) - addressLineHeight;

  page.drawText(renderableLabel.addressText, {
    x: (pageWidth - addressWidth) / 2,
    y: addressY,
    size: addressFontSize,
    font,
    color: rgb(0, 0, 0)
  });

  const barcodeTop = addressY - mmToPoints(spec.addressBottomGapMm) - mmToPoints(spec.barcodeTopGapMm);
  const barcodeHeight = mmToPoints(spec.barcodeHeightMm);
  const barcodeMaxWidth = pageWidth - outerPadding * 2 - quietZone * 2;
  const barcodeScale = Math.min(barcodeMaxWidth / barcodeImage.width, barcodeHeight / barcodeImage.height);
  const barcodeWidth = barcodeImage.width * barcodeScale;
  const barcodeRenderedHeight = barcodeImage.height * barcodeScale;
  const barcodeX = (pageWidth - barcodeWidth) / 2;
  const barcodeY = barcodeTop - barcodeRenderedHeight;

  if (barcodeX < outerPadding + quietZone || barcodeY < outerPadding) {
    throw pdfGenerationError();
  }

  page.drawImage(barcodeImage, {
    x: barcodeX,
    y: barcodeY,
    width: barcodeWidth,
    height: barcodeRenderedHeight
  });

  const captionFontSize = fitCaptionFontSize(
    font,
    renderableLabel.captionText,
    contentWidth,
    spec.captionFontSize,
    spec.captionMinFontSize
  );

  if (captionFontSize > 0) {
    const captionWidth = font.widthOfTextAtSize(renderableLabel.captionText, captionFontSize);
    const captionY = barcodeY - mmToPoints(spec.captionTopGapMm) - captionFontSize;

    if (captionY >= outerPadding / 2) {
      page.drawText(renderableLabel.captionText, {
        x: (pageWidth - captionWidth) / 2,
        y: captionY,
        size: captionFontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
  }
}

export async function generateWarehouseLabelsPdf({
  labels,
  labelPreset,
  barcodeRenderer = renderCode128Png
}: WarehouseLabelPdfOptions): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize = getLabelPageSizePoints(labelPreset);
    const spec = presetLayoutSpecs[labelPreset];

    for (const label of labels) {
      const page = pdf.addPage([pageSize.width, pageSize.height]);
      const barcodeBytes = await barcodeRenderer(createRenderableWarehouseLabel(label).barcodeValue);
      const barcodeImage = await embedBarcodeImage(pdf, barcodeBytes);
      drawLabelPage(page, font, barcodeImage, label, spec);
    }

    return await pdf.save({
      useObjectStreams: false
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw pdfGenerationError();
  }
}
