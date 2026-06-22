import { z } from 'zod';
import type { ManualShiftOrderItem } from './manual-shift-control';

export const pickerSheetScopeSchema = z.enum(['area', 'line', 'workGroup']);
export type PickerSheetScope = z.infer<typeof pickerSheetScopeSchema>;

export const pickerPrintItemSchema = z.object({
  sku: z.string(),
  displaySku: z.string(),
  description: z.string(),
  quantity: z.number(),
  category: z.string().nullable().optional(),
  warning: z.literal('sku_display_collision').optional(),
});
export type PickerPrintItem = z.infer<typeof pickerPrintItemSchema>;

export const pickerSheetWorkGroupSchema = z.object({
  name: z.string(),
  items: z.array(pickerPrintItemSchema),
});
export type PickerSheetWorkGroup = z.infer<typeof pickerSheetWorkGroupSchema>;

export const pickerSheetLineSchema = z.object({
  name: z.string(),
  workGroups: z.array(pickerSheetWorkGroupSchema),
});
export type PickerSheetLine = z.infer<typeof pickerSheetLineSchema>;

export const pickerSheetPrintDataSchema = z.object({
  shift: z.string(),
  scope: pickerSheetScopeSchema,
  shiftDate: z.string(),
  distributionArea: z.string(),
  generatedAt: z.string(),
  totals: z.object({
    lines: z.number(),
    workGroups: z.number(),
    items: z.number(),
  }),
  planningLines: z.array(pickerSheetLineSchema),
});
export type PickerSheetPrintData = z.infer<typeof pickerSheetPrintDataSchema>;

export function getDisplaySku(sku: string): string {
  if (sku.length <= 6) return sku;
  return sku.slice(-6);
}

export function processCollisions(data: PickerSheetPrintData): PickerSheetPrintData {
  const displaySkuMap = new Map<string, string[]>();
  for (const line of data.planningLines) {
    for (const wg of line.workGroups) {
      for (const item of wg.items) {
        const existing = displaySkuMap.get(item.displaySku) ?? [];
        if (!existing.includes(item.sku)) {
          existing.push(item.sku);
        }
        displaySkuMap.set(item.displaySku, existing);
      }
    }
  }
  const collided = new Set<string>();
  for (const [_displaySku, skus] of displaySkuMap) {
    if (skus.length > 1) {
      for (const sku of skus) {
        collided.add(sku);
      }
    }
  }
  return {
    ...data,
    planningLines: data.planningLines.map(line => ({
      ...line,
      workGroups: line.workGroups.map(wg => ({
        ...wg,
        items: wg.items.map(item => ({
          ...item,
          warning: collided.has(item.sku) ? 'sku_display_collision' as const : undefined,
        })),
      })),
    })),
  };
}

export function aggregatePickerItems(items: ManualShiftOrderItem[]): PickerPrintItem[] {
  const map = new Map<string, { sku: string; description: string; category: string | null; quantity: number }>();
  for (const item of items) {
    const key = item.sku;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (existing.description === '' && item.description) {
        existing.description = item.description;
      }
      if (existing.category === null && item.category) {
        existing.category = item.category;
      }
    } else {
      map.set(key, {
        sku: key,
        description: item.description ?? '',
        category: item.category ?? null,
        quantity: item.quantity,
      });
    }
  }
  const result: PickerPrintItem[] = [];
  for (const entry of map.values()) {
    result.push({
      sku: entry.sku,
      displaySku: getDisplaySku(entry.sku),
      description: entry.description,
      quantity: entry.quantity,
      category: entry.category ?? undefined,
    });
  }
  result.sort((a, b) => a.sku.localeCompare(b.sku));
  return result;
}
