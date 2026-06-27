import { describe, expect, it } from 'vitest';
import {
  deriveOfficialFuelAdminId,
  toDeliveryPointDbRow,
  normalizeAndBuildAliasRows,
  loadSeedFiles,
  type SeedDeliveryPoint,
  type SeedAlias,
  type DeliveryPointDbRow,
} from './seed-delivery-points.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const POINT_FIXTURE: SeedDeliveryPoint = {
  sourceType: 'fuel_admin_registry',
  sourceExternalId: 'fuel_admin_2503',
  displayName: 'דור אלון - תלמי אליהו',
  companyName: 'דור אלון',
  siteName: 'תלמי אליהו',
  address: 'ד.נ. 3 חבצלת השרון תלמי אליהו',
  municipality: 'מוא"ז עמק חפר',
  latitude: 31.81026403,
  longitude: 34.85956775,
  status: 'active',
};

const POINT_FIXTURE_NON_FUEL: SeedDeliveryPoint = {
  sourceType: 'manual',
  sourceExternalId: 'manual_001',
  displayName: 'Test Point',
  companyName: 'Test Corp',
  siteName: null,
  address: null,
  municipality: null,
  latitude: null,
  longitude: null,
  status: 'active',
};

const ALIAS_FIXTURE: SeedAlias = {
  deliveryPointExternalId: 'fuel_admin_2503',
  aliasText: 'דור אלון - תלמי אליהו :987',
  aliasSource: 'raw_customer_name',
  confidence: 'confirmed',
};

