import type { Database } from '@/shared/api/supabase/types';

export type LayoutVersionRow = Database['public']['Tables']['layout_versions']['Row'];
export type RackRow = Database['public']['Tables']['racks']['Row'];
export type RackFaceRow = Database['public']['Tables']['rack_faces']['Row'];
export type RackSectionRow = Database['public']['Tables']['rack_sections']['Row'];
export type RackLevelRow = Database['public']['Tables']['rack_levels']['Row'];
export type LayoutZoneRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string;
  category: 'generic' | 'storage' | 'staging' | 'packing' | 'receiving' | 'custom' | null;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutWallRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string | null;
  wall_type: 'generic' | 'partition' | 'safety' | 'perimeter' | 'custom' | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocks_rack_placement: boolean;
};

export type LayoutDraftRowBundle = {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
  zones?: LayoutZoneRow[];
  walls?: LayoutWallRow[];
};
