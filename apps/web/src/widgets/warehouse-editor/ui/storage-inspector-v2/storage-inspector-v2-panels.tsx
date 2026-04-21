import React from 'react';
import { EmptyState } from './empty-state';
import { LoadingState } from './loading-state';
import { RackOverviewPanel } from './rack-overview-panel';
import { CellOverviewPanel } from './cell-overview-panel';
import { ContainerDetailPanel } from './container-detail-panel';
import { CreateContainerTaskPanel } from './task-create-container-panel';
import { CreateContainerWithProductTaskPanel } from './task-create-container-with-product-panel';
import { MoveContainerTaskPanel } from './task-move-container-panel';
import { AddProductToContainerTaskPanel } from './task-add-product-panel';
import { EditOverrideTaskPanel } from './task-edit-override-panel';
import { RepairConflictTaskPanel } from './task-repair-conflict-panel';
import type { PanelMode } from './mode';
import type { StorageInspectorReadModel } from './use-storage-inspector-read-model';
import type { StorageInspectorActions } from './use-storage-inspector-actions';
import type { StorageInspectorUiState } from './use-storage-inspector-ui-state';
import { buildContainerPolicySnapshot } from './use-storage-inspector-policy';
import { projectContainerDetail } from './use-storage-inspector-read-model.selectors';

interface StorageInspectorV2PanelsProps {
  mode: PanelMode;
  readModel: StorageInspectorReadModel;
  actions: StorageInspectorActions;
  ui: StorageInspectorUiState;
  selectCell: (params: { cellId: string; rackId: string; level: number | null }) => void;
}

