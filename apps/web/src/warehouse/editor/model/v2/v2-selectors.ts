import {
  useNavigationStore,
  type NavigationStore,
} from './navigation-store'
import {
  useSelectionStore,
  type SelectionStore,
} from './selection-store'
import {
  useStorageFocusStore,
  type StorageFocusStore,
} from './storage-focus-store'
import {
  useTaskStore,
  type TaskStore,
} from './task-store'

// ============================================================================
// Navigation Selectors — Spatial/View Context
// ============================================================================

export const useNavigationRackId = () =>
  useNavigationStore((state: NavigationStore) => state.rackId)

export const useNavigationActiveLevel = () =>
  useNavigationStore((state: NavigationStore) => state.activeLevel)

export const useSetRack = () =>
  useNavigationStore((state: NavigationStore) => state.setRack)

export const useSetLevel = () =>
  useNavigationStore((state: NavigationStore) => state.setLevel)

export const useClearNavigation = () =>
  useNavigationStore((state: NavigationStore) => state.clearNavigation)

// ============================================================================
// Selection Selectors — Operational Context
// ============================================================================

export const useSelectionLocationId = () =>
  useSelectionStore((state: SelectionStore) => state.locationId)

export const useSelectionContainerId = () =>
  useSelectionStore((state: SelectionStore) => state.containerId)

export const useSelectLocation = () =>
  useSelectionStore((state: SelectionStore) => state.selectLocation)

export const useSelectContainer = () =>
  useSelectionStore((state: SelectionStore) => state.selectContainer)

export const useClearSelection = () =>
  useSelectionStore((state: SelectionStore) => state.clearSelection)

// ============================================================================
// Task Selectors — Workflow State
// ============================================================================

export const useActiveStorageTask = () =>
  useTaskStore((state: TaskStore) => state.activeTask)

export const useTaskContext = () =>
  useTaskStore((state: TaskStore) => state.context)

export const useStartStorageTask = () =>
  useTaskStore((state: TaskStore) => state.startTask)

export const useUpdateStorageTaskStatus = () =>
  useTaskStore((state: TaskStore) => state.updateTaskStatus)

export const useUpdateTaskContext = () =>
  useTaskStore((state: TaskStore) => state.updateContext)

export const useStopStorageTask = () =>
  useTaskStore((state: TaskStore) => state.stopTask)

// ============================================================================
// Storage Focus Selectors — PR7 unified runtime focus source
// ============================================================================

export const useStorageFocusSelectedCellId = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.selectedCellId)

export const useStorageFocusSelectedRackId = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.selectedRackId)

export const useStorageFocusActiveLevel = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.activeLevel)

export const useStorageFocusSelectCell = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.selectCell)

export const useStorageFocusSelectRack = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.selectRack)

export const useStorageFocusSetActiveLevel = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.setActiveLevel)

export const useStorageFocusClearCell = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.clearCell)

export const useStorageFocusClearAllFocus = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.clearAllFocus)

export const useStorageFocusHandleEmptyCanvasClick = () =>
  useStorageFocusStore((state: StorageFocusStore) => state.handleEmptyCanvasClick)

// ============================================================================
// Re-exports for convenience (types needed by consumer code)
// ============================================================================

export type { NavigationStore } from './navigation-store'
export type { SelectionStore } from './selection-store'
export type { StorageFocusStore } from './storage-focus-store'
export type {
  TaskStore,
  StorageTask,
  TaskContext,
  TaskStatus,
} from './task-store'
