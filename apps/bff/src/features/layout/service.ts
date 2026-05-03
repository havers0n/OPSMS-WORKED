import type { SupabaseClient } from '@supabase/supabase-js';
import { layoutLifecycleInfoSchema, type LayoutChangeClass, type LayoutPublishRenameMapping } from '@wos/domain';
import { ApiError } from '../../errors.js';
import type { SaveLayoutDraftPayload } from '../../schemas.js';
import { buildNormalizedDraftFromSavePayload, classifyLayoutDraftChange } from './change-classification.js';
import { createLayoutRepo } from './repo.js';

export type LayoutService = {
  createDraft(floorId: string, actorId: string): Promise<string>;
  saveDraft(
    layoutDraft: SaveLayoutDraftPayload,
    actorId: string
  ): Promise<{ layoutVersionId: string; draftVersion: number | null; changeClass: LayoutChangeClass }>;
  validateVersion(layoutVersionId: string): Promise<unknown>;
  publishDraft(
    layoutVersionId: string,
    expectedDraftVersion: number,
    actorId: string,
    renameMappings?: LayoutPublishRenameMapping[]
  ): Promise<unknown>;
};

export function createLayoutService(supabase: SupabaseClient): LayoutService {
  const repo = createLayoutRepo(supabase);
  return {
    createDraft: (floorId, actorId) => repo.createDraft(floorId, actorId),
    async saveDraft(layoutDraft, actorId) {
      const persistedDraft = await repo.findDraftByVersionId(layoutDraft.layoutVersionId);

      if (!persistedDraft) {
        throw new ApiError(409, 'DRAFT_NOT_ACTIVE', 'Layout draft is no longer active. Please reload.');
      }

      const incomingDraft = buildNormalizedDraftFromSavePayload(
        layoutDraft,
        layoutLifecycleInfoSchema.parse({
          layoutVersionId: persistedDraft.layoutVersionId,
          draftVersion: persistedDraft.draftVersion ?? null,
          floorId: persistedDraft.floorId,
          state: persistedDraft.state,
          versionNo: persistedDraft.versionNo ?? null
        })
      );
      const changeClass = classifyLayoutDraftChange(persistedDraft, incomingDraft);
      const saveResult = await repo.saveDraft(layoutDraft, actorId);

      return {
        ...saveResult,
        changeClass
      };
    },
    validateVersion: (layoutVersionId) => repo.validateVersion(layoutVersionId),
    async publishDraft(layoutVersionId, expectedDraftVersion, actorId, renameMappings = []) {
      const currentVersion = await repo.findVersion(layoutVersionId);

      if (!currentVersion || currentVersion.state !== 'draft') {
        throw new ApiError(409, 'DRAFT_NOT_ACTIVE', 'Layout draft is no longer active. Please reload.');
      }

      if (currentVersion.draft_version !== expectedDraftVersion) {
        throw new ApiError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.');
      }

      return repo.publishVersion(layoutVersionId, actorId, renameMappings);
    }
  };
}
