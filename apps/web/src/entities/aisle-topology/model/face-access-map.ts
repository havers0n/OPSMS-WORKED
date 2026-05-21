import type { FloorAisleTopology } from '@wos/domain';
import type { FaceAccessLike } from '@/features/pick-point-resolver/model/pick-point-types';

export function buildFaceAccessByFaceId(
  topology: FloorAisleTopology | null | undefined
): Map<string, FaceAccessLike> | undefined {
  if (!topology || topology.faceAccess.length === 0) {
    return undefined;
  }

  const duplicates = new Set<string>();
  const faceAccessByFaceId = new Map<string, FaceAccessLike>();

  for (const faceAccess of topology.faceAccess) {
    if (duplicates.has(faceAccess.faceId)) {
      continue;
    }

    if (faceAccessByFaceId.has(faceAccess.faceId)) {
      faceAccessByFaceId.delete(faceAccess.faceId);
      duplicates.add(faceAccess.faceId);
      continue;
    }

    faceAccessByFaceId.set(faceAccess.faceId, {
      faceId: faceAccess.faceId,
      normalX: faceAccess.normalX,
      normalY: faceAccess.normalY
    });
  }

  return faceAccessByFaceId.size > 0 ? faceAccessByFaceId : undefined;
}
