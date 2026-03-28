import type { SupabaseClient } from '@supabase/supabase-js';
import type { Container, ContainerType } from '@wos/domain';
import { mapContainerRowToDomain, mapContainerTypeRowToDomain } from '../../mappers.js';

type ContainerTypeRow = {
  id: string;
  code: string;
  description: string;
  supports_storage: boolean;
  supports_picking: boolean;
};

type ContainerRow = {
  id: string;
  tenant_id: string;
  external_code: string | null;
  container_type_id: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  operational_role: 'storage' | 'pick';
  created_at: string;
  created_by: string | null;
};

export type CreateContainerInput = {
  tenantId: string;
  containerTypeId: string;
  externalCode: string;
  operationalRole: 'storage' | 'pick';
  createdBy: string;
};

export type ListContainersFilter = {
  operationalRole?: 'storage' | 'pick';
};

export type ContainersRepo = {
  listAllTypes(): Promise<ContainerType[]>;
  listAll(filter?: ListContainersFilter): Promise<Container[]>;
  findById(id: string): Promise<Container | null>;
  findTypeById(id: string): Promise<ContainerType | null>;
  create(input: CreateContainerInput): Promise<Container>;
  containerCodeExists(tenantId: string, externalCode: string): Promise<boolean>;
};

const CONTAINER_TYPE_COLUMNS = 'id,code,description,supports_storage,supports_picking';
const CONTAINER_COLUMNS = 'id,tenant_id,external_code,container_type_id,status,operational_role,created_at,created_by';

export function createContainersRepo(supabase: SupabaseClient): ContainersRepo {
  return {
    async listAllTypes() {
      const { data, error } = await supabase
        .from('container_types')
        .select(CONTAINER_TYPE_COLUMNS)
        .order('code', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ContainerTypeRow[]).map(mapContainerTypeRowToDomain);
    },

    async listAll(filter?: ListContainersFilter) {
      // Build filter first, then apply ordering as the terminal call so the
      // query chain works correctly with both real Supabase and test stubs.
      let query = supabase
        .from('containers')
        .select(CONTAINER_COLUMNS);

      if (filter?.operationalRole !== undefined) {
        query = query.eq('operational_role', filter.operationalRole);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ContainerRow[]).map(mapContainerRowToDomain);
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('containers')
        .select(CONTAINER_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapContainerRowToDomain(data as ContainerRow) : null;
    },

    async findTypeById(id) {
      const { data, error } = await supabase
        .from('container_types')
        .select(CONTAINER_TYPE_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapContainerTypeRowToDomain(data as ContainerTypeRow) : null;
    },

    async create(input) {
      const { data, error } = await supabase
        .from('containers')
        .insert({
          tenant_id: input.tenantId,
          container_type_id: input.containerTypeId,
          external_code: input.externalCode,
          operational_role: input.operationalRole,
          created_by: input.createdBy
        })
        .select(CONTAINER_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return mapContainerRowToDomain(data as ContainerRow);
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
