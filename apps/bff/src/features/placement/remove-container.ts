import type { PlacementCommandResponse } from '@wos/domain';
import {
  ActivePlacementNotFoundError,
  ContainerNotFoundError,
  PlacementSourceMismatchError
} from './errors.js';
import type { PlacementRepo } from './placement-repo.js';

export type RemoveContainerCommand = {
  tenantId: string;
  containerId: string;
  fromCellId: string;
  actorId?: string | null;
};

export async function removeContainer(
  repo: PlacementRepo,
  command: RemoveContainerCommand
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
  if (!sourceCells.some((cell) => cell.id === activePlacement.cellId)) {
    throw new PlacementSourceMismatchError();
  }

  await repo.removeContainerFromCells(
    container.id,
    sourceCells.map((cell) => cell.id),
    command.actorId ?? null
  );

  return {
    ok: true,
    containerId: command.containerId,
    fromCellId: command.fromCellId
  };
}
