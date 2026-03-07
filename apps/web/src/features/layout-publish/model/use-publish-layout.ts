import { useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { publishLayoutVersion } from '@/features/layout-publish/api/mutations';

export function usePublishLayout(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutVersionId: string) => publishLayoutVersion(layoutVersionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.all });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
    }
  });
}
