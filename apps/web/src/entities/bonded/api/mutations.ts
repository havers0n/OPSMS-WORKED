import type { BondedSnapshotDraft } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { bondedKeys } from './queries';

export type BondedUploadResponse = {
  draft: BondedSnapshotDraft;
  fileName: string;
  pivotSheetFound: boolean;
};

export type BondedPublishInput = {
  draft: BondedSnapshotDraft;
  planningDate: string;
  fileName?: string | null;
  shiftId?: string | null;
};

export type BondedPublishResponse = {
  id: string;
  planningDate: string;
  status: string;
  rowCount: number;
  importedAt: string;
};

async function uploadBondedExcel(file: File): Promise<BondedUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return bffRequest<BondedUploadResponse>('/api/bonded/upload', {
    method: 'POST',
    body: formData
  });
}

async function publishBondedSnapshot(input: BondedPublishInput): Promise<BondedPublishResponse> {
  return bffRequest<BondedPublishResponse>('/api/bonded/snapshots', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function useUploadBondedExcel() {
  return useMutation({
    mutationFn: uploadBondedExcel
  });
}

export function usePublishBondedSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishBondedSnapshot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bondedKeys.snapshots() });
    }
  });
}
