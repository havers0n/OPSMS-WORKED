import type { NonRackLocationRef } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { locationKeys } from './queries';

type PatchLocationGeometryInput = {
  locationId: string;
  floorX: number | null;
  floorY: number | null;
  floorId: string;
};

async function patchLocationGeometry({
  locationId,
  floorX,
  floorY
}: PatchLocationGeometryInput): Promise<NonRackLocationRef> {
  return bffRequest<NonRackLocationRef>(`/api/locations/${locationId}/geometry`, {
    method: 'PATCH',
    body: JSON.stringify({ floorX, floorY })
  });
}

export function usePatchLocationGeometry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchLocationGeometry,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: locationKeys.nonRackByFloor(variables.floorId)
      });
    }
  });
}
