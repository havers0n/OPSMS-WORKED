import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { normalizeDeliveryPointAliasText } from '@wos/domain';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Error formatting ───────────────────────────────────────────────────────

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

// ── Input validation schemas ──────────────────────────────────────────────

const SeedDeliveryPointStatus = z.enum(['active', 'inactive', 'needs_review']);

const seedDeliveryPointSchema = z.object({
  sourceType: z.string().min(1),
  sourceExternalId: z.string().min(1),
  displayName: z.string().min(1),
  companyName: z.string().nullable(),
  siteName: z.string().nullable(),
  address: z.string().nullable(),
  municipality: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  status: SeedDeliveryPointStatus,
});

export type SeedDeliveryPoint = z.infer<typeof seedDeliveryPointSchema>;

const seedDeliveryPointArraySchema = z.array(seedDeliveryPointSchema);

const SeedAliasConfidence = z.enum(['confirmed', 'review', 'rejected']);

const seedAliasSchema = z.object({
  deliveryPointExternalId: z.string().min(1),
  aliasText: z.string().min(1),
  aliasSource: z.string().min(1),
  confidence: SeedAliasConfidence,
});

export type SeedAlias = z.infer<typeof seedAliasSchema>;

const seedAliasArraySchema = z.array(seedAliasSchema);

// ── Business rule: allowed input filenames ────────────────────────────────

const ALLOWED_POINTS_FILE = 'delivery_points_seed.json';
const ALLOWED_ALIASES_FILE = 'delivery_point_aliases_seed_clean.json';
const EXPECTED_POINTS_COUNT = 241;
const EXPECTED_ALIASES_COUNT = 680;

// ── Derivation helpers ────────────────────────────────────────────────────

export function deriveOfficialFuelAdminId(
  sourceType: string,
  sourceExternalId: string,
): string | null {
  if (sourceType === 'fuel_admin_registry') {
    const match = sourceExternalId.match(/^fuel_admin_(\d+)$/);
    if (match) return match[1];
  }
  return null;
}

// ── DB row builders ───────────────────────────────────────────────────────

export interface DeliveryPointDbRow {
  source_type: string;
  source_external_id: string;
  official_fuel_admin_id: string | null;
  display_name: string;
  company_name: string | null;
  site_name: string | null;
  address: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export function toDeliveryPointDbRow(seed: SeedDeliveryPoint): DeliveryPointDbRow {
  return {
    source_type: seed.sourceType,
    source_external_id: seed.sourceExternalId,
    official_fuel_admin_id: deriveOfficialFuelAdminId(seed.sourceType, seed.sourceExternalId),
    display_name: seed.displayName,
    company_name: seed.companyName,
    site_name: seed.siteName,
    address: seed.address,
    municipality: seed.municipality,
    latitude: seed.latitude,
    longitude: seed.longitude,
    status: seed.status,
  };
}

export interface AliasDbRow {
  delivery_point_id: string;
  alias_text: string;
  normalized_alias_text: string;
  alias_source: string;
  confidence: string;
}

export interface AliasDuplicateGroup {
  deliveryPointExternalId: string;
  aliasSource: string;
  normalizedAliasText: string;
  keptAliasText: string;
  duplicateAliasTexts: string[];
}

export interface NormalizeAndBuildResult {
  rows: AliasDbRow[];
  missingRefs: string[];
  duplicateCount: number;
  duplicateGroups: AliasDuplicateGroup[];
}

export function normalizeAndBuildAliasRows(
  aliases: SeedAlias[],
  pointExternalIdMap: Map<string, string>,
): NormalizeAndBuildResult {
  const missingRefs: string[] = [];
  const seen = new Set<string>();
  const firstAliasTextForKey = new Map<string, string>();
  const duplicateGroupMap = new Map<string, AliasDuplicateGroup>();
  const rows: AliasDbRow[] = [];

  for (const alias of aliases) {
    const pointId = pointExternalIdMap.get(alias.deliveryPointExternalId);
    if (!pointId) {
      if (!missingRefs.includes(alias.deliveryPointExternalId)) {
        missingRefs.push(alias.deliveryPointExternalId);
      }
      continue;
    }

    const normalized = normalizeDeliveryPointAliasText(alias.aliasText);
    const dedupKey = `${pointId}:${normalized}:${alias.aliasSource}`;

    if (seen.has(dedupKey)) {
      if (!duplicateGroupMap.has(dedupKey)) {
        duplicateGroupMap.set(dedupKey, {
          deliveryPointExternalId: alias.deliveryPointExternalId,
          aliasSource: alias.aliasSource,
          normalizedAliasText: normalized,
          keptAliasText: firstAliasTextForKey.get(dedupKey) ?? '',
          duplicateAliasTexts: [],
        });
      }
      duplicateGroupMap.get(dedupKey)!.duplicateAliasTexts.push(alias.aliasText);
      continue;
    }
    seen.add(dedupKey);
    firstAliasTextForKey.set(dedupKey, alias.aliasText);

    rows.push({
      delivery_point_id: pointId,
      alias_text: alias.aliasText,
      normalized_alias_text: normalized,
      alias_source: alias.aliasSource,
      confidence: alias.confidence,
    });
  }

  const duplicateGroups = Array.from(duplicateGroupMap.values());
  const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.duplicateAliasTexts.length, 0);

