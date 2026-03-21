import type { SupabaseClient } from '@supabase/supabase-js';

export type ContainersRepo = {
  containerTypeExists(containerTypeId: string): Promise<boolean>;
  containerCodeExists(tenantId: string, externalCode: string): Promise<boolean>;
};

export function createContainersRepo(supabase: SupabaseClient): ContainersRepo {
  return {
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
