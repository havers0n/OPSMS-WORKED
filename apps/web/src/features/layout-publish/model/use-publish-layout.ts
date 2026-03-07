import { useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { publishLayoutVersion } from '../api/mutations';

export function usePublishLayout(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutVersionId: string) => publishLayoutVersion(layoutVersionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
    }
  });
}
