import type { SupabaseClient } from '@supabase/supabase-js';
import type { Container, ContainerType } from '@wos/domain';
import { mapContainerRowToDomain, mapContainerTypeRowToDomain } from '../../mappers.js';

type ContainerTypeRow = {
  id: string;
  code: string;
  description: string;
};

type ContainerRow = {
  id: string;
  tenant_id: string;
  external_code: string | null;
  container_type_id: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  created_at: string;
  created_by: string | null;
};

export type CreateContainerInput = {
  tenantId: string;
  containerTypeId: string;
  externalCode: string;
  createdBy: string;
};

export type ContainersRepo = {
  listAllTypes(): Promise<ContainerType[]>;
  listAll(): Promise<Container[]>;
  findById(id: string): Promise<Container | null>;
  create(input: CreateContainerInput): Promise<Container>;
  containerTypeExists(containerTypeId: string): Promise<boolean>;
  containerCodeExists(tenantId: string, externalCode: string): Promise<boolean>;
};

export function createContainersRepo(supabase: SupabaseClient): ContainersRepo {
  return {
    async listAllTypes() {
      const { data, error } = await supabase
        .from('container_types')
        .select('id,code,description')
        .order('code', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ContainerTypeRow[]).map(mapContainerTypeRowToDomain);
    },

    async listAll() {
      const { data, error } = await supabase
        .from('containers')
        .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ContainerRow[]).map(mapContainerRowToDomain);
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('containers')
        .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapContainerRowToDomain(data as ContainerRow) : null;
    },

    async create(input) {
      const { data, error } = await supabase
        .from('containers')
        .insert({
          tenant_id: input.tenantId,
          container_type_id: input.containerTypeId,
          external_code: input.externalCode,
          created_by: input.createdBy
        })
        .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
        .single();

      if (error) {
        throw error;
      }

      return mapContainerRowToDomain(data as ContainerRow);
    },

    async containerTypeExists(containerTypeId) {
      const { data, error } = await supabase
        .from('container_types')
        .select('id')
        .eq('id', containerTypeId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    },

    async containerCodeExists(tenantId, externalCode) {
      const { data, error } = await supabase
        .from('containers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('external_code', externalCode)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    }
  };
}
