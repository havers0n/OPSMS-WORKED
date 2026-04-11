import {
  useNavigationStore,
  type NavigationStore,
} from './navigation-store'
import {
  useSelectionStore,
  type SelectionStore,
} from './selection-store'
import {
  useTaskStore,
  type TaskStore,
  type StorageTask,
  type TaskContext,
  type TaskStatus,
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
// Re-exports for convenience (types needed by consumer code)
// ============================================================================

export type { NavigationStore } from './navigation-store'
export type { SelectionStore } from './selection-store'
export type {
  TaskStore,
  StorageTask,
  TaskContext,
  TaskStatus,
} from './task-store'
