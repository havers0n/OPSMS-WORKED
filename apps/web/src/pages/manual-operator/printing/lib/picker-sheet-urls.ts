import { routes } from '@/shared/config/routes';

type PickerSheetUrlParams = {
  shiftId: string | null | undefined;
  distributionArea: string | null | undefined;
  planningLineName: string | null | undefined;
  workGroupName?: string | null | undefined;
};

export function buildPickerSheetLinePreviewUrl({
  shiftId,
  distributionArea,
  planningLineName
}: PickerSheetUrlParams): string | undefined {
  if (!shiftId || !distributionArea || !planningLineName) return undefined;

  const params = new URLSearchParams({
    shiftId,
    distributionArea,
    scope: 'line',
    planningLineName
  });

  return `${routes.operatorManualPrintPickerSheet}?${params.toString()}`;
}

export function buildPickerSheetWorkGroupPreviewUrl({
  shiftId,
  distributionArea,
  planningLineName,
  workGroupName
}: PickerSheetUrlParams): string | undefined {
  if (!shiftId || !distributionArea || !planningLineName || !workGroupName) return undefined;

  const params = new URLSearchParams({
    shiftId,
    distributionArea,
    scope: 'workGroup',
    planningLineName,
    workGroupName
  });

  return `${routes.operatorManualPrintPickerSheet}?${params.toString()}`;
}

export function buildPickerSheetLinePdfUrl({
  shiftId,
  distributionArea,
  planningLineName
}: PickerSheetUrlParams): string | undefined {
  if (!shiftId || !distributionArea || !planningLineName) return undefined;

  const params = new URLSearchParams({
    scope: 'line',
    distributionArea,
    planningLineName
  });

  return `/api/manual-shifts/${shiftId}/print/picker-sheet.pdf?${params.toString()}`;
}

export function buildPickerSheetWorkGroupPdfUrl({
  shiftId,
  distributionArea,
  planningLineName,
  workGroupName
}: PickerSheetUrlParams): string | undefined {
  if (!shiftId || !distributionArea || !planningLineName || !workGroupName) return undefined;

  const params = new URLSearchParams({
    scope: 'workGroup',
    distributionArea,
    planningLineName,
    workGroupName
  });

  return `/api/manual-shifts/${shiftId}/print/picker-sheet.pdf?${params.toString()}`;
}
