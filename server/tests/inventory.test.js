import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCheckoutError } from '../src/services/checkoutErrors.js';

test('mapCheckoutError -> INSUFFICIENT_STOCK thanh loi 409 kem sku', () => {
  const err = mapCheckoutError({ message: 'INSUFFICIENT_STOCK:SUA-BOT-900G' });
  assert.equal(err.code, 'INSUFFICIENT_STOCK');
  assert.equal(err.status, 409);
  assert.equal(err.details.sku, 'SUA-BOT-900G');
});

test('mapCheckoutError -> VARIANT_NOT_FOUND thanh loi 404', () => {
  const err = mapCheckoutError({ message: 'VARIANT_NOT_FOUND:123' });
  assert.equal(err.code, 'VARIANT_NOT_FOUND');
  assert.equal(err.status, 404);
});

test('mapCheckoutError -> EMPTY_CART thanh loi 400', () => {
  const err = mapCheckoutError({ message: 'EMPTY_CART' });
  assert.equal(err.code, 'EMPTY_CART');
  assert.equal(err.status, 400);
});

test('mapCheckoutError -> INVALID_QUANTITY thanh loi 400', () => {
  const err = mapCheckoutError({ message: 'INVALID_QUANTITY' });
  assert.equal(err.code, 'INVALID_QUANTITY');
  assert.equal(err.status, 400);
});

test('mapCheckoutError -> INVALID_SHIPPING_METHOD thanh loi 400', () => {
  const err = mapCheckoutError({ message: 'INVALID_SHIPPING_METHOD' });
  assert.equal(err.code, 'INVALID_SHIPPING_METHOD');
  assert.equal(err.status, 400);
});

test('mapCheckoutError -> loi khong xac dinh thanh 500 chung chung', () => {
  const err = mapCheckoutError({ message: 'something postgres exploded' });
  assert.equal(err.code, 'CHECKOUT_FAILED');
  assert.equal(err.status, 500);
});

// --- Concurrency test against a real Supabase project -------------------
// Requires SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY to point at a project
// with schema.sql applied. Not runnable in this sandbox (no live Supabase
// credentials configured here) - skips itself when the env isn't present
// so `npm test` still passes cleanly without a live project, but the real
// check is available once real credentials exist.
const hasLiveSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

test(
  'checkout_create_order khong de ton kho am khi 2 request dong thoi tren cung 1 variant',
  { skip: !hasLiveSupabase && 'Can SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY that de chay integration test nay' },
  async () => {
    const { supabaseAdmin } = await import('../src/lib/supabaseAdmin.js');
    const { createOrder } = await import('../src/services/inventory.js');

    // Seed a throwaway variant with stock_quantity = 1, fire two concurrent
    // createOrder() calls each requesting quantity 1, and assert exactly one
    // succeeds while the other fails with INSUFFICIENT_STOCK - proving the
    // SELECT ... FOR UPDATE + conditional UPDATE in the RPC serializes
    // correctly under concurrency instead of allowing a negative stock race.
    const { data: product } = await supabaseAdmin
      .from('products')
      .insert({ name: 'Test concurrency', slug: `test-concurrency-${Date.now()}`, base_price: 10000 })
      .select()
      .single();
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .insert({ product_id: product.id, name: 'Mặc định', sku: `TEST-${Date.now()}`, price: 10000, stock_quantity: 1 })
      .select()
      .single();
    const { data: shippingMethod } = await supabaseAdmin
      .from('shipping_methods')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    const attempt = () =>
      createOrder({
        guestEmail: 'test@example.com',
        guestName: 'Test',
        guestPhone: '0000000000',
        shippingAddress: { line: 'test' },
        shippingMethodId: shippingMethod.id,
        items: [{ variant_id: variant.id, quantity: 1 }],
      }).then(
        (result) => ({ ok: true, result }),
        (error) => ({ ok: false, error }),
      );

    const [first, second] = await Promise.all([attempt(), attempt()]);
    const successes = [first, second].filter((r) => r.ok);
    const failures = [first, second].filter((r) => !r.ok);

    assert.equal(successes.length, 1, 'dung 1 trong 2 request phai thanh cong');
    assert.equal(failures.length, 1, 'dung 1 trong 2 request phai that bai');
    assert.equal(failures[0].error.code, 'INSUFFICIENT_STOCK');

    const { data: finalVariant } = await supabaseAdmin
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', variant.id)
      .single();
    assert.equal(finalVariant.stock_quantity, 0, 'ton kho khong duoc am va phai giam dung 1');

    await supabaseAdmin.from('products').delete().eq('id', product.id);
  },
);
