import type { SupabaseClient } from '@supabase/supabase-js';
import type { BondedSnapshotDraft } from '@wos/domain';
import { parseBondedWorkbook } from './bonded-excel-parser.js';
import {
  createBondedRepo,
  type BondedRepo,
  type CreateSnapshotInput,
  type CreateSnapshotResult,
  type SnapshotDetail,
  type SnapshotListItem
} from './bonded-repo.js';

type ImportLogger = {
  info?: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

export type BondedService = {
  parseWorkbook(input: { fileName: string; buffer: Buffer; logger?: ImportLogger }): BondedSnapshotDraft;
  createSnapshot(
    tenantId: string,
    userId: string | null,
    input: CreateSnapshotInput
  ): Promise<CreateSnapshotResult>;
  listSnapshots(tenantId: string): Promise<SnapshotListItem[]>;
  getSnapshot(tenantId: string, snapshotId: string): Promise<SnapshotDetail | null>;
  getLatestCompletedSnapshot(tenantId: string, planningDate: string): Promise<SnapshotDetail | null>;
};

export function createBondedServiceFromRepo(repo: BondedRepo): BondedService {
  return {
    parseWorkbook(input) {
      return parseBondedWorkbook(input);
    },

    createSnapshot(tenantId, userId, input) {
      return repo.createSnapshot(tenantId, userId, input);
    },

    listSnapshots(tenantId) {
      return repo.listSnapshots(tenantId);
    },

    getSnapshot(tenantId, snapshotId) {
      return repo.getSnapshot(tenantId, snapshotId);
    },

    getLatestCompletedSnapshot(tenantId, planningDate) {
      return repo.getLatestCompletedSnapshot(tenantId, planningDate);
    }
  };
}

export function createBondedService(supabase: SupabaseClient): BondedService {
  return createBondedServiceFromRepo(createBondedRepo(supabase));
}