const ALIAS_ORIGINAL: SeedAlias = {
  deliveryPointExternalId: 'fuel_admin_2503',
  aliasText: 'דור אלון – תלמי אליהו :987',
  aliasSource: 'raw_customer_name',
  confidence: 'confirmed',
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('deriveOfficialFuelAdminId', () => {
  it('derives officialFuelAdminId from fuel_admin_registry sourceExternalId', () => {
    expect(deriveOfficialFuelAdminId('fuel_admin_registry', 'fuel_admin_2503')).toBe('2503');
  });

  it('derives 4-digit fuel admin id', () => {
    expect(deriveOfficialFuelAdminId('fuel_admin_registry', 'fuel_admin_1068')).toBe('1068');
  });

  it('returns null for non-fuel_admin_registry sourceType', () => {
    expect(deriveOfficialFuelAdminId('manual', 'fuel_admin_2503')).toBeNull();
  });

  it('returns null when sourceExternalId has no trailing digits', () => {
    expect(deriveOfficialFuelAdminId('fuel_admin_registry', 'fuel_admin_abc')).toBeNull();
  });

  it('returns null when sourceExternalId does not match expected pattern', () => {
    expect(deriveOfficialFuelAdminId('fuel_admin_registry', 'unknown_format')).toBeNull();
  });
});

describe('toDeliveryPointDbRow', () => {
  it('maps SeedDeliveryPoint to DB snake_case with derived officialFuelAdminId', () => {
    const row = toDeliveryPointDbRow(POINT_FIXTURE);
    expect(row.source_type).toBe('fuel_admin_registry');
    expect(row.source_external_id).toBe('fuel_admin_2503');
    expect(row.official_fuel_admin_id).toBe('2503');
    expect(row.display_name).toBe('דור אלון - תלמי אליהו');
    expect(row.company_name).toBe('דור אלון');
    expect(row.site_name).toBe('תלמי אליהו');
    expect(row.address).toBe('ד.נ. 3 חבצלת השרון תלמי אליהו');
    expect(row.municipality).toBe('מוא"ז עמק חפר');
    expect(row.latitude).toBe(31.81026403);
    expect(row.longitude).toBe(34.85956775);
    expect(row.status).toBe('active');
  });

  it('sets officialFuelAdminId to null for non-fuel source types', () => {
    const row = toDeliveryPointDbRow(POINT_FIXTURE_NON_FUEL);
    expect(row.official_fuel_admin_id).toBeNull();
  });

  it('maps nullable fields correctly', () => {
    const row = toDeliveryPointDbRow(POINT_FIXTURE_NON_FUEL);
    expect(row.site_name).toBeNull();
    expect(row.latitude).toBeNull();
    expect(row.longitude).toBeNull();
  });
});

describe('normalizeAndBuildAliasRows', () => {
  it('normalizes alias text and builds DB rows', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const { rows, missingRefs } = normalizeAndBuildAliasRows([ALIAS_FIXTURE], map);

    expect(missingRefs).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].delivery_point_id).toBe('point-uuid-1');
    expect(rows[0].alias_text).toBe('דור אלון - תלמי אליהו :987');
    expect(rows[0].alias_source).toBe('raw_customer_name');
    expect(rows[0].confidence).toBe('confirmed');
  });

  it('rejects alias with unknown deliveryPointExternalId', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const badAlias: SeedAlias = {
      deliveryPointExternalId: 'fuel_admin_9999',
      aliasText: 'Unknown point',
      aliasSource: 'order_import',
      confidence: 'confirmed',
    };
    const { rows, missingRefs } = normalizeAndBuildAliasRows([badAlias], map);

    expect(rows).toHaveLength(0);
    expect(missingRefs).toHaveLength(1);
    expect(missingRefs[0]).toBe('fuel_admin_9999');
  });

  it('deduplicates identical aliases (same point + normalized text + source)', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const dupes: SeedAlias[] = [ALIAS_FIXTURE, { ...ALIAS_FIXTURE }];
    const { rows } = normalizeAndBuildAliasRows(dupes, map);

    expect(rows).toHaveLength(1);
  });

  it('deduplicates aliases that normalize to the same text', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const aliases: SeedAlias[] = [ALIAS_FIXTURE, ALIAS_ORIGINAL];
    const { rows } = normalizeAndBuildAliasRows(aliases, map);

    expect(rows).toHaveLength(1);
    expect(rows[0].alias_text).toBe('דור אלון - תלמי אליהו :987');
  });

  it('keeps distinct aliases with different aliasSource', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const diffSource: SeedAlias = {
      ...ALIAS_FIXTURE,
      aliasSource: 'extracted_customer_label',
    };
    const { rows } = normalizeAndBuildAliasRows([ALIAS_FIXTURE, diffSource], map);

    expect(rows).toHaveLength(2);
  });

  it('collects all missing refs without duplicates', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const bad: SeedAlias[] = [
      { deliveryPointExternalId: 'missing_1', aliasText: 'a', aliasSource: 's', confidence: 'confirmed' },
      { deliveryPointExternalId: 'missing_2', aliasText: 'b', aliasSource: 's', confidence: 'confirmed' },
      { deliveryPointExternalId: 'missing_1', aliasText: 'c', aliasSource: 's', confidence: 'confirmed' },
    ];
    const { missingRefs } = normalizeAndBuildAliasRows(bad, map);

    expect(missingRefs).toHaveLength(2);
    expect(missingRefs).toContain('missing_1');
    expect(missingRefs).toContain('missing_2');
  });

  it('preserves confidence from seed data', () => {
    const map = new Map<string, string>([['fuel_admin_2503', 'point-uuid-1']]);
    const { rows } = normalizeAndBuildAliasRows([ALIAS_FIXTURE], map);

    expect(rows[0].confidence).toBe('confirmed');
  });
});

describe('loadSeedFiles', () => {
  it('loads and validates seed files from the actual seed-data directory', () => {
    const { points, aliases } = loadSeedFiles(
      'src/features/delivery-points/seed-data',
    );
    expect(points).toHaveLength(241);
    expect(aliases).toHaveLength(680);

    // Spot-check structure
    expect(points[0].sourceType).toBe('fuel_admin_registry');
    expect(points[0].sourceExternalId).toMatch(/^fuel_admin_\d+$/);
    expect(points[0].status).toBe('active');

    // Verify all aliases are confirmed (only clean file is used)
    for (const alias of aliases) {
      expect(alias.confidence).toBe('confirmed');
    }
  });
});
