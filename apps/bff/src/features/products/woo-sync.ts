const STORE_API_BASE = 'https://artos.co.il/wp-json/wc/store/v1/products';
const SOURCE = 'artos.co.il';
const PER_PAGE = 100;

type WooProduct = {
  id: number;
  name: string;
  permalink: string;
  sku: string;
  images: Array<{ src: string }>;
  is_purchasable: boolean;
};

export type ProductSyncRow = {
  source: string;
  external_product_id: string;
  name: string;
  sku: string | null;
  permalink: string;
  image_urls: string[];
  image_files: string[];
  is_active: boolean;
};

async function fetchPage(page: number): Promise<WooProduct[]> {
  const url = `${STORE_API_BASE}?per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WooCommerce API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<WooProduct[]>;
}

function mapToRow(p: WooProduct): ProductSyncRow {
  return {
    source: SOURCE,
    external_product_id: String(p.id),
    name: p.name,
    sku: p.sku || null,
    permalink: p.permalink,
    image_urls: p.images.map((i) => i.src),
    image_files: [],
    is_active: p.is_purchasable,
  };
}

export async function fetchAllWooProducts(): Promise<ProductSyncRow[]> {
  const rows: ProductSyncRow[] = [];
  let page = 1;

  while (true) {
    const products = await fetchPage(page);
    if (products.length === 0) break;
    rows.push(...products.map(mapToRow));
    if (products.length < PER_PAGE) break;
    page++;
  }

  return rows;
}
