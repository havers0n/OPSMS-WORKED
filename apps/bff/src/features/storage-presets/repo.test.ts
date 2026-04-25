import { describe, expect, it } from 'vitest';
import { createStoragePresetsRepo } from './repo.js';

type ProfileRow = Record<string, unknown> & { id: string; priority: number };
type LevelRow = Record<string, unknown> & { id: string; profile_id: string };

function createStoragePresetSupabaseStub() {
  const profiles: ProfileRow[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      product_id: '33333333-3333-4333-8333-333333333333',
      code: 'EXISTING',
      name: 'Existing preset',
      profile_type: 'storage',
      scope_type: 'tenant',
      scope_id: '22222222-2222-4222-8222-222222222222',
      valid_from: null,
      valid_to: null,
      priority: 4,
      is_default: false,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    }
  ];
  const levels: LevelRow[] = [];

  function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Array<[string, unknown]>) {
    return rows.filter((row) => filters.every(([column, value]) => row[column] === value));
  }

  function createSelectBuilder<T extends Record<string, unknown>>(rows: T[]) {
    const filters: Array<[string, unknown]> = [];
    let inFilter: [string, unknown[]] | null = null;
    let orderColumn: string | null = null;
    let ascending = true;
    let limitCount: number | null = null;

    const resolveRows = () => {
      let result = applyFilters(rows, filters);
      if (inFilter) {
        result = result.filter((row) => inFilter?.[1].includes(row[inFilter[0]]));
      }
      if (orderColumn) {
        result = [...result].sort((left, right) => {
          const a = left[orderColumn as string];
          const b = right[orderColumn as string];
          const comparison = typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b));
          return ascending ? comparison : -comparison;
        });
      }
      return limitCount === null ? result : result.slice(0, limitCount);
    };

    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        inFilter = [column, values];
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orderColumn = column;
        ascending = options?.ascending ?? true;
        return builder;
      },
      limit(count: number) {
        limitCount = count;
        return Promise.resolve({ data: resolveRows(), error: null });
      },
      single() {
        return Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
      },
      maybeSingle() {
        return Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
      },
      then(resolve: (value: { data: T[]; error: null }) => unknown) {
        return Promise.resolve({ data: resolveRows(), error: null }).then(resolve);
      }
    };

    return builder;
  }

  const supabase = {
    from(table: string) {
      if (table === 'packaging_profiles') {
        return {
          select: () => createSelectBuilder(profiles),
          insert: (payload: Partial<ProfileRow>) => {
            const row = {
              ...payload,
              id: payload.id ?? '44444444-4444-4444-8444-444444444444',
              valid_from: null,
              valid_to: null,
              created_at: '2026-01-02T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z'
            } as ProfileRow;
            profiles.push(row);
            return {
              select: () => ({
                single: async () => ({ data: { id: row.id }, error: null })
              })
            };
          },
          update: (payload: Partial<ProfileRow>) => {
            const filters: Array<[string, unknown]> = [];
            const builder = {
              eq(column: string, value: unknown) {
                filters.push([column, value]);
                return builder;
              },
              select: () => ({
                maybeSingle: async () => {
                  const row = applyFilters(profiles, filters)[0] ?? null;
                  if (row) Object.assign(row, payload, { updated_at: '2026-01-03T00:00:00.000Z' });
                  return { data: row ? { id: row.id } : null, error: null };
                }
              })
            };
            return builder;
          }
        };
      }

      return {
        select: () => createSelectBuilder(levels),
        insert: async (payload: Array<Partial<LevelRow>>) => {
          for (const item of payload) {
            levels.push({
              ...item,
              id: item.id ?? `55555555-5555-4555-8555-55555555555${levels.length}`,
              profile_id: item.profile_id as string,
              parent_level_type: null,
              qty_per_parent: null,
              tare_weight_g: null,
              nominal_gross_weight_g: null,
              length_mm: null,
              width_mm: null,
              height_mm: null,
              cases_per_tier: null,
              tiers_per_pallet: null,
              max_stack_height: null,
              max_stack_weight: null,
              created_at: '2026-01-02T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z'
            } as LevelRow);
          }
          return { error: null };
        },
        delete: () => ({
          eq: async (_column: string, profileId: string) => {
            for (let index = levels.length - 1; index >= 0; index -= 1) {
              if (levels[index]?.profile_id === profileId) levels.splice(index, 1);
            }
            return { error: null };
          }
        })
      };
    }
  };

  return { supabase, profiles, levels };
}

describe('storage presets repo', () => {
  it('allocates default priority, creates profile levels, and lists the created preset', async () => {
    const { supabase, profiles, levels } = createStoragePresetSupabaseStub();
    const repo = createStoragePresetsRepo(supabase as never);

    const created = await repo.create(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      {
        code: 'PAL-12',
        name: 'Pallet 12 each',
        scopeType: 'tenant',
        isDefault: false,
        status: 'active',
        levels: [
          {
            levelType: 'EA',
            qtyEach: 12,
            containerType: 'pallet',
            legacyProductPackagingLevelId: '66666666-6666-4666-8666-666666666666'
          }
        ]
      }
    );

    expect(profiles.find((row) => row.id === created.id)?.priority).toBe(5);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({
      profile_id: created.id,
      level_type: 'EA',
      qty_each: 12,
      container_type: 'pallet'
    });

    const listed = await repo.listByProduct(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333'
    );

    expect(listed.some((preset) => preset.id === created.id && preset.levels.length === 1)).toBe(true);
  });

  it('persists PATCH updates before returning the reloaded preset', async () => {
    const { supabase } = createStoragePresetSupabaseStub();
    const repo = createStoragePresetsRepo(supabase as never);

    const patched = await repo.patch(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
      { name: 'Updated preset' }
    );

    expect(patched.name).toBe('Updated preset');
  });
});
