-- Run this once in the Supabase SQL editor to apply two fixes to
-- checkout_create_order():
--   1. Pre-existing bug: coupon-less checkout (the common case) always
--      failed with "record v_coupon is not assigned yet" because the final
--      INSERT touched v_coupon.id even when the coupon branch never ran.
--   2. Shipping/payment method are now optional at order-request time - the
--      store calls the customer afterward to confirm delivery fee and
--      payment method, so a null shipping_method_id no longer raises
--      INVALID_SHIPPING_METHOD.

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

-- Pre-existing bug #3: this constraint required guest_email, but email is
-- optional on the checkout form (phone is the required guest contact field)
-- - so any guest checkout without an email always violated it.
alter table public.orders drop constraint if exists orders_user_or_guest;
alter table public.orders add constraint orders_user_or_guest
  check (user_id is not null or guest_phone is not null);
