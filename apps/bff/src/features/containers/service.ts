import type { SupabaseClient } from '@supabase/supabase-js';
import type { Container, ContainerType } from '@wos/domain';
import { ApiError } from '../../errors.js';
import { createContainersRepo } from './repo.js';
import { isContainerTypeConstraintError } from './errors.js';

type CreateContainerInput = {
  tenantId: string;
  containerTypeId: string;
  externalCode: string;
  createdBy: string;
};

export type ContainersService = {
  listAllTypes(): Promise<ContainerType[]>;
  listAll(): Promise<Container[]>;
  findById(id: string): Promise<Container | null>;
  createContainer(input: CreateContainerInput): Promise<Container>;
  removeContainer(containerId: string, actorId: string): Promise<unknown>;
};

export function createContainersService(supabase: SupabaseClient): ContainersService {
  const repo = createContainersRepo(supabase);

  return {
    listAllTypes: () => repo.listAllTypes(),

    listAll: () => repo.listAll(),

    findById: (id) => repo.findById(id),

    async createContainer(input) {
      const typeExists = await repo.containerTypeExists(input.containerTypeId);
      if (!typeExists) {
        throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
      }

      const codeExists = await repo.containerCodeExists(input.tenantId, input.externalCode);
      if (codeExists) {
        throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
      }

      try {
        return await repo.create(input);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = (error as { code: string }).code;
          if (code === '23505') {
            throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
          }
          if (code === '23503' && isContainerTypeConstraintError(error)) {
            throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
          }
        }
        throw error;
      }
    },

    async removeContainer(containerId, actorId) {
      const { data, error } = await supabase.rpc('remove_container', {
        container_uuid: containerId,
        actor_uuid: actorId
      });

      if (error) {
        throw error;
      }

      return data;
    }
  };
}
