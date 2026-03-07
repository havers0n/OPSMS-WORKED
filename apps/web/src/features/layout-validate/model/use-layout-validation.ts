import { useMutation } from '@tanstack/react-query';
import { validateLayoutVersion } from '@/features/layout-validate/api/mutations';

export function useLayoutValidation() {
  return useMutation({
    mutationFn: (layoutVersionId: string) => validateLayoutVersion(layoutVersionId)
  });
}
