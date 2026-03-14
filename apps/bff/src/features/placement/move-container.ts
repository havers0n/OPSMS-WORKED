import type { PlacementCommandResponse } from '@wos/domain';
import {
  ActivePlacementNotFoundError,
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  CrossFloorPlacementMoveNotAllowedError,
  PlacementSourceMismatchError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError,
  TargetCellSameAsSourceError
} from './errors.js';
import type { PlacementRepo } from './placement-repo.js';

export type MoveContainerCommand = {
  tenantId: string;
  containerId: string;
  fromCellId: string;
  toCellId: string;
  actorId?: string | null;
};

export async function moveContainer(
  repo: PlacementRepo,
  command: MoveContainerCommand
): Promise<PlacementCommandResponse> {
  const container = await repo.resolveContainer(command.containerId, command.tenantId);
  if (!container) {
    throw new ContainerNotFoundError();
  }

  const activePlacement = await repo.getActivePlacement(container.id);
  if (!activePlacement) {
    throw new ActivePlacementNotFoundError();
  }

  const sourceCells = await repo.resolveSourceCells(command.fromCellId);
  const sourceCell = sourceCells.find((cell) => cell.id === activePlacement.cellId) ?? null;
  if (!sourceCell) {
    throw new PlacementSourceMismatchError();
  }

  const targetCell = await repo.resolvePlaceTarget(command.toCellId);
  if (!targetCell) {
    throw new TargetCellNotFoundError();
  }

  if (targetCell.id === sourceCell.id) {
    throw new TargetCellSameAsSourceError();
  }

  if (targetCell.floorId !== sourceCell.floorId) {
    throw new CrossFloorPlacementMoveNotAllowedError();
  }

  try {
    await repo.moveContainerFromCell(
      container.id,
      sourceCell.id,
      targetCell.id,
      command.actorId ?? null
    );
  } catch (error) {
    if (
      error instanceof ActivePlacementNotFoundError ||
      error instanceof ContainerAlreadyPlacedError ||
      error instanceof PlacementSourceMismatchError ||
      error instanceof PublishedLayoutNotFoundError ||
      error instanceof TargetCellNotFoundError ||
      error instanceof TargetCellSameAsSourceError ||
      error instanceof CrossFloorPlacementMoveNotAllowedError
    ) {
      throw error;
    }

    throw error;
  }

  return {
    ok: true,
    containerId: command.containerId,
    fromCellId: command.fromCellId,
    toCellId: command.toCellId
  };
}
