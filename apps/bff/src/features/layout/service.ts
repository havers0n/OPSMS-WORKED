import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../../errors.js';
import { createLayoutRepo } from './repo.js';

export type LayoutService = {
  createDraft(floorId: string, actorId: string): Promise<string>;
  saveDraft(layoutDraft: unknown, actorId: string): Promise<{ layoutVersionId: string; draftVersion: number | null }>;
  validateVersion(layoutVersionId: string): Promise<unknown>;
  publishDraft(layoutVersionId: string, expectedDraftVersion: number, actorId: string): Promise<unknown>;
};

export function createLayoutService(supabase: SupabaseClient): LayoutService {
  const repo = createLayoutRepo(supabase);
  return {
    createDraft: (floorId, actorId) => repo.createDraft(floorId, actorId),
    saveDraft: (layoutDraft, actorId) => repo.saveDraft(layoutDraft, actorId),
    validateVersion: (layoutVersionId) => repo.validateVersion(layoutVersionId),
    async publishDraft(layoutVersionId, expectedDraftVersion, actorId) {
      const currentVersion = await repo.findVersion(layoutVersionId);

      if (!currentVersion || currentVersion.state !== 'draft') {
        throw new ApiError(409, 'DRAFT_NOT_ACTIVE', 'Layout draft is no longer active. Please reload.');
      }

      if (currentVersion.draft_version !== expectedDraftVersion) {
        throw new ApiError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.');
      }

      return repo.publishVersion(layoutVersionId, actorId);
    }
  };
}
