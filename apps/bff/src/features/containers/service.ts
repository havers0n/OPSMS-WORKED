import type { SupabaseClient } from '@supabase/supabase-js';
import type { Container, ContainerType } from '@wos/domain';
import { ApiError } from '../../errors.js';
import { createContainersRepo, type ListContainersFilter } from './repo.js';
import { isContainerTypeConstraintError } from './errors.js';

type CreateContainerInput = {
  tenantId: string;
  containerTypeId: string;
  externalCode?: string;
  operationalRole: 'storage' | 'pick';
  createdBy: string;
};

export type ContainersService = {
  listAllTypes(): Promise<ContainerType[]>;
  listAll(filter?: ListContainersFilter): Promise<Container[]>;
  findById(id: string): Promise<Container | null>;
  createContainer(input: CreateContainerInput): Promise<Container>;
  removeContainer(containerId: string, actorId: string): Promise<unknown>;
};

export function createContainersService(supabase: SupabaseClient): ContainersService {
  const repo = createContainersRepo(supabase);

  return {
    listAllTypes: () => repo.listAllTypes(),

    listAll: (filter?) => repo.listAll(filter),

    findById: (id) => repo.findById(id),

    async createContainer(input) {
      // Resolve type — replaces the old containerTypeExists check with a single
      // query that also gives us capability booleans for validation.
      const type = await repo.findTypeById(input.containerTypeId);
      if (!type) {
        throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
      }

      // Capability validation: guard before touching containers table.
      if (input.operationalRole === 'storage' && !type.supportsStorage) {
        throw new ApiError(
          400,
          'CONTAINER_TYPE_NOT_STORAGE_CAPABLE',
          `Container type '${type.code}' does not support storage use.`
        );
      }
      if (input.operationalRole === 'pick' && !type.supportsPicking) {
        throw new ApiError(
          400,
          'CONTAINER_TYPE_NOT_PICK_CAPABLE',
          `Container type '${type.code}' does not support picker use.`
        );
      }

      if (input.externalCode) {
        const codeExists = await repo.containerCodeExists(input.tenantId, input.externalCode);
        if (codeExists) {
          throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
        }
      }

      try {
        return await repo.create(input);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = (error as { code: string }).code;
          const constraint =
            'constraint' in error && typeof error.constraint === 'string'
              ? error.constraint
              : '';
          if (code === '23505' && constraint === 'containers_tenant_external_code_unique') {
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
