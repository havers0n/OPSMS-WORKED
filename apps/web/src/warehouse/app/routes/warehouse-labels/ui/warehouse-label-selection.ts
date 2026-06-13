import type { Cell, RackSlotLocationRef, WarehouseLabelSelection } from '@wos/domain';

export type LabelSelectionState =
  | { mode: 'entire-floor' }
  | {
      mode: 'by-rack';
      selected: Record<string, 'all' | string[]>;
    };

export type RackLevelOption = {
  rackId: string;
  rackLabel: string;
  levels: Array<{
    key: string;
    label: string;
    locationIds: string[];
  }>;
};

type CellWithUnknownLevel = Cell & {
  address: Cell['address'] & {
    parts: Cell['address']['parts'] & {
      level: unknown;
    };
  };
};

export function getCellLevelKey(cell: Cell): string {
  const level = (cell as CellWithUnknownLevel).address.parts.level;
  return typeof level === 'string' ? level : String(level);
}

export function normalizeLocationIds(locationIds: string[]): string[] {
  return Array.from(new Set(locationIds)).sort((left, right) => left.localeCompare(right));
}

export function buildRackLevelOptions(cells: Cell[], refs: RackSlotLocationRef[]): RackLevelOption[] {
  const locationIdByCellId = new Map(refs.map((ref) => [ref.cellId, ref.locationId]));
  const racks = new Map<
    string,
    {
      rackLabel: string;
      levels: Map<string, { label: string; locationIds: string[] }>;
    }
  >();

  const sortedCells = [...cells].sort((left, right) => {
    const sortComparison = left.address.sortKey.localeCompare(right.address.sortKey);
    if (sortComparison !== 0) {
      return sortComparison;
    }

    return left.id.localeCompare(right.id);
  });

  for (const cell of sortedCells) {
    const locationId = locationIdByCellId.get(cell.id);
    if (!locationId) {
      continue;
    }

    const rack = racks.get(cell.rackId) ?? {
      rackLabel: cell.address.parts.rackCode,
      levels: new Map<string, { label: string; locationIds: string[] }>()
    };
    const levelKey = getCellLevelKey(cell);
    const level = rack.levels.get(levelKey) ?? {
      label: levelKey,
      locationIds: []
    };

    level.locationIds.push(locationId);
    rack.levels.set(levelKey, level);
    racks.set(cell.rackId, rack);
  }

  return Array.from(racks.entries())
    .map(([rackId, rack]) => ({
      rackId,
      rackLabel: rack.rackLabel,
      levels: Array.from(rack.levels.entries())
        .map(([key, level]) => ({
          key,
          label: level.label,
          locationIds: normalizeLocationIds(level.locationIds)
        }))
        .sort((left, right) => left.key.localeCompare(right.key))
    }))
    .sort((left, right) => {
      const rackLabelComparison = left.rackLabel.localeCompare(right.rackLabel);
      if (rackLabelComparison !== 0) {
        return rackLabelComparison;
      }

      return left.rackId.localeCompare(right.rackId);
    });
}

export function resolveSelectedLocationIds(
  selectionState: LabelSelectionState,
  rackLevelOptions: RackLevelOption[]
): string[] {
  if (selectionState.mode === 'entire-floor') {
    return [];
  }

  const locationIds: string[] = [];

  for (const rack of rackLevelOptions) {
    const rackSelection = selectionState.selected[rack.rackId];
    if (!rackSelection) {
      continue;
    }

    const selectedLevelKeys =
      rackSelection === 'all'
        ? rack.levels.map((level) => level.key)
        : rackSelection;
    const selectedLevelSet = new Set(selectedLevelKeys);

    for (const level of rack.levels) {
      if (selectedLevelSet.has(level.key)) {
        locationIds.push(...level.locationIds);
      }
    }
  }

  return normalizeLocationIds(locationIds);
}

export function buildWarehouseLabelSelection(
  selectionState: LabelSelectionState,
  rackLevelOptions: RackLevelOption[]
): WarehouseLabelSelection | null {
  if (selectionState.mode === 'entire-floor') {
    return { mode: 'entire-floor' };
  }

  const locationIds = resolveSelectedLocationIds(selectionState, rackLevelOptions);
  if (locationIds.length === 0) {
    return null;
  }

  return {
    mode: 'location-ids',
    locationIds
  };
}
