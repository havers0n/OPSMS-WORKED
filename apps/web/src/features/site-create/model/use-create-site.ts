import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/api/supabase/client';
import { siteKeys } from '@/entities/site/api/queries';

type CreateSiteInput = {
  code: string;
  name: string;
  timezone: string;
};

async function createSite(input: CreateSiteInput) {
  const { data, error } = await supabase.from('sites').insert({ code: input.code, name: input.name, timezone: input.timezone }).select('id').single();
  if (error) {
    throw error;
  }

  return data.id as string;
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
