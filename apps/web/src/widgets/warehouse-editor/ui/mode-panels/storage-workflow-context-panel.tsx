import type { FloorWorkspace } from '@wos/domain';
import { MapPin, MoveRight, Package, PackagePlus, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  useActiveStorageWorkflow,
  useCancelPlacementInteraction,
  useMarkActiveStorageWorkflowSubmitting,
  useSetActiveStorageWorkflowError,
  useSetCreateAndPlacePlacementRetry,
  useSetSelectedCellId
} from '@/entities/layout-version/model/editor-selectors';
import type { ContextPanelMode } from '@/entities/layout-version/model/editor-types';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { useCreateContainer } from '@/features/container-create/model/use-create-container';
import { useMoveContainer } from '@/features/placement-actions/model/use-move-container';
import { usePlaceContainer } from '@/features/placement-actions/model/use-place-container';
import {
  filterStorableTypes,
  formatCreateAndPlacePlacementFailure,
  getCreateAndPlaceDisabledReasons
} from './cell-placement-inspector.lib';

export function StorageWorkflowContextPanel({
  workspace,
  panelMode
}: {
  workspace: FloorWorkspace | null;
  panelMode: ContextPanelMode;
}) {
  const activeStorageWorkflow = useActiveStorageWorkflow();
  const cancelPlacementInteraction = useCancelPlacementInteraction();
  const markActiveStorageWorkflowSubmitting = useMarkActiveStorageWorkflowSubmitting();
  const setActiveStorageWorkflowError = useSetActiveStorageWorkflowError();
  const setCreateAndPlacePlacementRetry = useSetCreateAndPlacePlacementRetry();
  const setSelectedCellId = useSetSelectedCellId();
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const [placeContainerIdInput, setPlaceContainerIdInput] = useState('');
  const [containerTypeIdInput, setContainerTypeIdInput] = useState('');
  const { data: containerTypes = [], isPending: isContainerTypesPending, isError: isContainerTypesError } =
    useContainerTypes();
  const storableTypes = useMemo(() => filterStorableTypes(containerTypes), [containerTypes]);
  const createContainer = useCreateContainer();

  const workflowCellId =
    activeStorageWorkflow?.kind === 'place-container' || activeStorageWorkflow?.kind === 'create-and-place'
      ? activeStorageWorkflow.cellId
      : activeStorageWorkflow?.kind === 'move-container'
        ? activeStorageWorkflow.targetCellId
        : null;
  const { data: workflowLocationRef } = useLocationByCell(workflowCellId);
  const placeContainer = usePlaceContainer({
    floorId: workspace?.floorId ?? null,
    locationId: workflowLocationRef?.locationId ?? null
  });
  const moveContainer = useMoveContainer({
    floorId: workspace?.floorId ?? null,
    sourceCellId:
      activeStorageWorkflow?.kind === 'move-container'
        ? activeStorageWorkflow.sourceCellId
        : null,
    containerId:
      activeStorageWorkflow?.kind === 'move-container'
        ? activeStorageWorkflow.containerId
        : null
  });

  useEffect(() => {
    setPlaceContainerIdInput('');
    setContainerTypeIdInput('');
  }, [activeStorageWorkflow?.kind, workflowCellId]);

  useEffect(() => {
    if (containerTypeIdInput.length === 0 && storableTypes.length > 0) {
      setContainerTypeIdInput(storableTypes[0].id);
    }
  }, [containerTypeIdInput, storableTypes]);

  const isExpanded = panelMode === 'expanded';

  if (activeStorageWorkflow === null) {
    return (
      <PlaceholderContent description="Workflow state will appear here while a storage operation is active." />
    );
  }

  if (activeStorageWorkflow.kind === 'move-container') {
    const sourceCell =
      publishedCells.find((cell) => cell.id === activeStorageWorkflow.sourceCellId) ?? null;
    const targetCell =
      activeStorageWorkflow.targetCellId
        ? (publishedCells.find((cell) => cell.id === activeStorageWorkflow.targetCellId) ?? null)
        : null;
    const targetValidationMessage =
      !activeStorageWorkflow.targetCellId
        ? 'Click a destination cell on the canvas.'
        : activeStorageWorkflow.targetCellId === activeStorageWorkflow.sourceCellId
          ? 'Target cell must differ from the source cell.'
          : !targetCell
            ? 'Selected target cell is unavailable in the published layout.'
            : !workflowLocationRef?.locationId
              ? 'Resolving destination location...'
              : null;
    const isSubmitting =
      activeStorageWorkflow.status === 'submitting' || moveContainer.isPending;

    const handleConfirmMove = async () => {
      if (
        !activeStorageWorkflow.targetCellId ||
        !workflowLocationRef?.locationId ||
        targetValidationMessage
      ) {
        return;
      }

      markActiveStorageWorkflowSubmitting();

      try {
        await moveContainer.mutateAsync({
          containerId: activeStorageWorkflow.containerId,
          targetLocationId: workflowLocationRef.locationId
        });
        setSelectedCellId(activeStorageWorkflow.targetCellId);
        cancelPlacementInteraction();
      } catch (error) {
        setActiveStorageWorkflowError(
          error instanceof Error ? error.message : 'Could not move the container.'
        );
      }
    };

    return (
      <div className={isExpanded ? 'px-4 py-4' : 'px-3 py-3'}>
        <div
          className={`rounded-xl border border-[var(--border-muted)] bg-white ${
            isExpanded ? 'p-4' : 'p-3'
          }`}
        >
          <div className="text-sm font-semibold text-slate-900">Move container</div>
          <div
            className="mt-1 truncate font-mono text-xs font-semibold text-slate-700"
            title={activeStorageWorkflow.containerId}
          >
            {activeStorageWorkflow.containerId}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Pick a destination cell on the canvas, then confirm the move here.
          </p>

          <div
            className={`mt-3 grid ${
              isExpanded ? 'grid-cols-2 gap-3' : 'gap-2'
            }`}
          >
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <MapPin className="h-3 w-3" />
                From
              </div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-slate-800">
                {sourceCell?.address.raw ?? activeStorageWorkflow.sourceCellId}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <MapPin className="h-3 w-3" />
                To
              </div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-slate-800">
                {targetCell?.address.raw ?? activeStorageWorkflow.targetCellId ?? 'Select target cell'}
              </div>
              {targetValidationMessage && (
                <p className="mt-1 text-[11px] text-amber-600">{targetValidationMessage}</p>
              )}
              {activeStorageWorkflow.errorMessage && (
                <p className="mt-1 text-[11px] text-red-500">{activeStorageWorkflow.errorMessage}</p>
              )}
            </div>
          </div>
        </div>

        <div className={`mt-3 grid grid-cols-2 ${isExpanded ? 'gap-3' : 'gap-2'}`}>
          <ContextActionButton
            label={isSubmitting ? 'Moving...' : 'Confirm move'}
            icon={MoveRight}
            disabled={isSubmitting || Boolean(targetValidationMessage)}
            onClick={() => void handleConfirmMove()}
          />
          <ContextActionButton
            label="Cancel move"
            icon={XCircle}
            variant="danger"
            disabled={isSubmitting}
            onClick={cancelPlacementInteraction}
          />
        </div>
      </div>
    );
  }

  const workflowCell =
    publishedCells.find((cell) => cell.id === activeStorageWorkflow.cellId) ?? null;
  const locationId = workflowLocationRef?.locationId ?? null;
  const isPlaceWorkflow = activeStorageWorkflow.kind === 'place-container';
  const createdContainer =
    activeStorageWorkflow.kind === 'create-and-place'
      ? activeStorageWorkflow.createdContainer
      : null;
  const isPlacementRetry =
    activeStorageWorkflow.kind === 'create-and-place' &&
    activeStorageWorkflow.status === 'placement-retry';
  const isSubmitting =
    activeStorageWorkflow.status === 'submitting' ||
    placeContainer.isPending ||
    createContainer.isPending;

  const handleConfirmPlace = async () => {
    const nextContainerId = placeContainerIdInput.trim();
    if (!locationId || nextContainerId.length === 0) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      await placeContainer.mutateAsync({
        containerId: nextContainerId,
        locationId
      });
      cancelPlacementInteraction();
    } catch (error) {
      setActiveStorageWorkflowError(
        error instanceof Error ? error.message : 'Could not place the container.'
      );
    }
  };

  const handleCreateAndPlace = async () => {
    if (
      activeStorageWorkflow.kind !== 'create-and-place' ||
      activeStorageWorkflow.status === 'placement-retry' ||
      !locationId ||
      containerTypeIdInput.length === 0
    ) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      const container = await createContainer.mutateAsync({
        containerTypeId: containerTypeIdInput,
        operationalRole: 'storage'
      });

      try {
        await placeContainer.mutateAsync({
          containerId: container.containerId,
          locationId
        });
        cancelPlacementInteraction();
      } catch (error) {
        setCreateAndPlacePlacementRetry(
          {
            id: container.containerId,
            code: container.systemCode
          },
          formatCreateAndPlacePlacementFailure(
            container.systemCode,
            error instanceof Error ? error.message : 'Placement failed.'
          )
        );
      }
    } catch (error) {
      setActiveStorageWorkflowError(
        error instanceof Error ? error.message : 'Could not create the container.'
      );
    }
  };

  const handleRetryCreatedContainerPlacement = async () => {
    if (
      activeStorageWorkflow.kind !== 'create-and-place' ||
      activeStorageWorkflow.status !== 'placement-retry' ||
      !activeStorageWorkflow.createdContainer ||
      !locationId
    ) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      await placeContainer.mutateAsync({
        containerId: activeStorageWorkflow.createdContainer.id,
        locationId
      });
      cancelPlacementInteraction();
    } catch (error) {
      setCreateAndPlacePlacementRetry(
        activeStorageWorkflow.createdContainer,
        formatCreateAndPlacePlacementFailure(
          activeStorageWorkflow.createdContainer.code,
          error instanceof Error ? error.message : 'Placement failed.'
        )
      );
    }
  };

  return (
    <div className={isExpanded ? 'px-4 py-4' : 'px-3 py-3'}>
      <div
        className={`rounded-xl border border-[var(--border-muted)] bg-white ${
          isExpanded ? 'p-4' : 'p-3'
        }`}
      >
        <div className="text-sm font-semibold text-slate-900">
          {isPlaceWorkflow
            ? 'Place existing container'
            : isPlacementRetry
              ? 'Retry container placement'
              : 'Create and place container'}
        </div>
        <div className="mt-1 font-mono text-xs font-semibold text-slate-700">
          {workflowCell?.address.raw ?? activeStorageWorkflow.cellId}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {isPlaceWorkflow
            ? 'Enter a container ID or code, then confirm placement here.'
            : isPlacementRetry
              ? 'Container created, but placement failed. Retry placement for the created container or cancel and leave it unplaced.'
              : 'Choose a storage-capable container type, then create and place it here.'}
        </p>

        <div className="mt-3">
          {isPlaceWorkflow ? (
            <input
              value={placeContainerIdInput}
              onChange={(event) => {
                setPlaceContainerIdInput(event.target.value);
                setActiveStorageWorkflowError(null);
              }}
              placeholder="Container ID or code"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700 outline-none"
            />
          ) : isPlacementRetry ? (
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Created container
              </div>
              <div
                className="mt-0.5 truncate font-mono text-xs font-semibold text-slate-800"
                title={
                  createdContainer
                    ? `${createdContainer.code} | ${createdContainer.id}`
                    : 'Unknown container'
                }
              >
                {createdContainer
                  ? `${createdContainer.code} | ${createdContainer.id}`
                  : 'Unknown container'}
              </div>
            </div>
          ) : (
            <select
              value={containerTypeIdInput}
              onChange={(event) => {
                setContainerTypeIdInput(event.target.value);
                setActiveStorageWorkflowError(null);
              }}
              disabled={isContainerTypesPending || isSubmitting || storableTypes.length === 0}
              className="w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-slate-700 outline-none"
            >
              {storableTypes.length === 0 && (
                <option value="">
                  {isContainerTypesPending
                    ? 'Loading container types...'
                    : 'No storage-capable container types available'}
                </option>
              )}
              {storableTypes.map((containerType) => (
                <option key={containerType.id} value={containerType.id}>
                  {containerType.code}
                </option>
              ))}
            </select>
          )}

          {isContainerTypesError && !isPlaceWorkflow && (
            <p className="mt-2 text-[11px] text-red-500">Could not load container types.</p>
          )}
          {activeStorageWorkflow.errorMessage && (
            <p className="mt-2 text-[11px] text-red-500">{activeStorageWorkflow.errorMessage}</p>
          )}
        </div>
      </div>

      <div className={`mt-3 grid grid-cols-2 ${isExpanded ? 'gap-3' : 'gap-2'}`}>
        {isPlaceWorkflow ? (
          <ContextActionButton
            label={isSubmitting ? 'Placing...' : 'Confirm place'}
            icon={PackagePlus}
            disabled={isSubmitting || placeContainerIdInput.trim().length === 0 || locationId === null}
            onClick={() => void handleConfirmPlace()}
          />
        ) : isPlacementRetry ? (
          <ContextActionButton
            label={isSubmitting ? 'Retrying...' : 'Retry placement'}
            icon={PackagePlus}
            disabled={isSubmitting || locationId === null || createdContainer === null}
            onClick={() => void handleRetryCreatedContainerPlacement()}
          />
        ) : (
          <ContextActionButton
            label={isSubmitting ? 'Working...' : 'Create + place'}
            icon={Package}
            disabled={
              getCreateAndPlaceDisabledReasons({
                isActionPending: isSubmitting,
                locationId,
                containerTypeId: containerTypeIdInput,
                storableTypeCount: storableTypes.length
              }).length > 0
            }
            onClick={() => void handleCreateAndPlace()}
          />
        )}
        <ContextActionButton
          label={isPlacementRetry ? 'Cancel and leave unplaced' : 'Cancel'}
          icon={XCircle}
          variant="danger"
          disabled={isSubmitting}
          onClick={cancelPlacementInteraction}
        />
      </div>
    </div>
  );
}

function ContextActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  className = '',
  disabled = false
}: {
  icon: typeof RotateCcw;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const buttonClassName =
    variant === 'danger'
      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
      : 'border-[var(--border-muted)] bg-white text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName} ${className}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PlaceholderContent({ description }: { description: string }) {
  return (
    <div className="px-3 py-3">
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>
    </div>
  );
}
