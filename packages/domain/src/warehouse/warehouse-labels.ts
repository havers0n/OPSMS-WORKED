import { z } from 'zod';

export const warehouseLabelPresetIds = [
  'rack-slot-100x50',
  'rack-slot-100x60',
  'rack-slot-70x40'
] as const;

export const warehouseLabelPresetSchema = z.enum(warehouseLabelPresetIds);
export type WarehouseLabelPresetId = z.infer<typeof warehouseLabelPresetSchema>;

export const warehouseLabelSortSchema = z.literal('address');
export type WarehouseLabelSort = z.infer<typeof warehouseLabelSortSchema>;

export const warehouseLabelSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('entire-floor')
  }),
  z.object({
    mode: z.literal('location-ids'),
    locationIds: z.array(z.string().uuid()).min(1)
  })
]);
export type WarehouseLabelSelection = z.infer<typeof warehouseLabelSelectionSchema>;

export const warehouseLabelLayoutSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('single-label-page')
  }),
  z.object({
    mode: z.literal('a4-sheet'),
    marginMm: z.number().finite().min(0),
    gapMm: z.number().finite().min(0)
  })
]);
export type WarehouseLabelLayout = z.infer<typeof warehouseLabelLayoutSchema>;

export const warehouseLabelPreviewRequestSchema = z.object({
  floorId: z.string().uuid(),
  selection: warehouseLabelSelectionSchema,
  labelPreset: warehouseLabelPresetSchema,
  layout: warehouseLabelLayoutSchema,
  sort: warehouseLabelSortSchema
});
export type WarehouseLabelPreviewRequest = z.infer<typeof warehouseLabelPreviewRequestSchema>;

export const warehouseLabelResolvedPresetSchema = z.object({
  id: warehouseLabelPresetSchema,
  widthMm: z.number().positive(),
  heightMm: z.number().positive()
});
export type WarehouseLabelResolvedPreset = z.infer<typeof warehouseLabelResolvedPresetSchema>;

export const warehouseLabelPreviewSampleSchema = z.object({
  locationId: z.string().uuid(),
  address: z.string().trim().min(1),
  barcodeValue: z.string().trim().min(1)
});
export type WarehouseLabelPreviewSample = z.infer<typeof warehouseLabelPreviewSampleSchema>;

export const warehouseLabelResolvedLayoutSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('single-label-page'),
    pageWidthMm: z.number().positive(),
    pageHeightMm: z.number().positive(),
    labelsPerPage: z.literal(1)
  }),
  z.object({
    mode: z.literal('a4-sheet'),
    pageWidthMm: z.literal(210),
    pageHeightMm: z.literal(297),
    marginMm: z.number().finite().min(0),
    gapMm: z.number().finite().min(0),
    columns: z.number().int().min(1),
    rows: z.number().int().min(1),
    labelsPerPage: z.number().int().min(1)
  })
]);
export type WarehouseLabelResolvedLayout = z.infer<typeof warehouseLabelResolvedLayoutSchema>;

export const warehouseLabelPreviewResponseSchema = z.object({
  labelCount: z.number().int().min(0),
  pageCount: z.number().int().min(0),
  resolvedPreset: warehouseLabelResolvedPresetSchema,
  resolvedLayout: warehouseLabelResolvedLayoutSchema,
  sampleLabels: z.array(warehouseLabelPreviewSampleSchema).max(10),
  warnings: z.array(z.string())
});
export type WarehouseLabelPreviewResponse = z.infer<typeof warehouseLabelPreviewResponseSchema>;

export const warehouseLabelPresets = {
  'rack-slot-100x50': {
    id: 'rack-slot-100x50',
    widthMm: 100,
    heightMm: 50
  },
  'rack-slot-100x60': {
    id: 'rack-slot-100x60',
    widthMm: 100,
    heightMm: 60
  },
  'rack-slot-70x40': {
    id: 'rack-slot-70x40',
    widthMm: 70,
    heightMm: 40
  }
} as const satisfies Record<WarehouseLabelPresetId, WarehouseLabelResolvedPreset>;

export function getWarehouseLabelPreset(id: WarehouseLabelPresetId): WarehouseLabelResolvedPreset {
  return warehouseLabelResolvedPresetSchema.parse(warehouseLabelPresets[id]);
}

export const rackSlotLocationRefSchema = z.object({
  locationId: z.string().uuid(),
  cellId: z.string().uuid()
});
export type RackSlotLocationRef = z.infer<typeof rackSlotLocationRefSchema>;

export const rackSlotLocationRefsResponseSchema = z.array(rackSlotLocationRefSchema);
export type RackSlotLocationRefsResponse = z.infer<typeof rackSlotLocationRefsResponseSchema>;
