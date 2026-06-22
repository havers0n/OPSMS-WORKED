import { describe, expect, it, vi } from 'vitest';
import { createBondedRepo } from './bonded-repo.js';
import { createBondedServiceFromRepo } from './bonded-service.js';

type SnapshotSeed = {
  id: string;
  tenant_id: string;
  planning_date: string | null;
  imported_at: string;
  status: string;
  file_name?: string;
  file_hash?: string | null;
  shift_id?: string | null;
  source_sheet_name?: string;
  imported_by?: string | null;
  row_count?: number;
  diagnostics?: {
    totalRows: number;
    populatedRows: number;
    missingSkuRows: number;
    negativeBalanceRows: number;
    duplicateSkuGroups: number;
    formulaDiscrepancyRows: number;
    warnings: string[];
  };
  created_at?: string;
};

type SnapshotRowSeed = {
  snapshot_id: string;
  row_number: number;
  sku: string | null;
};

function createSupabaseStub({
  snapshots,
  rows
}: {
  snapshots: SnapshotSeed[];
  rows?: SnapshotRowSeed[];
}) {
  return {
    from(table: string) {
      if (table === 'bonded_snapshots') {
        let filtered = [...snapshots];
        return {
          select() {
            return this;
          },
          eq(column: keyof SnapshotSeed, value: unknown) {
            filtered = filtered.filter((row) => row[column] === value);
            return this;
          },
          order(column: keyof SnapshotSeed, { ascending }: { ascending: boolean }) {
            filtered.sort((a, b) => {
              const left = String(a[column] ?? '');
              const right = String(b[column] ?? '');
              return ascending ? left.localeCompare(right) : right.localeCompare(left);
            });
            return this;
          },
          limit(count: number) {
            filtered = filtered.slice(0, count);
            return this;
          },
          async single() {
            if (filtered.length === 0) {
              return { data: null, error: { code: 'PGRST116' } };
            }
            return { data: filtered[0], error: null };
          }
        };
      }

      if (table === 'bonded_snapshot_rows') {
        let filtered = [...(rows ?? [])];
        return {
          select() {
            return this;
          },
          eq(column: keyof SnapshotRowSeed, value: unknown) {
            filtered = filtered.filter((row) => row[column] === value);
            return this;
          },
          order() {
            filtered.sort((a, b) => a.row_number - b.row_number);
            return this;
          },
          then(resolve: (value: { data: SnapshotRowSeed[]; error: null }) => void) {
            resolve({ data: filtered, error: null });
          }
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };
}

function makeSnapshot(overrides: Partial<SnapshotSeed>): SnapshotSeed {
  return {
    id: 'snapshot-1',
    tenant_id: 'tenant-a',
    planning_date: '2026-06-22',
    imported_at: '2026-06-22T08:00:00.000Z',
    status: 'completed',
    file_name: 'bonded.xlsx',
    file_hash: null,
    shift_id: null,
    source_sheet_name: 'bonded',
    imported_by: null,
    row_count: 1,
    diagnostics: {
      totalRows: 1,
      populatedRows: 1,
      missingSkuRows: 0,
      negativeBalanceRows: 0,
      duplicateSkuGroups: 0,
      formulaDiscrepancyRows: 0,
      warnings: []
    },
    created_at: '2026-06-22T08:00:00.000Z',
    ...overrides
  };
}

describe('bonded repo latest completed snapshot lookup', () => {
  it('returns the latest completed snapshot for the exact tenant and planningDate', async () => {
    const repo = createBondedRepo(
      createSupabaseStub({
        snapshots: [
          makeSnapshot({ id: 'older', imported_at: '2026-06-22T07:00:00.000Z' }),
          makeSnapshot({ id: 'latest', imported_at: '2026-06-22T09:00:00.000Z' }),
          makeSnapshot({ id: 'other-date', planning_date: '2026-06-23', imported_at: '2026-06-22T10:00:00.000Z' }),
          makeSnapshot({ id: 'other-tenant', tenant_id: 'tenant-b', imported_at: '2026-06-22T11:00:00.000Z' }),
          makeSnapshot({ id: 'draft', status: 'draft', imported_at: '2026-06-22T12:00:00.000Z' })
        ],
        rows: [{ snapshot_id: 'latest', row_number: 1, sku: 'SKU-1' }]
      }) as never
    );

    const result = await repo.getLatestCompletedSnapshot('tenant-a', '2026-06-22');

    expect(result?.id).toBe('latest');
    expect(result?.planningDate).toBe('2026-06-22');
    expect(result?.rows).toHaveLength(1);
  });

  it('returns null when the tenant has no completed snapshot for the requested planningDate', async () => {
    const repo = createBondedRepo(
      createSupabaseStub({
        snapshots: [
          makeSnapshot({ id: 'other-date', planning_date: '2026-06-23' }),
          makeSnapshot({ id: 'other-tenant', tenant_id: 'tenant-b' })
        ]
      }) as never
    );

    await expect(repo.getLatestCompletedSnapshot('tenant-a', '2026-06-22')).resolves.toBeNull();
  });
});

describe('bonded service latest completed snapshot lookup', () => {
  it('forwards tenantId and planningDate to the repo without tenant-only fallback', async () => {
    const repo = {
      createSnapshot: vi.fn(),
      getSnapshot: vi.fn(),
      listSnapshots: vi.fn(),
      getLatestCompletedSnapshot: vi.fn(async () => null)
    };
    const service = createBondedServiceFromRepo(repo as never);

    await service.getLatestCompletedSnapshot('tenant-a', '2026-06-22');

    expect(repo.getLatestCompletedSnapshot).toHaveBeenCalledWith('tenant-a', '2026-06-22');
  });
});
