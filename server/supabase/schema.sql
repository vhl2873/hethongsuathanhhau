-- =====================================================================
-- Sieu Thi Sua Thanh Hau - Supabase schema (Postgres)
-- Apply once via Supabase SQL editor / CLI. Idempotent-ish (safe to re-run
-- on a fresh DB); not designed to be re-run against a populated DB.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row on signup. Promotes exactly one configured
-- email to admin; everyone else is customer.
--
-- Note: signup happens via supabase.auth.signUp() called directly from the
-- browser (Supabase Auth/GoTrue), never through the Express server. So the
-- admin email can't be passed in as a per-session GUC set by our own server
-- (that connection is never in the loop) - it must be readable from inside
-- the database itself. server/src/server.js upserts this row from the
-- SUPABASE_INITIAL_ADMIN_EMAIL env var on every boot, so the env var stays
-- the source of truth without requiring a manual SQL edit per deploy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_admin_email text;
begin
  select value #>> '{}' into v_initial_admin_email
    from public.app_settings where key = 'initial_admin_email';

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when v_initial_admin_email is not null
        and v_initial_admin_email <> ''
        and lower(new.email) = lower(v_initial_admin_email)
      then 'admin'
      else 'customer'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. categories
-- ---------------------------------------------------------------------
create table public.categories (
  id bigserial primary key,
  parent_id bigint references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_categories_parent_sort on public.categories(parent_id, sort_order);
create index idx_categories_active on public.categories(is_active);

-- ---------------------------------------------------------------------
-- 3. products / product_images / product_variants
-- ---------------------------------------------------------------------
create table public.products (
  id bigserial primary key,
  category_id bigint references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  brand text,
  base_price numeric(12, 0) not null check (base_price >= 0),
  compare_at_price numeric(12, 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_active on public.products(is_active);
create index idx_products_category on public.products(category_id);
create index idx_products_name_fts on public.products using gin (to_tsvector('simple', name));

create table public.product_images (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false
);
create index idx_product_images_product on public.product_images(product_id);

create table public.product_variants (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  name text not null,
  sku text not null unique,
  price numeric(12, 0) not null check (price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_product_variants_product on public.product_variants(product_id);

-- ---------------------------------------------------------------------
-- 4. shipping_methods / payment_methods (needed before orders/coupons FK)
-- ---------------------------------------------------------------------
create table public.shipping_methods (
  id bigserial primary key,
  name text not null,
  description text,
  fee numeric(12, 0) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.payment_methods (
  id bigserial primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- 5. coupons
-- ---------------------------------------------------------------------
create table public.coupons (
  id bigserial primary key,
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  min_order_amount numeric(12, 0) not null default 0,
  max_discount_amount numeric(12, 0),
  usage_limit int,
  used_count int not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. orders / order_items / order_status_history
-- ---------------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id bigserial primary key,
  order_number text unique,
  user_id uuid references public.profiles(id) on delete set null,
  guest_email text,
  guest_name text,
  guest_phone text,
  shipping_address jsonb not null,
  shipping_method_id bigint references public.shipping_methods(id),
  payment_method_id bigint references public.payment_methods(id),
  coupon_id bigint references public.coupons(id),
  subtotal numeric(12, 0) not null,
  discount_amount numeric(12, 0) not null default 0,
  shipping_fee numeric(12, 0) not null default 0,
  total_amount numeric(12, 0) not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Phone, not email, is the actually-required guest contact field (email
  -- is optional on the checkout form) - the constraint must match that.
  constraint orders_user_or_guest check (user_id is not null or guest_phone is not null)
);
create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'TH' || to_char(now(), 'YYMMDD') || lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

create table public.order_items (
  id bigserial primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  variant_id bigint references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  sku text,
  unit_price numeric(12, 0) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(12, 0) not null
);
create index idx_order_items_order on public.order_items(order_id);

create table public.order_status_history (
  id bigserial primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_order_status_history_order on public.order_status_history(order_id);

-- ---------------------------------------------------------------------
-- 7. carts / cart_items (logged-in users only; guests use localStorage)
-- ---------------------------------------------------------------------
create table public.carts (
  id bigserial primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id bigserial primary key,
  cart_id bigint not null references public.carts(id) on delete cascade,
  variant_id bigint not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- ---------------------------------------------------------------------
-- 8. reviews
-- ---------------------------------------------------------------------
create table public.reviews (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text,
  content text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_reviews_product_approved on public.reviews(product_id, is_approved);

-- ---------------------------------------------------------------------
-- 9. posts (blog only - about/faq/privacy are static HTML, no pages table)
-- ---------------------------------------------------------------------
create table public.posts (
  id bigserial primary key,
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_image_url text,
  author_id uuid references public.profiles(id),
  is_published boolean not null default false,
  published_at timestamptz,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_posts_published on public.posts(is_published, published_at desc);

-- ---------------------------------------------------------------------
-- 10. banners
-- ---------------------------------------------------------------------
create table public.banners (
  id bigserial primary key,
  title text,
  image_url text not null,
  link_url text,
  position text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);
create index idx_banners_position_active on public.banners(position, is_active);

-- ---------------------------------------------------------------------
-- 11. contacts / newsletter_subscribers
-- ---------------------------------------------------------------------
create table public.contacts (
  id bigserial primary key,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id bigserial primary key,
  email text not null unique,
  is_active boolean not null default true,
  subscribed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 12. app_settings (key-value store for header/footer store info)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 13. addresses / wishlists
-- ---------------------------------------------------------------------
create table public.addresses (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  ward text,
  district text,
  province text not null,
  is_default boolean not null default false
);
create index idx_addresses_user on public.addresses(user_id);

create table public.wishlists (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- =====================================================================
-- 14. checkout_create_order RPC
--   Atomic order creation: row-locks each variant (SELECT ... FOR UPDATE),
--   checks + conditionally decrements stock (UPDATE ... WHERE stock_quantity
--   >= qty), recomputes pricing from live DB values (never trusts client
--   price/stock/shipping-fee), and snapshots line items. Runs inside the
--   single implicit transaction of the RPC call, so any RAISE EXCEPTION
--   rolls back everything already done in this call.
-- =====================================================================
create or replace function public.checkout_create_order(
  p_user_id uuid,
  p_guest_email text,
  p_guest_name text,
  p_guest_phone text,
  p_shipping_address jsonb,
  p_shipping_method_id bigint,
  p_payment_method_id bigint,
  p_coupon_code text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_variant record;
  v_qty int;
  v_line_total numeric(12, 0);
  v_subtotal numeric(12, 0) := 0;
  v_discount numeric(12, 0) := 0;
  v_shipping_fee numeric(12, 0) := 0;
  v_total numeric(12, 0) := 0;
  v_coupon record;
  v_coupon_id bigint := null;
  v_order_id bigint;
  v_order_number text;
  v_snapshot jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- Pass 1: lock rows, validate stock, accumulate subtotal + snapshot.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    select pv.id, pv.sku, pv.name, pv.price, pv.stock_quantity, pv.is_active,
           p.id as product_id, p.name as product_name
      into v_variant
      from product_variants pv
      join products p on p.id = pv.product_id
     where pv.id = (v_item ->> 'variant_id')::bigint
     for update of pv;

    if not found or v_variant.is_active is not true then
      raise exception 'VARIANT_NOT_FOUND:%', (v_item ->> 'variant_id') using errcode = 'P0001';
    end if;

    if v_variant.stock_quantity < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_variant.sku using errcode = 'P0001';
    end if;

    update product_variants
       set stock_quantity = stock_quantity - v_qty,
           updated_at = now()
     where id = v_variant.id
       and stock_quantity >= v_qty;

    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', v_variant.sku using errcode = 'P0001';
    end if;

    v_line_total := v_variant.price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_variant.product_id,
      'variant_id', v_variant.id,
      'product_name', v_variant.product_name,
      'variant_name', v_variant.name,
      'sku', v_variant.sku,
      'unit_price', v_variant.price,
      'quantity', v_qty,
      'line_total', v_line_total
    );
  end loop;

  -- Coupon: re-validate server-side regardless of any client-side preview.
  if p_coupon_code is not null and p_coupon_code <> '' then
    select * into v_coupon from coupons
     where code = p_coupon_code
       and is_active
       and (starts_at is null or starts_at <= now())
       and (expires_at is null or expires_at >= now())
       and (usage_limit is null or used_count < usage_limit)
     for update;

    if found and v_subtotal >= v_coupon.min_order_amount then
      if v_coupon.discount_type = 'percentage' then
        v_discount := floor(v_subtotal * v_coupon.discount_value / 100);
        if v_coupon.max_discount_amount is not null then
          v_discount := least(v_discount, v_coupon.max_discount_amount);
        end if;
      else
        v_discount := least(v_coupon.discount_value, v_subtotal);
      end if;
      v_coupon_id := v_coupon.id;
      update coupons set used_count = used_count + 1 where id = v_coupon.id;
    end if;
  end if;

  -- Shipping fee: looked up server-side, never trusts a client-submitted fee.
  -- Both shipping/payment method are optional at order-request time - the
  -- store calls the customer to confirm delivery/payment details afterward,
  -- so a null id here just means "not decided yet" rather than an error.
  if p_shipping_method_id is not null then
    select fee into v_shipping_fee from shipping_methods
     where id = p_shipping_method_id and is_active;
    if v_shipping_fee is null then
      raise exception 'INVALID_SHIPPING_METHOD' using errcode = 'P0001';
    end if;
  else
    v_shipping_fee := 0;
  end if;

  v_total := v_subtotal - v_discount + v_shipping_fee;

  insert into orders (
    user_id, guest_email, guest_name, guest_phone, shipping_address,
    shipping_method_id, payment_method_id, coupon_id,
    subtotal, discount_amount, shipping_fee, total_amount
  ) values (
    p_user_id, p_guest_email, p_guest_name, p_guest_phone, p_shipping_address,
    p_shipping_method_id, p_payment_method_id,
    case when v_coupon_id is not null and v_discount > 0 then v_coupon_id else null end,
    v_subtotal, v_discount, v_shipping_fee, v_total
  ) returning id, order_number into v_order_id, v_order_number;

  insert into order_items (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total)
  select v_order_id,
         (item ->> 'product_id')::bigint,
         (item ->> 'variant_id')::bigint,
         item ->> 'product_name',
         item ->> 'variant_name',
         item ->> 'sku',
         (item ->> 'unit_price')::numeric,
         (item ->> 'quantity')::int,
         (item ->> 'line_total')::numeric
    from jsonb_array_elements(v_snapshot) as item;

  insert into order_status_history (order_id, status, note)
  values (v_order_id, 'pending', 'Đơn hàng được tạo');

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'shipping_fee', v_shipping_fee,
    'total_amount', v_total
  );
end;
$$;

revoke execute on function public.checkout_create_order from public, anon, authenticated;
grant execute on function public.checkout_create_order to service_role;

-- =====================================================================
-- 15. Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.reviews enable row level security;
alter table public.posts enable row level security;
alter table public.banners enable row level security;
alter table public.coupons enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.payment_methods enable row level security;
alter table public.contacts enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.app_settings enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;

-- Public read policies (catalog / content tables).
create policy categories_public_read on public.categories for select using (is_active);
create policy products_public_read on public.products for select using (is_active);
create policy product_images_public_read on public.product_images for select using (true);
create policy product_variants_public_read on public.product_variants for select using (is_active);
create policy banners_public_read on public.banners for select using (is_active);
create policy posts_public_read on public.posts for select using (is_published);
create policy reviews_public_read on public.reviews for select using (is_approved);
create policy app_settings_public_read on public.app_settings for select using (true);
-- Needed so the public checkout form (routes/checkout.js, using the anon
-- client) can list active shipping/payment options before an order exists.
create policy shipping_methods_public_read on public.shipping_methods for select using (is_active);
create policy payment_methods_public_read on public.payment_methods for select using (is_active);

-- No anon/authenticated policies on orders, order_items, order_status_history,
-- carts, cart_items, contacts, newsletter_subscribers, coupons: reachable
-- only via Express's service-role client (service_role bypasses RLS
-- regardless).

-- Own-row policies as defense-in-depth (app always goes through Express, but
-- the anon key ships in browser JS for Supabase Auth, so this is a backstop).
create policy profiles_own_row on public.profiles
  for select using (auth.uid() = id);
create policy profiles_own_row_update on public.profiles
  for update using (auth.uid() = id);
create policy addresses_own_row on public.addresses
  for all using (auth.uid() = user_id);
create policy wishlists_own_row on public.wishlists
  for all using (auth.uid() = user_id);

-- =====================================================================
-- 16. Seed data (minimum needed for Phase 1 footer + Phase 2 checkout to
--     have real, non-empty data to render).
-- =====================================================================
-- Placeholder; overwritten on every server boot from SUPABASE_INITIAL_ADMIN_EMAIL
-- (see server/src/server.js). Not a store-facing setting - never read by
-- routes/settings.js's public whitelist.
insert into public.app_settings (key, value) values
  ('initial_admin_email', '""');

insert into public.app_settings (key, value) values
  ('store_name', '"Siêu Thị Sữa Thanh Hậu"'),
  ('store_address', '"Số 271/16 đường Ngô Chí Quốc, Khu phố 8, Phường Tam Bình, Thành phố Hồ Chí Minh"'),
  ('store_phone', '"1900 1234"'),
  ('store_hotline', '"0909 123 456"'),
  ('store_email', '"lienhe@thanhhau.vn"'),
  ('opening_hours', '"7:00 - 21:00 hàng ngày"'),
  ('social_links', '{"facebook": "", "zalo": ""}'),
  ('logo_url', '""');

insert into public.categories (name, slug, sort_order) values
  ('Sữa bột', 'sua-bot', 1),
  ('Sữa tươi', 'sua-tuoi', 2),
  ('Sữa bầu', 'sua-bau', 3),
  ('Đồ dùng cho bé', 'do-dung-cho-be', 4);

insert into public.shipping_methods (name, description, fee, sort_order) values
  ('Giao hàng tiêu chuẩn', 'Giao trong 2-3 ngày', 20000, 1);

insert into public.payment_methods (name, description, sort_order) values
  ('Thanh toán khi nhận hàng (COD)', 'Trả tiền mặt khi nhận hàng', 1);
