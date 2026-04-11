import type { Cell } from '@wos/domain';
import type { EditorSelection, ViewMode } from './editor-types';
import { resolveSemanticLevelForIndex } from './storage-level-mapping';

export type StorageFocusLeaf = 'none' | 'rack' | 'cell';

export type StorageFocusContext = {
  leaf: StorageFocusLeaf;
  rackId: string | null;
  resolvedCellId: string | null;
  resolvedContainerId: string | null;
  activeLevel: number;
  hasResolvedRackContext: boolean;
  isOffLevel: boolean;
};

type ResolveStorageFocusContextArgs = {
  viewMode: ViewMode;
  selection: EditorSelection;
  selectedRackActiveLevel: number;
  publishedCellsById: Map<string, Cell>;
};

function collectRackSemanticLevelsFromPublishedCells(
  publishedCellsById: Map<string, Cell>,
  rackId: string
) {
  return Array.from(
    new Set(
      Array.from(publishedCellsById.values())
        .filter((cell) => cell.rackId === rackId)
        .map((cell) => cell.address?.parts?.level)
        .filter((level): level is number => Number.isFinite(level))
    )
  ).sort((left, right) => left - right);
}

function createNoneContext(activeLevel: number): StorageFocusContext {
  return {
    leaf: 'none',
    rackId: null,
    resolvedCellId: null,
    resolvedContainerId: null,
    activeLevel,
    hasResolvedRackContext: false,
    isOffLevel: false
  };
}

export function resolveStorageFocusContext({
  viewMode,
  selection,
  selectedRackActiveLevel,
  publishedCellsById
}: ResolveStorageFocusContextArgs): StorageFocusContext {
  if (viewMode !== 'storage') {
    return createNoneContext(selectedRackActiveLevel);
  }

  if (selection.type === 'rack') {
    const rackId = selection.rackIds[0] ?? null;
    return {
      leaf: 'rack',
      rackId,
      resolvedCellId: null,
      resolvedContainerId: null,
      activeLevel: selectedRackActiveLevel,
      hasResolvedRackContext: rackId !== null,
      isOffLevel: false
    };
  }

  if (selection.type === 'cell') {
    const cell = publishedCellsById.get(selection.cellId) ?? null;
    const rackId = cell?.rackId ?? null;
    const cellLevel = cell?.address?.parts?.level;
    const semanticLevels = rackId
      ? collectRackSemanticLevelsFromPublishedCells(publishedCellsById, rackId)
      : [];
    const activeSemanticLevel = resolveSemanticLevelForIndex(
      semanticLevels,
      selectedRackActiveLevel
    );
    const isOffLevel =
      rackId !== null &&
      typeof cellLevel === 'number' &&
      activeSemanticLevel !== null &&
      cellLevel !== activeSemanticLevel;

    return {
      leaf: 'cell',
      rackId,
      resolvedCellId: selection.cellId,
      resolvedContainerId: null,
      activeLevel: selectedRackActiveLevel,
      hasResolvedRackContext: rackId !== null,
      isOffLevel
    };
  }

  if (selection.type === 'container') {
    const sourceCellId = selection.sourceCellId ?? null;
    const sourceCell = sourceCellId ? (publishedCellsById.get(sourceCellId) ?? null) : null;
    const rackId = sourceCell?.rackId ?? null;
    const cellLevel = sourceCell?.address?.parts?.level;
    const semanticLevels = rackId
      ? collectRackSemanticLevelsFromPublishedCells(publishedCellsById, rackId)
      : [];
    const activeSemanticLevel = resolveSemanticLevelForIndex(
      semanticLevels,
      selectedRackActiveLevel
    );
    const isOffLevel =
      rackId !== null &&
      typeof cellLevel === 'number' &&
      activeSemanticLevel !== null &&
      cellLevel !== activeSemanticLevel;

    return {
      leaf: sourceCell ? 'cell' : 'none',
      rackId,
      resolvedCellId: sourceCell?.id ?? null,
      resolvedContainerId: selection.containerId,
      activeLevel: selectedRackActiveLevel,
      hasResolvedRackContext: rackId !== null,
      isOffLevel
    };
  }

  return createNoneContext(selectedRackActiveLevel);
}
