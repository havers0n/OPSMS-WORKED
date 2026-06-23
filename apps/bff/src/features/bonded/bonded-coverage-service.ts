import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BondedCoverageRequest,
  BondedCoverageRequestDetail,
  BondedCoverageRequestItem,
  BondedCoverageRequestStatus,
  CreateBondedCoverageRequestInput,
  AddBondedCoverageRequestItemInput,
  UpdateBondedCoverageRequestItemInput,
  CloseBondedCoverageRequestInput,
  CancelBondedCoverageRequestInput
} from '@wos/domain';
import {
  createBondedCoverageRepo,
  type BondedCoverageRepo
} from './bonded-coverage-repo.js';
import { ApiError } from '../../errors.js';

export type BondedCoverageService = {
  createRequest(
    tenantId: string,
    shiftId: string,
    userId: string | null,
    userName: string | null,
    input: CreateBondedCoverageRequestInput
  ): Promise<BondedCoverageRequestDetail>;

  listRequests(
    tenantId: string,
    shiftId: string,
    status?: BondedCoverageRequestStatus
  ): Promise<BondedCoverageRequest[]>;

  getRequest(
    tenantId: string,
    requestId: string
  ): Promise<BondedCoverageRequestDetail | null>;

  addItem(
    tenantId: string,
    requestId: string,
    input: AddBondedCoverageRequestItemInput
  ): Promise<BondedCoverageRequestItem>;

  updateItem(
    tenantId: string,
    requestId: string,
    itemId: string,
    input: UpdateBondedCoverageRequestItemInput
  ): Promise<BondedCoverageRequestItem>;

  closeRequest(
    tenantId: string,
    requestId: string,
    userId: string | null,
    userName: string | null,
    input: CloseBondedCoverageRequestInput
  ): Promise<BondedCoverageRequestDetail>;

  cancelRequest(
    tenantId: string,
    requestId: string,
    userId: string | null,
    userName: string | null,
    input?: CancelBondedCoverageRequestInput
  ): Promise<BondedCoverageRequestDetail>;
};

export function createBondedCoverageServiceFromRepo(repo: BondedCoverageRepo): BondedCoverageService {
  return {
    async createRequest(tenantId, shiftId, userId, userName, input) {
      return repo.createRequest(tenantId, userId, userName, {
        shiftId,
        planningDate: input.planningDate,
        title: input.title,
        notes: input.notes,
        bondedSnapshotId: input.bondedSnapshotId,
        warehouseStockSnapshotId: input.warehouseStockSnapshotId,
        items: input.items
      });
    },

    async listRequests(tenantId, shiftId, status) {
      return repo.listRequests(tenantId, shiftId, status);
    },

    async getRequest(tenantId, requestId) {
      return repo.getRequest(tenantId, requestId);
    },

    async addItem(tenantId, requestId, input) {
      const request = await repo.getRequest(tenantId, requestId);
      if (!request) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded coverage request not found.');
      }
      if (request.status !== 'open') {
        throw new ApiError(409, 'REQUEST_NOT_OPEN', 'Cannot add items to a request that is not open.');
      }
      return repo.addItem(requestId, {
        sku: input.sku,
        description: input.description,
        category: input.category,
        requestedQty: input.requestedQty,
        demandQtyAtCreate: input.demandQtyAtCreate,
        warehouseQtyAtCreate: input.warehouseQtyAtCreate,
        shortageQtyAtCreate: input.shortageQtyAtCreate,
        bondedAvailableQtyAtCreate: input.bondedAvailableQtyAtCreate,
        bondedCoverQtyAtCreate: input.bondedCoverQtyAtCreate,
        notes: input.notes
      });
    },

    async updateItem(tenantId, requestId, itemId, input) {
      const request = await repo.getRequest(tenantId, requestId);
      if (!request) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded coverage request not found.');
      }
      if (request.status !== 'open') {
        throw new ApiError(409, 'REQUEST_NOT_OPEN', 'Cannot update items on a request that is not open.');
      }
      return repo.updateItem(itemId, {
        requestedQty: input.requestedQty,
        notes: input.notes
      });
    },

    async closeRequest(tenantId, requestId, userId, userName, input) {
      const request = await repo.getRequest(tenantId, requestId);
      if (!request) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded coverage request not found.');
      }
      if (request.status !== 'open') {
        throw new ApiError(409, 'REQUEST_NOT_OPEN', 'Cannot close a request that is not open.');
      }

      await repo.updateRequestStatus(
        requestId,
        'closed',
        userId,
        userName,
        new Date().toISOString(),
        null
      );

      if (input.items && input.items.length > 0) {
        for (const item of input.items) {
          await repo.updateItemFulfilledQty(item.itemId, item.fulfilledQty);
        }
      }

      const updated = await repo.getRequest(tenantId, requestId);
      return updated!;
    },

    async cancelRequest(tenantId, requestId, userId, userName, input) {
      const request = await repo.getRequest(tenantId, requestId);
      if (!request) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded coverage request not found.');
      }
      if (request.status !== 'open') {
        throw new ApiError(409, 'REQUEST_NOT_OPEN', 'Cannot cancel a request that is not open.');
      }

      await repo.updateRequestStatus(
        requestId,
        'cancelled',
        userId,
        userName,
        null,
        new Date().toISOString()
      );

      const updated = await repo.getRequest(tenantId, requestId);
      return updated!;
    }
  };
}

export function createBondedCoverageService(supabase: SupabaseClient): BondedCoverageService {
  return createBondedCoverageServiceFromRepo(createBondedCoverageRepo(supabase));
}