  return { rows, missingRefs, duplicateCount, duplicateGroups };
}

// ── Seed file loading ─────────────────────────────────────────────────────

export function loadSeedFiles(seedDir: string) {
  const pointsPath = join(seedDir, ALLOWED_POINTS_FILE);
  if (!existsSync(pointsPath)) {
    throw new Error(
      `Seed file not found: ${pointsPath}. Only ${ALLOWED_POINTS_FILE} is supported.`,
    );
  }
  const pointsRaw = JSON.parse(readFileSync(pointsPath, 'utf-8'));
  const points = seedDeliveryPointArraySchema.parse(pointsRaw);

  if (points.length !== EXPECTED_POINTS_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_POINTS_COUNT} delivery points in ${ALLOWED_POINTS_FILE}, got ${points.length}`,
    );
  }

  const aliasesPath = join(seedDir, ALLOWED_ALIASES_FILE);
  if (!existsSync(aliasesPath)) {
    throw new Error(
      `Seed file not found: ${aliasesPath}. Only ${ALLOWED_ALIASES_FILE} is supported.`,
    );
  }
  const aliasesRaw = JSON.parse(readFileSync(aliasesPath, 'utf-8'));
  const aliases = seedAliasArraySchema.parse(aliasesRaw);

  if (aliases.length !== EXPECTED_ALIASES_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ALIASES_COUNT} aliases in ${ALLOWED_ALIASES_FILE}, got ${aliases.length}`,
    );
  }

  return { points, aliases };
}

// ── Seed directory resolution ─────────────────────────────────────────────

function resolveSeedDir(seedDirArg: string | null): string {
  if (seedDirArg) {
    return resolve(seedDirArg);
  }
  const cwdPath = join(process.cwd(), 'src', 'features', 'delivery-points', 'seed-data');
  if (existsSync(cwdPath)) {
    return cwdPath;
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const relPath = resolve(scriptDir, '..', 'features', 'delivery-points', 'seed-data');
  if (existsSync(relPath)) {
    return relPath;
  }
  throw new Error(
    'Cannot locate seed-data directory. ' +
      'Run from apps/bff/ or pass --seed-dir <absolute-path>.',
  );
}

// ── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; seedDir: string | null } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let seedDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--seed-dir' && i + 1 < args.length) {
      seedDir = args[++i];
    }
  }

  return { dryRun, seedDir };
}

// ── Main entry point ──────────────────────────────────────────────────────

function printDuplicateReport(duplicateGroups: AliasDuplicateGroup[], duplicateCount: number): void {
  if (duplicateCount > 0) {
    console.log(`Duplicate alias rows removed: ${duplicateCount}`);
    const shown = duplicateGroups.slice(0, 20);
    for (const g of shown) {
      console.log(`  ${g.deliveryPointExternalId} | ${g.aliasSource} | ${g.normalizedAliasText}`);
      console.log(`    kept: "${g.keptAliasText}"`);
      for (const d of g.duplicateAliasTexts) {
        console.log(`    dup:  "${d}"`);
      }
    }
    if (duplicateGroups.length > 20) {
      console.log(`  ... and ${duplicateGroups.length - 20} more duplicate groups`);
    }
  }
}

