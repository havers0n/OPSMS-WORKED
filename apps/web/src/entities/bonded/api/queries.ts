import type { BondedSnapshotDiagnostics } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const bondedKeys = {
  all: ['bonded'] as const,
  snapshots: () => [...bondedKeys.all, 'snapshots'] as const,
  snapshotDetail: (snapshotId: string) => [...bondedKeys.all, 'snapshots', snapshotId] as const
};

export type BondedSnapshotListItem = {
  id: string;
  planningDate: string;
  fileName: string | null;
  importedAt: string;
  rowCount: number;
  status: string;
  diagnostics: Pick<BondedSnapshotDiagnostics, 'totalRows' | 'missingSkuRows' | 'negativeBalanceRows' | 'duplicateSkuGroups' | 'warnings'>;
};

export type BondedSnapshotDetail = {
  id: string;
  planningDate: string;
  fileName: string | null;
  importedAt: string;
  rowCount: number;
  status: string;
  diagnostics: BondedSnapshotDiagnostics;
  sourceSheetName: string;
  rows: Array<{
    rowNumber: number;
    sourceLabel: string | null;
    block: string | null;
    sku: string | null;
    description: string | null;
    releasedQty: number;
    totalPulledQty: number;
    releasedBalanceQty: number;
    availableQty: number;
    notes: string | null;
    diagnostics: string[];
  }>;
};

async function fetchBondedSnapshots(): Promise<BondedSnapshotListItem[]> {
  return bffRequest<BondedSnapshotListItem[]>('/api/bonded/snapshots');
}

async function fetchBondedSnapshotDetail(snapshotId: string): Promise<BondedSnapshotDetail> {
  return bffRequest<BondedSnapshotDetail>(`/api/bonded/snapshots/${snapshotId}`);
}

export function bondedSnapshotsQueryOptions() {
  return queryOptions({
    queryKey: bondedKeys.snapshots(),
    queryFn: fetchBondedSnapshots,
    staleTime: 30_000
  });
}

export function bondedSnapshotDetailQueryOptions(snapshotId: string) {
  return queryOptions({
    queryKey: bondedKeys.snapshotDetail(snapshotId),
    queryFn: () => fetchBondedSnapshotDetail(snapshotId),
    enabled: !!snapshotId
  });
}
