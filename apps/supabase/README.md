# Supabase App Skeleton

This folder contains migrations, SQL tests, and optional edge functions.

## SQL tests

Run the local SQL verification suite with:

```bash
npm run test --workspace @wos/supabase
```

The test harness applies local migrations, prepares test-only SQL extensions,
including pgTAP in the Supabase `extensions` schema, and then executes each
`apps/supabase/tests/sql/*.test.sql` file against the local Supabase database.
