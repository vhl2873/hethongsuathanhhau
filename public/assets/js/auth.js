import { supabase } from './lib/supabase-client.js';
import { api } from './lib/api.js';
import * as cart from './cart.js';

export async function signUp({ email, password, fullName }) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await mergeGuestCartIfNeeded();
  return data;
}

// Redirects the browser to the provider's consent screen; Supabase handles
// the callback and session creation automatically (detectSessionInUrl is on
// by default), landing the user back on redirectTo already signed in.
export async function signInWithOAuth(provider) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/account.html` },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Returns an unsubscribe function.
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// One-way, best-effort push of the guest localStorage cart into the DB
// cart (carts/cart_items) at login time. Does not clear localStorage or
// switch the active cart UI to the DB - that stays localStorage-driven
// regardless of auth state in this phase. The DB copy is a cross-device
// checkpoint, not a live bidirectional sync; failing silently here must
// never block login.
export async function mergeGuestCartIfNeeded() {
  const items = cart.getItems();
  if (!items.length) return;

  const session = await getSession();
  if (!session) return;

  try {
    await api.post(
      '/api/cart/merge',
      { items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) },
      { token: session.access_token },
    );
  } catch {
    // Best-effort only.
  }
}
