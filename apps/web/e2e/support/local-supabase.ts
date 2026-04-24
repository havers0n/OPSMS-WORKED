import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type {
  DraftRackFacePayload,
  DraftRackLevelPayload,
  DraftRackPayload,
  DraftRackSectionPayload
} from './demo-warehouse-layout';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54421';
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DEV_AUTH_EMAIL = process.env.E2E_DEV_AUTH_EMAIL ?? process.env.VITE_DEV_AUTH_EMAIL ?? 'admin@wos.local';
const DEV_AUTH_PASSWORD = process.env.E2E_DEV_AUTH_PASSWORD ?? process.env.VITE_DEV_AUTH_PASSWORD ?? 'warehouse123';

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
let managerClientPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function ensureDefaultTenantId() {
  const { data: existingTenant, error: existingTenantError } = await adminClient
    .from('tenants')
    .select('id')
    .eq('code', 'default')
    .maybeSingle();

  if (existingTenantError) {
    throw existingTenantError;
  }

  if (existingTenant) {
    return existingTenant.id;
  }

  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .insert({ code: 'default', name: 'Default Tenant' })
    .select('id')
    .single();

  if (tenantError) {
    throw tenantError;
  }

  return tenant.id;
}

async function ensureTenantAdminMembership(profileId: string) {
  const tenantId = await ensureDefaultTenantId();
  const { error } = await adminClient
    .from('tenant_members')
    .upsert(
      {
        tenant_id: tenantId,
        profile_id: profileId,
        role: 'tenant_admin'
      },
      { onConflict: 'tenant_id,profile_id' }
    );

  if (error) {
    throw error;
  }
}

async function ensureManagerClient() {
  if (!managerClientPromise) {
    managerClientPromise = (async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      let signInResult = await client.auth.signInWithPassword({
        email: DEV_AUTH_EMAIL,
        password: DEV_AUTH_PASSWORD
      });

      if (signInResult.error) {
        const existingUsers = await adminClient.auth.admin.listUsers();
        if (existingUsers.error) {
          throw existingUsers.error;
        }

        const existingUser = existingUsers.data.users.find((user) => user.email === DEV_AUTH_EMAIL) ?? null;
        const createUserResult = existingUser
          ? { data: { user: existingUser }, error: null }
          : await adminClient.auth.admin.createUser({
            email: DEV_AUTH_EMAIL,
            password: DEV_AUTH_PASSWORD,
            email_confirm: true
          });

        if (createUserResult.error) {
          throw createUserResult.error;
        }

        const createdUserId = createUserResult.data.user?.id;
        if (!createdUserId) {
          throw new Error('Failed to resolve the local admin user for draft save tests.');
        }

        await ensureTenantAdminMembership(createdUserId);
        signInResult = await client.auth.signInWithPassword({
          email: DEV_AUTH_EMAIL,
          password: DEV_AUTH_PASSWORD
        });
      } else if (signInResult.data.user?.id) {
        await ensureTenantAdminMembership(signInResult.data.user.id);
      }

      if (signInResult.error) {
        throw signInResult.error;
      }

      return client;
    })();
  }

  return managerClientPromise;
}

export async function resetWarehouseData() {
  const tableOrder = ['locations', 'cells', 'rack_levels', 'rack_sections', 'rack_faces', 'racks', 'layout_versions', 'floors', 'sites'] as const;

  for (const table of tableOrder) {
    const { error } = await adminClient.from(table).delete().not('id', 'is', null);
    if (error) {
      throw error;
    }
  }
}

export async function seedSiteAndFloor(args?: { siteCode?: string; siteName?: string; floorCode?: string; floorName?: string }) {
  const siteCode = args?.siteCode ?? 'MAIN';
  const siteName = args?.siteName ?? 'Main Site';
  const floorCode = args?.floorCode ?? 'F1';
  const floorName = args?.floorName ?? 'Main Floor';
  const tenantId = await ensureDefaultTenantId();

  const { data: site, error: siteError } = await adminClient
    .from('sites')
    .insert({ tenant_id: tenantId, code: siteCode, name: siteName, timezone: 'Asia/Jerusalem' })
    .select('id,code,name')
    .single();

  if (siteError) {
    throw siteError;
  }

  const floor = await createFloor(site.id, floorCode, floorName, 0);

  return { site, floor };
}

export async function createFloor(siteId: string, floorCode: string, floorName: string, sortOrder = 0) {
  const { data: floor, error: floorError } = await adminClient
    .from('floors')
    .insert({ site_id: siteId, code: floorCode, name: floorName, sort_order: sortOrder })
    .select('id,code,name,site_id')
    .single();

  if (floorError) {
    throw floorError;
  }

  return floor;
}

