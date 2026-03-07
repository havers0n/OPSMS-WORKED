import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { getUserClient, requireAuth } from './auth.js';
import { mapFloorRowToDomain, mapLayoutDraftBundleToDomain, mapSiteRowToDomain, mapValidationResult } from './mappers.js';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: env.corsOrigin,
  credentials: true
});

app.get('/health', async () => ({ ok: true }));

app.get('/api/sites', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase.from('sites').select('id,code,name,timezone').order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapSiteRowToDomain);
});

app.post<{ Body: { code: string; name: string; timezone: string } }>('/api/sites', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase
    .from('sites')
    .insert({ code: request.body.code, name: request.body.name, timezone: request.body.timezone })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return { id: data.id as string };
});

app.get<{ Params: { siteId: string } }>('/api/sites/:siteId/floors', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase
    .from('floors')
    .select('id,site_id,code,name,sort_order')
    .eq('site_id', request.params.siteId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapFloorRowToDomain);
});

app.post<{ Body: { siteId: string; code: string; name: string; sortOrder: number } }>('/api/floors', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase
    .from('floors')
    .insert({
      site_id: request.body.siteId,
      code: request.body.code,
      name: request.body.name,
      sort_order: request.body.sortOrder
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return { id: data.id as string };
});

app.get<{ Params: { floorId: string } }>('/api/floors/:floorId/layout-draft', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);

  const { data: layoutVersions, error: layoutVersionsError } = await supabase
    .from('layout_versions')
    .select('id,floor_id,version_no,state')
    .eq('floor_id', request.params.floorId);

  if (layoutVersionsError) {
    throw layoutVersionsError;
  }

  const activeDraft = (layoutVersions ?? [])
    .filter((row) => row.state === 'draft')
    .sort((a, b) => b.version_no - a.version_no)[0];

  if (!activeDraft) {
    return reply.send(null);
  }

  const { data: racks, error: racksError } = await supabase
    .from('racks')
    .select('id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg')
    .eq('layout_version_id', activeDraft.id);

  if (racksError) {
    throw racksError;
  }

  if (!racks || racks.length === 0) {
    return {
      layoutVersionId: activeDraft.id,
      floorId: activeDraft.floor_id,
      rackIds: [],
      racks: {}
    };
  }

  const rackIds = racks.map((rack) => rack.id);
  const { data: rackFaces, error: rackFacesError } = await supabase
    .from('rack_faces')
    .select('id,rack_id,side,enabled,anchor,slot_numbering_direction,is_mirrored,mirror_source_face_id')
    .in('rack_id', rackIds);

  if (rackFacesError) {
    throw rackFacesError;
  }

  const faceIds = (rackFaces ?? []).map((face) => face.id);
  const { data: rackSections, error: rackSectionsError } =
    faceIds.length > 0
      ? await supabase.from('rack_sections').select('id,rack_face_id,ordinal,length').in('rack_face_id', faceIds)
      : { data: [], error: null };

  if (rackSectionsError) {
    throw rackSectionsError;
  }

  const sectionIds = (rackSections ?? []).map((section) => section.id);
  const { data: rackLevels, error: rackLevelsError } =
    sectionIds.length > 0
      ? await supabase.from('rack_levels').select('id,rack_section_id,ordinal,slot_count').in('rack_section_id', sectionIds)
      : { data: [], error: null };

  if (rackLevelsError) {
    throw rackLevelsError;
  }

  return mapLayoutDraftBundleToDomain({
    layoutVersion: activeDraft,
    racks,
    rackFaces: rackFaces ?? [],
    rackSections: rackSections ?? [],
    rackLevels: rackLevels ?? []
  });
});

app.post<{ Body: { floorId: string } }>('/api/layout-drafts', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase.rpc('create_layout_draft', {
    floor_uuid: request.body.floorId,
    actor_uuid: auth.user.id
  });

  if (error) {
    throw error;
  }

  return { id: data as string };
});

app.post<{ Body: { layoutDraft: unknown } }>('/api/layout-drafts/save', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase.rpc('save_layout_draft', {
    layout_payload: request.body.layoutDraft,
    actor_uuid: auth.user.id
  });

  if (error) {
    throw error;
  }

  return { layoutVersionId: data as string };
});

app.post<{ Params: { layoutVersionId: string } }>('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase.rpc('validate_layout_version', {
    layout_version_uuid: request.params.layoutVersionId
  });

  if (error) {
    throw error;
  }

  return mapValidationResult(data ?? { isValid: false, issues: [] });
});

app.post<{ Params: { layoutVersionId: string } }>('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
  const auth = await requireAuth(request, reply);
  if (!auth) return;

  const supabase = getUserClient(auth);
  const { data, error } = await supabase.rpc('publish_layout_version', {
    layout_version_uuid: request.params.layoutVersionId,
    actor_uuid: auth.user.id
  });

  if (error) {
    throw error;
  }

  return data;
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const message = error instanceof Error ? error.message : 'Unexpected BFF error';
  void reply.code(500).send({
    message
  });
});

await app.listen({
  port: env.port,
  host: env.host
});
