-- Run once after importing a data export that contains explicit bigserial IDs.
-- Keeps future inserts from reusing an imported primary key.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories',
    'products',
    'product_images',
    'product_variants',
    'shipping_methods',
    'payment_methods',
    'coupons',
    'orders',
    'order_items',
    'order_status_history',
    'carts',
    'cart_items',
    'reviews',
    'posts',
    'banners',
    'contacts',
    'newsletter_subscribers',
    'addresses',
    'wishlists'
  ]
  loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(id) from public.%I), 1), (select count(*) > 0 from public.%I))',
      'public.' || table_name,
      'id',
      table_name,
      table_name
    );
  end loop;
end $$;