export async function createDraftForFloor(floorId: string) {
  const { data, error } = await adminClient.rpc('create_layout_draft', { floor_uuid: floorId, actor_uuid: null });
  if (error) {
    throw error;
  }

  return data as string;
}

function createRackPayload(rackDisplayCode: string): DraftRackPayload {
  const rackId = randomUUID();
  const faceAId = randomUUID();
  const faceBId = randomUUID();
  const sectionId = randomUUID();
  const levelOneId = randomUUID();
  const levelTwoId = randomUUID();

  return {
    id: rackId,
    displayCode: rackDisplayCode,
    kind: 'paired',
    axis: 'NS',
    x: 24,
    y: 32,
    totalLength: 5,
    depth: 1.1,
    rotationDeg: 0,
    faces: [
      {
        id: faceAId,
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        relationshipMode: 'independent',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: [
          {
            id: sectionId,
            ordinal: 1,
            length: 5,
            levels: [
              { id: levelOneId, ordinal: 1, slotCount: 2 },
              { id: levelTwoId, ordinal: 2, slotCount: 2 }
            ]
          }
        ]
      },
      {
        id: faceBId,
        side: 'B',
        enabled: true,
        slotNumberingDirection: 'rtl',
        relationshipMode: 'mirrored',
        isMirrored: true,
        mirrorSourceFaceId: faceAId,
        sections: []
      }
    ]
  };
}

export type SaveLayoutDraftPayload = {
  layoutVersionId: string;
  floorId: string;
  draftVersion?: number | null;
  racks: DraftRackPayload[];
  zones?: [];
  walls?: [];
};

type LayoutVersionRow = {
  id: string;
  floor_id: string;
  draft_version: number | null;
  version_no: number;
  state: 'draft' | 'published' | 'archived';
};

type RackRow = {
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
  state: 'draft' | 'configured' | 'published';
};

type RackFaceRow = {
  id: string;
  rack_id: string;
  side: 'A' | 'B';
  enabled: boolean;
  slot_numbering_direction: 'ltr' | 'rtl';
  face_mode: 'mirrored' | 'independent' | null;
  is_mirrored: boolean;
  mirror_source_face_id: string | null;
  face_length: number | null;
};

type RackSectionRow = {
  id: string;
  rack_face_id: string;
  ordinal: number;
  length: number;
};

type RackLevelRow = {
  id: string;
  rack_section_id: string;
  ordinal: number;
  slot_count: number;
  structural_default_role: 'primary_pick' | 'reserve' | 'none' | null;
};

export type LayoutDraftRowBundle = {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
  zones: [];
  walls: [];
};

function serializeLevel(level: DraftRackLevelPayload) {
  return {
    id: level.id,
    ordinal: level.ordinal,
    slotCount: level.slotCount,
    structuralDefaultRole: level.structuralDefaultRole ?? 'none'
  };
}

function serializeSection(section: DraftRackSectionPayload) {
  return {
    id: section.id,
    ordinal: section.ordinal,
    length: section.length,
    levels: section.levels.map(serializeLevel)
  };
}

function serializeFace(face: DraftRackFacePayload) {
  return {
    id: face.id,
    side: face.side,
    enabled: face.enabled,
    slotNumberingDirection: face.slotNumberingDirection,
    relationshipMode: face.relationshipMode,
    isMirrored: face.isMirrored,
    mirrorSourceFaceId: face.mirrorSourceFaceId,
    faceLength: face.faceLength,
    sections: face.sections.map(serializeSection)
  };
}

export async function saveLayoutDraft(payload: SaveLayoutDraftPayload) {
  const managerClient = await ensureManagerClient();
  const { error } = await managerClient.rpc('save_layout_draft', {
    layout_payload: {
      layoutVersionId: payload.layoutVersionId,
      floorId: payload.floorId,
      draftVersion: payload.draftVersion ?? null,
      racks: payload.racks.map((rack) => ({
        id: rack.id,
        displayCode: rack.displayCode,
        kind: rack.kind,
        axis: rack.axis,
        x: rack.x,
        y: rack.y,
        totalLength: rack.totalLength,
        depth: rack.depth,
        rotationDeg: rack.rotationDeg,
        faces: rack.faces.map(serializeFace)
      })),
      zones: payload.zones ?? [],
      walls: payload.walls ?? []
    }
  });

  if (error) {
    throw error;
  }
}