export async function main(): Promise<void> {
  const { dryRun, seedDir: seedDirArg } = parseArgs();
  const seedDir = resolveSeedDir(seedDirArg);

  // 1. Load and validate seed files
  const { points, aliases } = loadSeedFiles(seedDir);

  const pointsRead = points.length;
  const aliasesRead = aliases.length;

  console.log(`DeliveryPoints read: ${pointsRead}`);
  console.log(`Aliases read: ${aliasesRead}`);

  // 2. Build DB rows for delivery points
  const pointDbRows = points.map(toDeliveryPointDbRow);

  // 3. Build fake point map for alias validation (needed in dry-run and normal mode)
  const fakeMap = new Map<string, string>();
  for (const p of points) {
    fakeMap.set(p.sourceExternalId, 'placeholder');
  }
  const { rows: aliasRows, missingRefs, duplicateCount, duplicateGroups } =
    normalizeAndBuildAliasRows(aliases, fakeMap);

  console.log(`Alias rows after normalization/dedup: ${aliasRows.length}`);
  printDuplicateReport(duplicateGroups, duplicateCount);

  if (missingRefs.length > 0) {
    console.log(`Missing alias point refs: ${missingRefs.length}`);
    for (const ref of missingRefs.slice(0, 10)) {
      console.log(`  Missing deliveryPointExternalId: ${ref}`);
    }
    throw new Error(
      `${missingRefs.length} alias(es) reference non-existent deliveryPointExternalId. ` +
        'Fix seed data before re-running.',
    );
  }
  console.log('Missing alias point refs: 0');

  // 4. Dry-run stops here
  if (dryRun) {
    console.log('Dry-run mode — no DB writes performed');
    return;
  }

  // 5. Create admin client
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 6. Upsert delivery points
  const { data: upsertedPoints, error: pointsError } = await supabase
    .from('delivery_points')
    .upsert(pointDbRows, {
      onConflict: 'source_type,source_external_id',
      ignoreDuplicates: false,
    })
    .select('id, source_type, source_external_id');

  if (pointsError) {
    throw new Error(
      `upserting delivery_points failed: ${formatUnknownError(pointsError)}`,
    );
  }
  if (!upsertedPoints) {
    throw new Error('upserting delivery_points failed: no data returned');
  }

  const pointsUpserted = upsertedPoints.length;
  console.log(`DeliveryPoints upserted: ${pointsUpserted}`);

  // 7. Build external ID -> DB ID map
  const pointExternalIdMap = new Map<string, string>();
  for (const p of upsertedPoints) {
    pointExternalIdMap.set(p.source_external_id, p.id);
  }

  // 8. Rebuild alias rows with real DB IDs
  const { rows: aliasDbRows } = normalizeAndBuildAliasRows(aliases, pointExternalIdMap);

  // 9. Upsert aliases in batches (PostgREST limit safety)
  const BATCH_SIZE = 250;
  let aliasesUpserted = 0;
  for (let i = 0; i < aliasDbRows.length; i += BATCH_SIZE) {
    const batch = aliasDbRows.slice(i, i + BATCH_SIZE);
    const { error: aliasErr } = await supabase
      .from('delivery_point_aliases')
      .upsert(batch, {
        onConflict: 'delivery_point_id,normalized_alias_text,alias_source',
        ignoreDuplicates: false,
      });

    if (aliasErr) {
      throw new Error(
        `upserting delivery_point_aliases failed: ${formatUnknownError(aliasErr)}`,
      );
    }
    aliasesUpserted += batch.length;
  }
  console.log(`Aliases upserted: ${aliasesUpserted}`);

  // 10. Post-import count verification
  const { count: dpCount, error: dpCountError } = await supabase
    .from('delivery_points')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'fuel_admin_registry');

  if (dpCountError) {
    throw new Error(
      `verifying delivery_points count failed: ${formatUnknownError(dpCountError)}`,
    );
  }
  console.log(`delivery_points count for source_type=fuel_admin_registry: ${dpCount}`);

  // Count total aliases as sanity check (avoids URL length limits from .in() with many IDs)
  const { count: aliasTotal, error: aliasCountError } = await supabase
    .from('delivery_point_aliases')
    .select('id', { count: 'exact', head: true });

  if (aliasCountError) {
    throw new Error(
      `verifying delivery_point_aliases count failed: ${formatUnknownError(aliasCountError)}`,
    );
  }
  console.log(`delivery_point_aliases total count: ${aliasTotal}`);

  console.log('\nDeliveryPoint seed import complete');
}

// ── Run when not imported ─────────────────────────────────────────────────

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('seed-delivery-points.ts') ||
  process.argv[1].endsWith('seed-delivery-points.js')
);
if (isMainModule) {
  main().catch((err: unknown) => {
    console.error(`Seed import failed:\n${formatUnknownError(err)}`);
    process.exit(1);
  });
}
