import type { SupabaseClient } from '@supabase/supabase-js';

type CreateFloorInput = {
  siteId: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type FloorsRepo = {
  createFloor(input: CreateFloorInput): Promise<string>;
};

export function createFloorsRepo(supabase: SupabaseClient): FloorsRepo {
  return {
    async createFloor(input) {
      const { data, error } = await supabase
        .from('floors')
        .insert({
          site_id: input.siteId,
          code: input.code,
          name: input.name,
          sort_order: input.sortOrder
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return (data as { id: string }).id;
    }
  };
}
