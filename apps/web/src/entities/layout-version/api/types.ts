export type LayoutVersionRow = {
  id: string;
  floor_id: string;
  version_no: number;
  state: 'draft' | 'published' | 'archived';
};

export type RackRow = {
  id: string;
  layout_version_id: string;
  display_code: string;
  kind: 'single' | 'paired';
  axis: 'NS' | 'WE';
  x: number;
  y: number;
  total_length: number;
  depth: number;
  rotation_deg: 0 | 90 | 180 | 270;
};

export type RackFaceRow = {
  id: string;
  rack_id: string;
  side: 'A' | 'B';
  enabled: boolean;
  anchor: 'start' | 'end';
  slot_numbering_direction: 'ltr' | 'rtl';
  is_mirrored: boolean;
  mirror_source_face_id: string | null;
};

export type RackSectionRow = {
  id: string;
  rack_face_id: string;
  ordinal: number;
  length: number;
};

export type RackLevelRow = {
  id: string;
  rack_section_id: string;
  ordinal: number;
  slot_count: number;
};

export type LayoutDraftRowBundle = {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
};
