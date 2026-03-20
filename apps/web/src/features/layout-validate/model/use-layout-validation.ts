import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { layoutValidationKeys } from '../api/queries';
import { validateLayoutVersion } from '../api/mutations';

export function useCachedLayoutValidation(layoutVersionId: string | null) {
  return useQuery({
    queryKey: layoutValidationKeys.byLayoutVersion(layoutVersionId),
    queryFn: () => validateLayoutVersion(layoutVersionId as string),
    enabled: false
  });
}

export function useLayoutValidation(layoutVersionId: string | null) {
  const queryClient = useQueryClient();
  const cachedValidation = useCachedLayoutValidation(layoutVersionId);

  const mutation = useMutation({
    mutationFn: (validatedLayoutVersionId: string) => validateLayoutVersion(validatedLayoutVersionId),
    onSuccess: (result, validatedLayoutVersionId) => {
      queryClient.setQueryData(layoutValidationKeys.byLayoutVersion(validatedLayoutVersionId), result);
    }
  });

  return {
    ...mutation,
    cachedResult: cachedValidation.data
  };
}