export function StorageInspectorV2Panels({
  mode,
  readModel,
  actions,
  ui,
  selectCell
}: StorageInspectorV2PanelsProps) {
  if (mode.kind === 'empty') {
    return <EmptyState />;
  }

  if (mode.kind === 'rack-overview') {
    return <RackOverviewPanel rackId={mode.rackId} />;
  }

  if (mode.kind === 'task-move-container') {
    const isTargetSameAsSource = ui.moveTaskState?.targetCellId === ui.moveTaskState?.sourceCellId;
    const resolvedTargetLocationId = readModel.moveTargetLocationRef?.locationId ?? null;
    const canConfirm =
      ui.moveTaskState !== null &&
      ui.moveTaskState.targetCellId !== null &&
      !isTargetSameAsSource &&
      resolvedTargetLocationId !== null &&
      ui.moveTaskState.stage === 'selecting-target';

    return (
      <MoveContainerTaskPanel
        moveTaskState={ui.moveTaskState!}
        rackDisplayCode={readModel.rackDisplayCode}
        targetLocationLoading={readModel.moveTargetLocationLoading}
        resolvedTargetLocationId={resolvedTargetLocationId}
        canConfirm={canConfirm}
        onConfirm={() =>
          void actions.onMoveContainerConfirm({
            moveTaskState: ui.moveTaskState,
            resolvedTargetLocationId,
            onStageChange: (stage, error) => {
              ui.setMoveTaskState((prev) => (prev ? { ...prev, stage, errorMessage: error ?? null } : null));
            }
          })
        }
        onCancel={() => {
          const source = ui.moveTaskState!;
          ui.setTaskKind(null);
          ui.setMoveTaskState(null);
          ui.setSelectedContainerId(null);

          const restoreRackId = source.sourceRackId ?? readModel.rackId;
          if (!restoreRackId) return;

          selectCell({
            cellId: source.sourceCellId,
            rackId: restoreRackId,
            level: source.sourceLevel ?? readModel.activeLevel ?? null
          });
        }}
        onDone={() => {
          const movedContainerId = ui.moveTaskState!.sourceContainerId;
          ui.setTaskKind(null);
          ui.setMoveTaskState(null);
          ui.setSelectedContainerId(movedContainerId);
        }}
      />
    );
  }

  if (readModel.locationRefLoading || (readModel.locationId && readModel.storageLoading)) {
    return <LoadingState />;
  }

  if (mode.kind === 'task-create-container') {
    return (
      <CreateContainerTaskPanel
        containerTypes={readModel.containerTypes}
        containerTypeId={ui.createContainerTypeId}
        externalCode={ui.createExternalCode}
        isSubmitting={ui.createIsSubmitting}
        locationId={readModel.locationId}
        errorMessage={ui.createErrorMessage}
        rackDisplayCode={readModel.rackDisplayCode}
        locationCode={readModel.locationCode}
        activeLevel={readModel.activeLevel}
        onContainerTypeChange={ui.setCreateContainerTypeId}
        onExternalCodeChange={ui.setCreateExternalCode}
        onConfirm={() =>
          void actions.onCreateContainer({
            containerTypeId: ui.createContainerTypeId,
            externalCode: ui.createExternalCode,
            isSubmitting: ui.createIsSubmitting,
            setIsSubmitting: ui.setCreateIsSubmitting,
            setErrorMessage: ui.setCreateErrorMessage,
            onSuccess: ui.closeCreateTask
          })
        }
        onCancel={ui.closeCreateTask}
      />
    );
  }

  if (mode.kind === 'task-create-container-with-product') {
    return (
      <CreateContainerWithProductTaskPanel
        containerTypes={readModel.containerTypes}
        containerTypeId={ui.createWithProductContainerTypeId}
        externalCode={ui.createWithProductExternalCode}
        productSearch={ui.createWithProductSearch}
        selectedProduct={ui.createWithProductSelectedProduct}
        searchResults={readModel.createWithProductSearchResults}
        quantity={ui.createWithProductQuantity}
        uom={ui.createWithProductUom}
        isSubmitting={ui.createWithProductIsSubmitting}
        locationId={readModel.locationId}
        errorMessage={ui.createWithProductErrorMessage}
        rackDisplayCode={readModel.rackDisplayCode}
        locationCode={readModel.locationCode}
        activeLevel={readModel.activeLevel}
        onContainerTypeChange={ui.setCreateWithProductContainerTypeId}
        onExternalCodeChange={ui.setCreateWithProductExternalCode}
        onProductSearchChange={(value) => {
          ui.setCreateWithProductSearch(value);
          ui.setCreateWithProductSelectedProduct(null);
        }}
        onProductSelect={(product) => {
          ui.setCreateWithProductSelectedProduct(product);
          ui.setCreateWithProductSearch(product.name ?? product.sku ?? '');
        }}
        onQuantityChange={ui.setCreateWithProductQuantity}
        onUomChange={ui.setCreateWithProductUom}
        onConfirm={() =>
          void actions.onCreateContainerWithProduct({
            containerTypeId: ui.createWithProductContainerTypeId,
            externalCode: ui.createWithProductExternalCode,
            productId: ui.createWithProductSelectedProduct?.id ?? null,
            quantity: ui.createWithProductQuantity,
            uom: ui.createWithProductUom,
            isSubmitting: ui.createWithProductIsSubmitting,
            setIsSubmitting: ui.setCreateWithProductIsSubmitting,
            setErrorMessage: ui.setCreateWithProductErrorMessage,
            onSuccess: ui.closeCreateWithProductTask
          })
        }
        onCancel={ui.closeCreateWithProductTask}
      />
    );
  }

  if (mode.kind === 'task-add-product-to-container') {
    const containerDetail = projectContainerDetail(readModel.storageRows, mode.containerId);

    return (
      <AddProductToContainerTaskPanel
        rackDisplayCode={readModel.rackDisplayCode}
        activeLevel={readModel.activeLevel}
        locationCode={readModel.locationCode}
        containerDisplayCode={containerDetail.displayCode}
        isContainerEmpty={containerDetail.isEmptyContainer}
        locationId={readModel.locationId}
        isSubmitting={actions.addInventoryToContainer.isPending}
        errorMessage={ui.addProductErrorMessage}
        productSearch={ui.addProductSearch}
        selectedProduct={ui.addProductSelectedProduct}
        searchResults={readModel.addProductSearchResults}
        quantity={ui.addProductQuantity}
        uom={ui.addProductUom}
        onProductSearchChange={(value) => {
          ui.setAddProductSearch(value);
          ui.setAddProductSelectedProduct(null);
        }}
        onProductSelect={(product) => {
          ui.setAddProductSelectedProduct(product);
          ui.setAddProductSearch(product.name ?? product.sku ?? '');
        }}
        onQuantityChange={ui.setAddProductQuantity}
        onUomChange={ui.setAddProductUom}
        onConfirm={() =>
          void actions.onAddProductToContainer({
            containerId: mode.containerId,
            productId: ui.addProductSelectedProduct?.id ?? null,
            quantity: ui.addProductQuantity,
            uom: ui.addProductUom,
            isContainerEmpty: containerDetail.isEmptyContainer,
            setErrorMessage: ui.setAddProductErrorMessage,
            onSuccess: ui.closeAddProductTask
          })
        }
        onCancel={ui.closeAddProductTask}
      />
    );
  }

  if (mode.kind === 'task-edit-override') {
    const containerPolicy = buildContainerPolicySnapshot(readModel, mode.containerId);

    if (!readModel.locationId || !containerPolicy.selectedProduct || !containerPolicy.selectedProductId) {
      return <LoadingState />;
    }

    const defaultRole = containerPolicy.firstExplicitRole ?? 'primary_pick';

    return (
      <EditOverrideTaskPanel
        rackDisplayCode={readModel.rackDisplayCode}
        activeLevel={readModel.activeLevel}
        locationCode={readModel.locationCode}
        product={containerPolicy.selectedProduct}
        structuralDefaultText={containerPolicy.structuralDefaultText}
        effectiveRoleText={containerPolicy.effectiveRoleText}
        sourceText={containerPolicy.sourceText}
        hasExplicitOverride={containerPolicy.hasExplicitOverride}
        defaultRole={defaultRole}
        isSubmitting={ui.editOverrideIsSubmitting}
        errorMessage={ui.editOverrideErrorMessage}
        onCancel={ui.closeEditOverrideTask}
        onSave={async (role) => {
          await actions.onSaveOverride({
            locationId: readModel.locationId!,
            productId: containerPolicy.selectedProductId!,
            role,
            explicitAssignmentIds: containerPolicy.explicitAssignments.map((a) => a.id),
            setIsSubmitting: ui.setEditOverrideIsSubmitting,
            setErrorMessage: ui.setEditOverrideErrorMessage,
            onSuccess: () => {
              ui.setTaskKind(null);
              ui.resetEditOverrideTaskState();
            }
          });
        }}
        onClear={async () => {
          await actions.onClearOverride({
            locationId: readModel.locationId!,
            productId: containerPolicy.selectedProductId!,
            explicitAssignmentIds: containerPolicy.explicitAssignments.map((a) => a.id),
            setIsSubmitting: ui.setEditOverrideIsSubmitting,
            setErrorMessage: ui.setEditOverrideErrorMessage,
            onSuccess: () => {
              ui.setTaskKind(null);
              ui.resetEditOverrideTaskState();
            }
          });
        }}
      />
    );
  }

  if (mode.kind === 'task-repair-conflict') {
    const containerPolicy = buildContainerPolicySnapshot(readModel, mode.containerId);

    if (!readModel.locationId || !containerPolicy.selectedProduct || !containerPolicy.selectedProductId) {
      return <LoadingState />;
    }

    const targetAssignments = containerPolicy.explicitAssignments;
    const conflictingRoles =
      targetAssignments.length > 0
        ? Array.from(new Set(targetAssignments.map((assignment) => assignment.role)))
        : (readModel.effectiveRoleContext?.conflictingPublishedRoles ?? []);
    const conflictingRowCount = targetAssignments.length;
    const conflictingRowIds = targetAssignments.map((assignment) => assignment.id);
    const canRepair = targetAssignments.length > 0;
    const noTargetsMessage = canRepair
      ? null
      : 'Cannot repair conflict because canonical published explicit rows are unavailable for this product/location.';
    const combinedErrorMessage = ui.repairConflictErrorMessage ?? noTargetsMessage;

    return (
      <RepairConflictTaskPanel
        rackDisplayCode={readModel.rackDisplayCode}
        activeLevel={readModel.activeLevel}
        locationCode={readModel.locationCode}
        product={containerPolicy.selectedProduct}
        structuralDefaultText={containerPolicy.structuralDefaultText}
        effectiveRoleText="Conflict"
        sourceText="Conflict"
        conflictingRoles={conflictingRoles}
        conflictingRowCount={conflictingRowCount}
        conflictingRowIds={conflictingRowIds}
        isSubmitting={ui.repairConflictIsSubmitting}
        errorMessage={combinedErrorMessage}
        onCancel={ui.closeRepairConflictTask}
        onResolve={async (role) => {
          await actions.onResolveConflict({
            locationId: readModel.locationId!,
            productId: containerPolicy.selectedProductId!,
            role,
            targetAssignmentIds: conflictingRowIds,
            canRepair,
            setIsSubmitting: ui.setRepairConflictIsSubmitting,
            setErrorMessage: ui.setRepairConflictErrorMessage,
            onSuccess: () => {
              ui.setTaskKind(null);
              ui.resetRepairConflictTaskState();
            }
          });
        }}
        onClear={async () => {
          await actions.onClearConflict({
            locationId: readModel.locationId!,
            productId: containerPolicy.selectedProductId!,
            targetAssignmentIds: conflictingRowIds,
            canRepair,
            setIsSubmitting: ui.setRepairConflictIsSubmitting,
            setErrorMessage: ui.setRepairConflictErrorMessage,
            onSuccess: () => {
              ui.setTaskKind(null);
              ui.resetRepairConflictTaskState();
            }
          });
        }}
      />
    );
  }

  if (mode.kind === 'container-detail') {
    const containerDetail = projectContainerDetail(readModel.storageRows, mode.containerId);
    const containerPolicy = buildContainerPolicySnapshot(readModel, mode.containerId);

    return (
      <ContainerDetailPanel
        rackDisplayCode={readModel.rackDisplayCode}
        activeLevel={readModel.activeLevel}
        locationCode={readModel.locationCode}
        displayCode={containerDetail.displayCode}
        firstRow={containerDetail.firstRow}
        items={containerDetail.items}
        selectedProduct={containerPolicy.selectedProduct}
        structuralDefaultText={containerPolicy.structuralDefaultText}
        effectiveRoleText={containerPolicy.effectiveRoleText}
        sourceText={containerPolicy.sourceText}
        hasProductContext={containerPolicy.hasProductContext}
        isConflict={containerPolicy.isConflict}
        showNoneExplanation={containerPolicy.showNoneExplanation}
        canShowOverrideEntry={containerPolicy.canShowOverrideEntry}
        hasExplicitOverride={containerPolicy.hasExplicitOverride}
        canShowRepairConflictEntry={containerPolicy.canShowRepairConflictEntry}
        isEmptyContainer={containerDetail.isEmptyContainer}
        onBack={() => ui.setSelectedContainerId(null)}
        onOpenEditOverrideTask={() => {
          if (!containerPolicy.canShowOverrideEntry) return;
          ui.resetEditOverrideTaskState();
          ui.setTaskKind('edit-override');
        }}
        onOpenRepairConflictTask={ui.openRepairConflictTask}
        onOpenAddProductTask={ui.openAddProductTask}
        onStartMoveContainer={() => {
          if (!readModel.cellId || !readModel.locationId) return;
          ui.setMoveTaskState({
            sourceContainerId: mode.containerId,
            sourceCellId: readModel.cellId,
            sourceLocationId: readModel.locationId,
            sourceRackId: readModel.rackId,
            sourceLevel: readModel.activeLevel,
            sourceLocationCode: readModel.locationCode,
            sourceContainerDisplayCode: containerDetail.displayCode,
            targetCellId: null,
            stage: 'selecting-target',
            errorMessage: null
          });
          ui.setTaskKind('move-container');
        }}
      />
    );
  }

  return (
    <CellOverviewPanel
      rackDisplayCode={readModel.rackDisplayCode}
      activeLevel={readModel.activeLevel}
      locationCode={readModel.locationCode}
      isOccupied={readModel.isOccupied}
      locationType={readModel.storageRows[0]?.locationType ?? null}
      containers={readModel.containers}
      inventoryPreviewRows={readModel.inventoryPreviewRows}
      inventoryOverflow={readModel.inventoryOverflow}
      onSelectContainer={ui.setSelectedContainerId}
      onOpenCreateTask={ui.openCreateTask}
      onOpenCreateWithProductTask={ui.openCreateWithProductTask}
    />
  );
}
