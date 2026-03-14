import type { PlacementCommandResponse } from '@wos/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { moveContainer, type MoveContainerCommand } from './move-container.js';
import { placeContainer, type PlaceContainerCommand } from './place-container.js';
import { createPlacementRepo } from './placement-repo.js';
import { removeContainer, type RemoveContainerCommand } from './remove-container.js';

export type PlacementCommandService = {
  placeContainer(command: PlaceContainerCommand): Promise<PlacementCommandResponse>;
  removeContainer(command: RemoveContainerCommand): Promise<PlacementCommandResponse>;
  moveContainer(command: MoveContainerCommand): Promise<PlacementCommandResponse>;
};

export function createPlacementCommandService(supabase: SupabaseClient): PlacementCommandService {
  const repo = createPlacementRepo(supabase);

  return {
    placeContainer: (command) => placeContainer(repo, command),
    removeContainer: (command) => removeContainer(repo, command),
    moveContainer: (command) => moveContainer(repo, command)
  };
}
