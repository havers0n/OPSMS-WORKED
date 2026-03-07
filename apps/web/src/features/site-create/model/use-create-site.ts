import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { siteKeys } from '@/entities/site/api/queries';

type CreateSiteInput = {
  code: string;
  name: string;
  timezone: string;
};

async function createSite(input: CreateSiteInput) {
  const result = await bffRequest<{ id: string }>('/sites', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return result.id;
}

export function useCreateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.all });
    }
  });
}
