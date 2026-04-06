import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:55821';
const SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

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

export async function resetWarehouseData() {
  const tableOrder = ['cells', 'rack_levels', 'rack_sections', 'rack_faces', 'racks', 'layout_versions', 'floors', 'sites'] as const;

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

function createRackPayload(rackDisplayCode: string) {
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
        isMirrored: true,
        mirrorSourceFaceId: faceAId,
        sections: []
      }
    ]
  };
}

export async function saveRackDraft(layoutVersionId: string, floorId: string, rackDisplayCode = '03') {
  const payload = {
    layoutVersionId,
    floorId,
    racks: [createRackPayload(rackDisplayCode)]
  };

  const { error } = await adminClient.rpc('save_layout_draft', { layout_payload: payload });
  if (error) {
    throw error;
  }
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
