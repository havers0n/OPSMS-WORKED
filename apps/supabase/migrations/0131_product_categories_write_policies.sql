-- Allow authenticated users to insert/update/delete product categories
drop policy if exists product_categories_insert on public.product_categories;
create policy product_categories_insert
  on public.product_categories
  for insert
  to authenticated
  with check (true);

drop policy if exists product_categories_update on public.product_categories;
create policy product_categories_update
  on public.product_categories
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists product_categories_delete on public.product_categories;
create policy product_categories_delete
  on public.product_categories
  for delete
  to authenticated
  using (true);

-- Allow authenticated users to update products (e.g. assign category)
grant update on public.products to authenticated;

drop policy if exists products_update on public.products;
create policy products_update
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);
