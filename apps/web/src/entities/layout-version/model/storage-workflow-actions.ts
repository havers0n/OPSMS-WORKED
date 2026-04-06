import type { StoreApi } from 'zustand';
import type { ActiveStorageWorkflow } from './editor-types';

type StorageWorkflowState = {
  activeStorageWorkflow: ActiveStorageWorkflow;
};

type CreatedContainerPayload = {
  id: string;
  code: string;
};

type StorageWorkflowSetState = StoreApi<StorageWorkflowState>['setState'];

export function createStorageWorkflowActions(set: StorageWorkflowSetState) {
  return {
    setPlacementMoveTargetCellId: (cellId: string | null) =>
      set((state) => ({
        activeStorageWorkflow:
          state.activeStorageWorkflow?.kind === 'move-container' &&
          state.activeStorageWorkflow.status !== 'submitting'
            ? {
                ...state.activeStorageWorkflow,
                targetCellId: cellId,
                status: 'targeting',
                errorMessage: null
              }
            : state.activeStorageWorkflow
      })),
    cancelPlacementInteraction: () => set({ activeStorageWorkflow: null }),
    setActiveStorageWorkflowError: (errorMessage: string | null) =>
      set((state) => {
        if (state.activeStorageWorkflow === null) {
          return state;
        }

        if (errorMessage === null) {
          if (state.activeStorageWorkflow.kind === 'move-container') {
            return {
              activeStorageWorkflow: {
                ...state.activeStorageWorkflow,
                status: 'targeting',
                errorMessage: null
              }
            };
          }

          if (state.activeStorageWorkflow.kind === 'place-container') {
            return {
              activeStorageWorkflow: {
                ...state.activeStorageWorkflow,
                status: 'editing',
                errorMessage: null
              }
            };
          }

          if (state.activeStorageWorkflow.kind === 'place-location') {
            return {
              activeStorageWorkflow: {
                ...state.activeStorageWorkflow,
                status: 'targeting',
                errorMessage: null
              }
            };
          }

          return {
            activeStorageWorkflow: {
              ...state.activeStorageWorkflow,
              status:
                state.activeStorageWorkflow.createdContainer !== null
                  ? 'placement-retry'
                  : 'editing',
              errorMessage: null
            }
          };
        }

        if (state.activeStorageWorkflow.kind === 'place-location') {
          // place-location has no error status; leave state unchanged
          return state;
        }

        return {
          activeStorageWorkflow: {
            ...state.activeStorageWorkflow,
            status: 'error',
            errorMessage
          }
        };
      }),
    setCreateAndPlacePlacementRetry: (
      createdContainer: CreatedContainerPayload,
      errorMessage: string
    ) =>
      set((state) => {
        if (state.activeStorageWorkflow?.kind !== 'create-and-place') {
          return state;
        }

        return {
          activeStorageWorkflow: {
            ...state.activeStorageWorkflow,
            status: 'placement-retry',
            errorMessage,
            createdContainer
          }
        };
      }),
    markActiveStorageWorkflowSubmitting: () =>
      set((state) => {
        if (state.activeStorageWorkflow === null) {
          return state;
        }

        if (state.activeStorageWorkflow.kind === 'place-location') {
          // place-location has no submitting status
          return state;
        }

        return {
          activeStorageWorkflow: {
            ...state.activeStorageWorkflow,
            status: 'submitting',
            errorMessage: null
          }
        };
      })
  };
}
