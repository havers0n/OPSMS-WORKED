import type { LocationProductAssignment } from '@/entities/product-location-role/api/queries';
import type { StorageInspectorReadModel } from './use-storage-inspector-read-model';
import type { PanelMode, TaskKind } from './mode';
import { effectiveRoleSourceLabel, semanticRoleLabel } from './helpers';
import {
  projectContainerDetail,
  projectContainerRolePresentation,
  resolveStructuralDefaultFromLayout
} from './use-storage-inspector-read-model.selectors';

export interface StorageInspectorTaskContext {
  taskKind: TaskKind | null;
  baseMode: PanelMode;
}

export interface ContainerPolicySnapshot {
  selectedProduct: ReturnType<typeof projectContainerDetail>['selectedProduct'];
  selectedProductId: string | null;
  hasProductContext: boolean;
  isConflict: boolean;
  canShowOverrideEntry: boolean;
  canShowRepairConflictEntry: boolean;
  hasExplicitOverride: boolean;
  explicitAssignments: LocationProductAssignment[];
  firstExplicitRole: 'primary_pick' | 'reserve' | undefined;
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  showNoneExplanation: boolean;
}

function resolveExplicitAssignments(params: {
  assignments: LocationProductAssignment[];
  locationId: string | null;
  productId: string | null;
}): LocationProductAssignment[] {
  const { assignments, locationId, productId } = params;
  if (!locationId || !productId) return [];
  return assignments.filter(
    (assignment) =>
      assignment.locationId === locationId &&
      assignment.productId === productId &&
      assignment.state === 'published'
  );
}

export function buildContainerPolicySnapshot(readModel: StorageInspectorReadModel, containerId: string): ContainerPolicySnapshot {
  const detail = projectContainerDetail(readModel.storageRows, containerId);
  const structuralDefaultFromLayout = resolveStructuralDefaultFromLayout({
    cellId: readModel.cellId,
    publishedCells: readModel.publishedCells,
    racks: readModel.racks
  });
  const presentation = projectContainerRolePresentation({
    hasProductContext: detail.selectedProduct !== null,
    effectiveRoleLoading: detail.selectedProduct !== null && readModel.effectiveRoleLoading,
    effectiveRoleContext: readModel.effectiveRoleContext,
    structuralDefaultFromLayout
  });

  const explicitAssignments = resolveExplicitAssignments({
    assignments: readModel.locationProductAssignments,
    locationId: readModel.locationId,
    productId: detail.selectedProductId
  });
  const hasExplicitOverride = explicitAssignments.length > 0;
  const firstExplicitRole = explicitAssignments.find(
    (assignment) => assignment.role === 'primary_pick' || assignment.role === 'reserve'
  )?.role;

  return {
    selectedProduct: detail.selectedProduct,
    selectedProductId: detail.selectedProductId,
    hasProductContext: detail.selectedProduct !== null,
    isConflict: presentation.isConflict,
    canShowOverrideEntry: Boolean(readModel.locationId && detail.selectedProductId && !presentation.isConflict),
    canShowRepairConflictEntry: Boolean(readModel.locationId && detail.selectedProductId && presentation.isConflict),
    hasExplicitOverride,
    explicitAssignments,
    firstExplicitRole,
    structuralDefaultText: presentation.structuralDefaultText,
    effectiveRoleText: presentation.effectiveRoleText,
    sourceText: presentation.sourceText,
    showNoneExplanation: presentation.showNoneExplanation
  };
}

export interface StorageInspectorPolicy {
  shouldCloseEditOverrideTask: boolean;
  shouldCloseRepairConflictTask: boolean;
}

export function computeStorageInspectorPolicy(
  readModel: StorageInspectorReadModel,
  taskContext: StorageInspectorTaskContext
): StorageInspectorPolicy {
  const { taskKind, baseMode } = taskContext;

  if (taskKind === 'edit-override') {
    if (baseMode.kind !== 'container-detail') {
      return {
        shouldCloseEditOverrideTask: true,
        shouldCloseRepairConflictTask: false
      };
    }

    const container = buildContainerPolicySnapshot(readModel, baseMode.containerId);
    return {
      shouldCloseEditOverrideTask: !readModel.locationId || !container.selectedProductId || container.isConflict,
      shouldCloseRepairConflictTask: false
    };
  }

  if (taskKind === 'repair-conflict') {
    if (baseMode.kind !== 'container-detail') {
      return {
        shouldCloseEditOverrideTask: false,
        shouldCloseRepairConflictTask: true
      };
    }

    const container = buildContainerPolicySnapshot(readModel, baseMode.containerId);
    const source = readModel.effectiveRoleContext?.effectiveRoleSource;
    const shouldCloseBySource = !readModel.effectiveRoleLoading && source != null && source !== 'conflict';

    return {
      shouldCloseEditOverrideTask: false,
      shouldCloseRepairConflictTask:
        !readModel.locationId || !container.selectedProductId || shouldCloseBySource
    };
  }

  return {
    shouldCloseEditOverrideTask: false,
    shouldCloseRepairConflictTask: false
  };
}

export function getEditOverridePanelTexts(params: {
  structuralDefaultRole: 'primary_pick' | 'reserve' | 'none' | undefined;
  effectiveRole:
    | {
        effectiveRole: 'primary_pick' | 'reserve' | 'none' | null;
        effectiveRoleSource: 'explicit_override' | 'structural_default' | 'none' | 'conflict';
      }
    | null
    | undefined;
}) {
  const structuralDefaultText = semanticRoleLabel(params.structuralDefaultRole ?? 'none');
  const effectiveRoleText =
    params.effectiveRole == null
      ? 'Unknown'
      : params.effectiveRole.effectiveRoleSource === 'conflict'
        ? 'Conflict'
        : semanticRoleLabel(params.effectiveRole.effectiveRole ?? 'none');
  const sourceText =
    params.effectiveRole == null ? 'Unknown' : effectiveRoleSourceLabel(params.effectiveRole.effectiveRoleSource);

  return { structuralDefaultText, effectiveRoleText, sourceText };
}

export function useStorageInspectorPolicy(
  readModel: StorageInspectorReadModel,
  taskContext: StorageInspectorTaskContext
): StorageInspectorPolicy {
  return computeStorageInspectorPolicy(readModel, taskContext);
}
