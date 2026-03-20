import { useMutation } from '@tanstack/react-query';
import { createContainer } from '../api/mutations';

export function useCreateContainer() {
  return useMutation({
    mutationFn: createContainer
  });
}
