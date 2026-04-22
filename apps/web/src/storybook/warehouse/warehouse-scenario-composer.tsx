import type { ReactNode } from 'react';
import { RackBody } from '@/widgets/warehouse-editor/ui/shapes/rack-body';
import { RackCells } from '@/widgets/warehouse-editor/ui/shapes/rack-cells';
import { RackSections } from '@/widgets/warehouse-editor/ui/shapes/rack-sections';
import { WarehouseScene } from './warehouse-scene';
import {
  cellRuntimeByIdStory,
  faceAStory,
  faceBStory,
  occupiedCellIdsStory,
  pairedRackGeometryStory,
  pairedRackStory,
  publishedCellsByStructureStory
} from './warehouse-story-fixtures';

type WarehouseScenarioComposerProps = {
  activeLevelIndex?: number;
  selectedCellId?: string | null;
  locateTargetCellId?: string | null;
  workflowSourceCellId?: string | null;
  highlightedCellIds?: Set<string>;
  occupiedCellIds?: Set<string>;
  isPassive?: boolean;
  showFocusedFullAddress?: boolean;
  panel?: ReactNode;
};

export function WarehouseScenarioComposer({
  activeLevelIndex = 1,
  selectedCellId = null,
  locateTargetCellId = null,
  workflowSourceCellId = null,
  highlightedCellIds = new Set<string>(),
  occupiedCellIds = occupiedCellIdsStory,
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
          isSelected={true}
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
          isSelected={true}
          isPassive={isPassive}
          rackRotationDeg={0}
          showFaceToken={true}
          showSectionNumbers={true}
          faceTokenProminence="dominant"
          sectionNumberProminence="dominant"
        />
        <RackCells
          geometry={pairedRackGeometryStory}
          rackId={pairedRackStory.id}
          faceA={faceAStory}
          faceB={faceBStory}
          isSelected={true}
          activeLevelIndex={activeLevelIndex}
          publishedCellsByStructure={publishedCellsByStructureStory}
          occupiedCellIds={occupiedCellIds}
          cellRuntimeById={cellRuntimeByIdStory}
          highlightedCellIds={highlightedCellIds}
          isInteractive={false}
          isWorkflowScope={false}
          isPassive={isPassive}
          rackRotationDeg={0}
          selectedCellId={selectedCellId}
          locateTargetCellId={locateTargetCellId}
          workflowSourceCellId={workflowSourceCellId}
          showCellNumbers={true}
          cellNumberProminence="dominant"
          showFocusedFullAddress={showFocusedFullAddress}
        />
      </WarehouseScene>

      {panel ? (
        <div className="h-[32rem] w-[21rem] overflow-hidden rounded-xl border border-gray-200 bg-white">
          {panel}
        </div>
      ) : null}
    </div>
  );
}
