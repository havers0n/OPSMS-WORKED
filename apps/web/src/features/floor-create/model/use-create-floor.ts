import { useMutation, useQueryClient } from '@tanstack/react-query';
import { floorKeys } from '@/entities/floor/api/queries';
import { supabase } from '@/shared/api/supabase/client';

type CreateFloorInput = {
  siteId: string;
  code: string;
  name: string;
  sortOrder: number;
};

async function createFloor(input: CreateFloorInput) {
  const { data, error } = await supabase
    .from('floors')
    .insert({ site_id: input.siteId, code: input.code, name: input.name, sort_order: input.sortOrder })
    .select('id')
    .single();
  if (error) {
    throw error;
  }

  return data.id as string;
}

export function useCreateFloor(siteId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFloor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: floorKeys.all });
      if (siteId) {
        void queryClient.invalidateQueries({ queryKey: floorKeys.listBySite(siteId) });
      }
    }
  });
}
