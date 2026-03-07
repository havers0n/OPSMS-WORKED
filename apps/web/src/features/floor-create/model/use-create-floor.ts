import { useMutation, useQueryClient } from '@tanstack/react-query';
import { floorKeys } from '@/entities/floor/api/queries';
import { bffRequest } from '@/shared/api/bff/client';

type CreateFloorInput = {
  siteId: string;
  code: string;
  name: string;
  sortOrder: number;
};

async function createFloor(input: CreateFloorInput) {
  const result = await bffRequest<{ id: string }>('/floors', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return result.id;
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
