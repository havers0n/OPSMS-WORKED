import { create } from 'zustand'

export type TaskStatus = 'idle' | 'selecting' | 'editing' | 'confirming' | 'error'

export type StorageTask =
  | {
      kind: 'place'
      targetLocationId: string
      containerId?: string
      status: TaskStatus
    }
  | {
      kind: 'move'
      containerId: string
      sourceLocationId: string
      targetLocationId?: string
      status: TaskStatus
    }
  | {
      kind: 'edit-inventory'
      containerId: string
      status: TaskStatus
    }
  | null

export type TaskContext = {
  returnToLocationId?: string
  errorMessage?: string
}

export type TaskStore = {
  activeTask: StorageTask
  context: TaskContext
  // Actions
  startTask: (task: Exclude<StorageTask, null>, context?: TaskContext) => void
  updateTaskStatus: (status: TaskStatus) => void
  updateContext: (updates: Partial<TaskContext>) => void
  stopTask: () => void
}

const initialState = {
  activeTask: null as StorageTask,
  context: {} as TaskContext,
}

export const useTaskStore = create<TaskStore>((set) => ({
  ...initialState,
  startTask: (task, context) =>
    set({
      activeTask: task,
      context: context ?? {},
    }),
  updateTaskStatus: (status: TaskStatus) =>
    set((state) => {
      if (state.activeTask === null) return state
      return {
        activeTask: {
          ...state.activeTask,
          status,
        },
      }
    }),
  updateContext: (updates) =>
    set((state) => ({
      context: {
        ...state.context,
        ...updates,
      },
    })),
  stopTask: () =>
    set({
      activeTask: null,
      context: {},
    }),
}))

export function resetTaskStore() {
  useTaskStore.setState({
    activeTask: null,
    context: {},
  })
}
