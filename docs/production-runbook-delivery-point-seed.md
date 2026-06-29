# Production Runbook: DeliveryPoint Seed Import

## Prerequisites

- PR `pr/delivery-point-seed-alias` is merged and deployed to the target environment.
- Supabase project URL and service role key are available (stored in secure secrets manager, not in code).
- Node.js 18+ available on the run host.
- `npm ci` has been run with the merged commit.

## Steps

### 1. Confirm deployed version includes this PR

```bash
git log --oneline -5 | grep -q 'delivery-point-seed-alias' && echo "PR present"
```

Or check the deployed commit hash matches the merge commit.

### 2. Take production DB backup/snapshot

Use Supabase CLI or database dashboard to create a logical backup before any writes:

```bash
pg_dump --no-owner --no-acl --format=custom -f pre_delivery_point_seed_backup.dump "$SUPABASE_DB_URL"
```

Or use Supabase Dashboard → Database → Backups → Trigger manual backup.

### 3. Run dry-run import on staging or production-copy first

```bash
cd apps/bff
npm run seed:delivery-points:local
```

This runs in dry-run mode (default). It validates:
- Seed file existence and structure
- Row counts (expected 241 points, 680 aliases)
- Schema validation via Zod
- Duplicate detection and reporting
- Missing alias-to-point reference checks

Review the output report. Fix any issues in the seed data before proceeding.

### 4. Review dry-run output

Expected output shape:
```
DeliveryPoints read: 241
Aliases read: 680
Alias rows after normalization/dedup: 680
Duplicate alias rows removed: 0
Missing alias point refs: 0
Dry-run mode — no DB writes performed. Use --apply to import.
```

Desired counts:
- **inserted**: N/A (dry-run) — will be total rows on first apply
- **updated**: N/A (dry-run) — will be 0 on first apply
- **skipped**: 0 (all rows validate)
- **duplicate/conflict**: 0 (seed data is clean)
- **invalid row count**: 0 (all pass Zod validation)
- **missing required fields**: 0

### 5. Confirm no destructive changes

Verify the run plan:
- No DROP/ALTER/DELETE operations are involved.
- The migration creates tables with `IF NOT EXISTS`.
- The seed script uses upsert (INSERT ... ON CONFLICT UPDATE).
- `authenticated` role has `select` only — no broad DML.
- Only `service_role` has `insert, update` rights.

### 6. Apply import with explicit approval

Set environment variables:

```bash
# From secure secrets manager, never printed or logged
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

If the target host matches a known production pattern, set:

```bash
# Acknowledge production target
export CONFIRM_PRODUCTION_DELIVERY_POINT_SEED=YES
```

Run:

```bash
cd apps/bff
npm run seed:delivery-points:apply:local
```

The script will log the target project URL, then perform:
1. Load and validate both seed files
2. Upsert 241 delivery points (on conflict: `source_type, source_external_id`)
3. Build point ID map and rebuild alias rows
4. Upsert aliases in batches of 250 (on conflict: `delivery_point_id, normalized_alias_text, alias_source`)
5. Post-import count verification

### 7. Verify import report

Expected output:
```
DeliveryPoints read: 241
Aliases read: 680
Alias rows after normalization/dedup: 680
Duplicate alias rows removed: 0
Missing alias point refs: 0
Target project URL: https://<project>.supabase.co
DeliveryPoints upserted: 241
Aliases upserted: 680
delivery_points count for source_type=fuel_admin_registry: 241
delivery_point_aliases total count: 680

DeliveryPoint seed import complete
```

Counts explanation:
- **inserted**: 241 points + 680 aliases (first run; on re-run these will be 0)
- **updated**: 0 (identical data; on re-run all 241 + 680 will be "upserted" as no-ops)
- **skipped**: 0
- **duplicate/conflict**: 0 (seed data is clean)
- **invalid row count**: 0
- **missing required fields**: 0

### 8. Re-run the import to prove idempotency

Run the apply command again:

```bash
npm run seed:delivery-points:apply:local
```

Expected:
```
DeliveryPoints upserted: 241
Aliases upserted: 680
delivery_points count for source_type=fuel_admin_registry: 241
delivery_point_aliases total count: 680
```

All counts match first run. No data duplication occurs because upsert on conflict key is idempotent.

### 9. Verify alias lookup / API behavior

```bash
# Using the matching endpoint (requires auth)
curl -X POST /api/delivery-points/match-aliases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"aliases": ["דור אלון - יסודות :950", "bogus alias"]}'
```

Expected response shape:
```json
{
  "results": [
    {
      "status": "matched",
      "input": "דור אלון - יסודות :950",
      "normalizedInput": "דור אלון - יסודות :950",
      "deliveryPoint": { "id": "...", "latitude": 31.81026403, "longitude": 34.85956775, ... }
    },
    {
      "status": "unmatched",
      "input": "bogus alias",
      "normalizedInput": "bogus alias"
    }
  ]
}
```

### 10. Save final import report

Save the full console output to a secure audit location:

```bash
npm run seed:delivery-points:apply:local > delivery_point_seed_apply_$(date +%Y%m%d_%H%M%S).log 2>&1
```

## Safety notes

- The seed script **never** prints the service role key.
- The seed script **never** performs DELETE or DROP operations.
- `authenticated` database role has `select` only — no insert/update/delete.
- Production apply requires `CONFIRM_PRODUCTION_DELIVERY_POINT_SEED=YES` when target URL matches production host patterns.
- All writes use idempotent upsert — re-running produces identical state.
- Dry-run is the default mode (no `--apply` flag = dry-run).
