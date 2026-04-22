import type { ReactNode } from 'react';
import type { Cell } from '@wos/domain';
import type { OperationsCellRuntime } from '@wos/domain';
import { RackBody } from '@/widgets/warehouse-editor/ui/shapes/rack-body';
import { RackCells } from '@/widgets/warehouse-editor/ui/shapes/rack-cells';
import { RackSections } from '@/widgets/warehouse-editor/ui/shapes/rack-sections';
import { WarehouseScene } from './warehouse-scene';
import {
  faceAStory,
  faceBStory,
  pairedRackGeometryStory,
  pairedRackStory,
  publishedCellsByStructureStory
} from './warehouse-story-fixtures';

type WarehouseScenarioComposerProps = {
  activeLevelIndex?: number;
  publishedCellsByStructure?: Map<string, Cell>;
  occupiedCellIds?: Set<string>;
  cellRuntimeById?: Map<string, OperationsCellRuntime>;
  isRackSelected?: boolean;
  showCells?: boolean;
  selectedCellId?: string | null;
  locateTargetCellId?: string | null;
  workflowSourceCellId?: string | null;
  highlightedCellIds?: Set<string>;
  isWorkflowScope?: boolean;
  isPassive?: boolean;
  showFocusedFullAddress?: boolean;
  panel?: ReactNode;
};

export function WarehouseScenarioComposer({
  activeLevelIndex = 1,
  publishedCellsByStructure = publishedCellsByStructureStory,
  occupiedCellIds = new Set<string>(),
  cellRuntimeById = new Map<string, OperationsCellRuntime>(),
  isRackSelected = false,
  showCells = true,
  selectedCellId = null,
  locateTargetCellId = null,
  workflowSourceCellId = null,
  highlightedCellIds = new Set<string>(),
  isWorkflowScope = false,
  isPassive = false,
  showFocusedFullAddress = true,
  panel
}: WarehouseScenarioComposerProps) {
  const sceneWidth = Math.ceil(pairedRackGeometryStory.width + 40);
  const sceneHeight = Math.ceil(pairedRackGeometryStory.height + 40);

  return (
    <div className="flex items-start gap-4">
      <WarehouseScene width={sceneWidth} height={sceneHeight}>
        <RackBody
          geometry={pairedRackGeometryStory}
          displayCode={pairedRackStory.displayCode}
          rotationDeg={0}
          isSelected={isRackSelected}
          isHovered={false}
          isPassive={isPassive}
          showRackCode={true}
          rackCodeProminence="dominant"
          rackCodePlacement="header-left"
        />
        <RackSections
          geometry={pairedRackGeometryStory}
          faceA={faceAStory}
          faceB={faceBStory}
          isSelected={isRackSelected}
          isPassive={isPassive}
          rackRotationDeg={0}
          showFaceToken={true}
          showSectionNumbers={true}
          faceTokenProminence="dominant"
          sectionNumberProminence="dominant"
        />
        {showCells ? (
          <RackCells
            geometry={pairedRackGeometryStory}
            rackId={pairedRackStory.id}
            faceA={faceAStory}
            faceB={faceBStory}
            isSelected={isRackSelected}
            activeLevelIndex={activeLevelIndex}
            publishedCellsByStructure={publishedCellsByStructure}
            occupiedCellIds={occupiedCellIds}
            cellRuntimeById={cellRuntimeById}
            highlightedCellIds={highlightedCellIds}
            isInteractive={false}
            isWorkflowScope={isWorkflowScope}
            isPassive={isPassive}
            rackRotationDeg={0}
            selectedCellId={selectedCellId}
            locateTargetCellId={locateTargetCellId}
            workflowSourceCellId={workflowSourceCellId}
            showCellNumbers={true}
            cellNumberProminence="dominant"
            showFocusedFullAddress={showFocusedFullAddress}
          />
        ) : null}
      </WarehouseScene>

      {panel ? (
        <div className="h-[32rem] w-[21rem] overflow-hidden rounded-xl border border-gray-200 bg-white">
          {panel}
        </div>
      ) : null}
    </div>
  );
}
