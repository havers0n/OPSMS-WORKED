import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..', '..', '..');
const manifestPath = path.join(rootDir, 'products', 'manifest.json');
const outputPath = path.join(
  rootDir,
  'apps',
  'supabase',
  'migrations',
  '0028_products_catalog_seed.sql'
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!Array.isArray(manifest.items)) {
  throw new Error('Expected manifest.items to be an array.');
}

const itemsJson = JSON.stringify(manifest.items);

const sql = `-- 0028_products_catalog_seed.sql

with manifest_items(item) as (
  select jsonb_array_elements($products$${itemsJson}$products$::jsonb)
)
insert into public.products (
  source,
  external_product_id,
  sku,
  name,
  permalink,
  image_urls,
  image_files
)
select
  'artos.co.il',
  item ->> 'id',
  nullif(trim(item ->> 'sku'), ''),
  item ->> 'name',
  nullif(trim(item ->> 'permalink'), ''),
  coalesce(item -> 'image_urls', '[]'::jsonb),
  coalesce(item -> 'image_files', '[]'::jsonb)
from manifest_items
on conflict (source, external_product_id) do update
set
  sku = excluded.sku,
  name = excluded.name,
  permalink = excluded.permalink,
  image_urls = excluded.image_urls,
  image_files = excluded.image_files,
  is_active = true,
  updated_at = timezone('utc', now());
`;

fs.writeFileSync(outputPath, sql);
console.log(`Wrote ${outputPath}`);
