import type { SupabaseClient } from '@supabase/supabase-js';
import { createLayoutRepo } from './repo.js';

export type LayoutService = {
  createDraft(floorId: string, actorId: string): Promise<string>;
  saveDraft(layoutDraft: unknown, actorId: string): Promise<string>;
  validateVersion(layoutVersionId: string): Promise<unknown>;
  publishVersion(layoutVersionId: string, actorId: string): Promise<unknown>;
};

export function createLayoutService(supabase: SupabaseClient): LayoutService {
  const repo = createLayoutRepo(supabase);
  return {
    createDraft: (floorId, actorId) => repo.createDraft(floorId, actorId),
    saveDraft: (layoutDraft, actorId) => repo.saveDraft(layoutDraft, actorId),
    validateVersion: (layoutVersionId) => repo.validateVersion(layoutVersionId),
    publishVersion: (layoutVersionId, actorId) => repo.publishVersion(layoutVersionId, actorId)
  };
}