export async function saveRackDraft(layoutVersionId: string, floorId: string, rackDisplayCode = '03') {
  await saveLayoutDraft({
    layoutVersionId,
    floorId,
    racks: [createRackPayload(rackDisplayCode)]
  });
}

export async function fetchLayoutDraftBundle(layoutVersionId: string): Promise<LayoutDraftRowBundle> {
  const { data: layoutVersion, error: layoutVersionError } = await adminClient
    .from('layout_versions')
    .select('id,floor_id,draft_version,version_no,state')
    .eq('id', layoutVersionId)
    .single();

  if (layoutVersionError) {
    throw layoutVersionError;
  }

  const { data: racksData, error: racksError } = await adminClient
    .from('racks')
    .select('id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg,state')
    .eq('layout_version_id', layoutVersionId)
    .order('display_code', { ascending: true });

  if (racksError) {
    throw racksError;
  }

  const racks = (racksData ?? []) as RackRow[];
  const rackIds = racks.map((rack) => rack.id);

  const { data: facesData, error: facesError } = rackIds.length === 0
    ? { data: [] as RackFaceRow[], error: null }
    : await adminClient
      .from('rack_faces')
      .select('id,rack_id,side,enabled,slot_numbering_direction,face_mode,is_mirrored,mirror_source_face_id,face_length')
      .in('rack_id', rackIds);

  if (facesError) {
    throw facesError;
  }

  const rackFaces = (facesData ?? []) as RackFaceRow[];
  const faceIds = rackFaces.map((face) => face.id);

  const { data: sectionsData, error: sectionsError } = faceIds.length === 0
    ? { data: [] as RackSectionRow[], error: null }
    : await adminClient
      .from('rack_sections')
      .select('id,rack_face_id,ordinal,length')
      .in('rack_face_id', faceIds);

  if (sectionsError) {
    throw sectionsError;
  }

  const rackSections = (sectionsData ?? []) as RackSectionRow[];
  const sectionIds = rackSections.map((section) => section.id);

  const { data: levelsData, error: levelsError } = sectionIds.length === 0
    ? { data: [] as RackLevelRow[], error: null }
    : await adminClient
      .from('rack_levels')
      .select('id,rack_section_id,ordinal,slot_count,structural_default_role')
      .in('rack_section_id', sectionIds);

  if (levelsError) {
    throw levelsError;
  }

  return {
    layoutVersion: layoutVersion as LayoutVersionRow,
    racks,
    rackFaces,
    rackSections,
    rackLevels: (levelsData ?? []) as RackLevelRow[],
    zones: [],
    walls: []
  };
}

export async function countLayoutRows(layoutVersionId: string) {
  const bundle = await fetchLayoutDraftBundle(layoutVersionId);
  const { count: cellCount, error: cellError } = await adminClient
    .from('cells')
    .select('id', { count: 'exact', head: true })
    .eq('layout_version_id', layoutVersionId);

  if (cellError) {
    throw cellError;
  }

  return {
    racks: bundle.racks.length,
    rackFaces: bundle.rackFaces.length,
    rackSections: bundle.rackSections.length,
    rackLevels: bundle.rackLevels.length,
    cells: cellCount ?? 0
  };
}

export async function countFloorLocations(floorId: string) {
  const { count, error } = await adminClient
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('floor_id', floorId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function seedExplicitDraftScenario(args: {
  siteCode?: string;
  siteName?: string;
  floorCode?: string;
  floorName?: string;
  racks: DraftRackPayload[];
}) {
  const { site, floor } = await seedSiteAndFloor(args);
  const layoutVersionId = await createDraftForFloor(floor.id);
  await saveLayoutDraft({
    layoutVersionId,
    floorId: floor.id,
    racks: args.racks
  });

  return { site, floor, layoutVersionId };
}

export async function seedDraftScenario(args?: { siteCode?: string; siteName?: string; floorCode?: string; floorName?: string; rackDisplayCode?: string }) {
  const { site, floor } = await seedSiteAndFloor(args);
  const layoutVersionId = await createDraftForFloor(floor.id);
  await saveRackDraft(layoutVersionId, floor.id, args?.rackDisplayCode ?? '03');

  return { site, floor, layoutVersionId };
}

export async function seedAdditionalFloorDraft(siteId: string, args: { floorCode: string; floorName: string; sortOrder?: number; rackDisplayCode?: string }) {
  const floor = await createFloor(siteId, args.floorCode, args.floorName, args.sortOrder ?? 1);
  const layoutVersionId = await createDraftForFloor(floor.id);
  await saveRackDraft(layoutVersionId, floor.id, args.rackDisplayCode ?? '03');

  return { floor, layoutVersionId };
}
