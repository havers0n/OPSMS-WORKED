import type { SupabaseClient } from '@supabase/supabase-js';
import {
  placeContainerAtLocation,
  type PlaceContainerAtLocationCommand,
  type PlaceContainerAtLocationResult
} from './place-container-at-location.js';
import { createPlacementRepo } from './placement-repo.js';

export type PlacementCommandService = {
  placeContainerAtLocation(command: PlaceContainerAtLocationCommand): Promise<PlaceContainerAtLocationResult>;
};

export function createPlacementCommandService(supabase: SupabaseClient): PlacementCommandService {
  const repo = createPlacementRepo(supabase);

  return {
    placeContainerAtLocation: (command) => placeContainerAtLocation(repo, command)
  };
}
