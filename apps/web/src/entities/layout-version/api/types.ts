import type { Database } from '@/shared/api/supabase/types';

export type LayoutVersionRow = Database['public']['Tables']['layout_versions']['Row'];
export type RackRow = Database['public']['Tables']['racks']['Row'];
export type RackFaceRow = Database['public']['Tables']['rack_faces']['Row'];
export type RackSectionRow = Database['public']['Tables']['rack_sections']['Row'];
export type RackLevelRow = Database['public']['Tables']['rack_levels']['Row'];

export type LayoutDraftRowBundle = {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
};
