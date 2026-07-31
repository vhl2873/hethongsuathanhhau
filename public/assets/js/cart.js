// Guest cart state, kept in localStorage. unitPrice/productName/imageUrl are
// stored here only for display convenience while browsing - they are never
// trusted at checkout time; the server always re-reads the live price and
// stock from product_variants before creating an order (see
// server/supabase/schema.sql's checkout_create_order). Logged-in users'
// carts additionally sync to the carts/cart_items tables from Phase 3
// onward via POST /api/cart/merge; this module still owns the
// localStorage copy used before that sync happens.
const STORAGE_KEY = 'thanhhau_cart_v1';

function readCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart:changed', { detail: { items } }));
}

export function getItems() {
  return readCart();
}

export function addItem({ variantId, productSlug, productName, variantName, unitPrice, imageUrl, quantity = 1 }) {
  const items = readCart();
  const existing = items.find((item) => item.variantId === variantId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ variantId, productSlug, productName, variantName, unitPrice, imageUrl, quantity });
  }
  writeCart(items);
}

export function updateQuantity(variantId, quantity) {
  if (quantity <= 0) {
    removeItem(variantId);
    return;
  }
  const items = readCart();
  const item = items.find((item) => item.variantId === variantId);
  if (!item) return;
  item.quantity = quantity;
  writeCart(items);
}

export function removeItem(variantId) {
  writeCart(readCart().filter((item) => item.variantId !== variantId));
}

export function clearCart() {
  writeCart([]);
}

export function getCount() {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function getTotal() {
  return readCart().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
