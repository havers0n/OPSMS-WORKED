import type { SupabaseClient } from '@supabase/supabase-js';
import { createFloorsRepo } from './repo.js';

type CreateFloorInput = {
  siteId: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type FloorsService = {
  createFloor(input: CreateFloorInput): Promise<string>;
};

export function createFloorsService(supabase: SupabaseClient): FloorsService {
  const repo = createFloorsRepo(supabase);
  return {
    createFloor: (input) => repo.createFloor(input)
  };
}
