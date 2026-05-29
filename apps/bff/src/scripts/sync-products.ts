import { createClient } from '@supabase/supabase-js';
import { fetchAllWooProducts } from '../features/products/woo-sync.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

console.log('Fetching products from artos.co.il...');
const rows = await fetchAllWooProducts();
console.log(`Fetched ${rows.length} products`);

const { error: upsertError } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'source,external_product_id' });

if (upsertError) throw upsertError;
console.log(`Upserted ${rows.length} products`);

// Deactivate products no longer returned by the API
if (rows.length > 0) {
  const seenIds = rows.map((r) => r.external_product_id);
  const { error: deactivateError } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('source', 'artos.co.il')
    .not('external_product_id', 'in', `(${seenIds.join(',')})`);

  if (deactivateError) throw deactivateError;
}

console.log('Sync complete');
