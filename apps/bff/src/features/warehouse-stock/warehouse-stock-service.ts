import type { SupabaseClient } from '@supabase/supabase-js';
import type { WarehouseStockSnapshotPreview } from '@wos/domain';
import { parseWarehouseStockWorkbook } from './warehouse-stock-excel-parser.js';
import {
  createWarehouseStockRepo,
  type WarehouseStockRepo,
  type CreateSnapshotInput,
  type CreateSnapshotResult,
  type SnapshotDetail,
  type SnapshotListItem
} from './warehouse-stock-repo.js';

type ImportLogger = {
  info?: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

export type WarehouseStockService = {
  parseWorkbook(input: {
    fileName: string;
    buffer: Buffer;
    logger?: ImportLogger;
  }): { preview: WarehouseStockSnapshotPreview; fileName: string; pivotSheetFound: boolean };
  createSnapshot(
    tenantId: string,
    userId: string | null,
    input: CreateSnapshotInput
  ): Promise<CreateSnapshotResult>;
  listSnapshots(tenantId: string): Promise<SnapshotListItem[]>;
  getSnapshot(tenantId: string, snapshotId: string): Promise<SnapshotDetail | null>;
  getLatestCompletedSnapshot(tenantId: string, planningDate: string): Promise<SnapshotDetail | null>;
};

export function createWarehouseStockServiceFromRepo(repo: WarehouseStockRepo): WarehouseStockService {
  return {
    parseWorkbook(input) {
      return parseWarehouseStockWorkbook(input);
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

export function createWarehouseStockService(supabase: SupabaseClient): WarehouseStockService {
  return createWarehouseStockServiceFromRepo(createWarehouseStockRepo(supabase));
}
