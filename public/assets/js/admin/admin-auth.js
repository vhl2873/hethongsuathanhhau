import { getSession, signOut } from '../auth.js';
import { api } from '../lib/api.js';

// Verifies the current session belongs to an admin/staff user. Redirects to
// admin/login.html (signing out first) if not authenticated or not
// authorized - a wrong-role login is rejected immediately with a clear
// error, never left half-logged-in in the admin panel.
export async function requireAdminSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = './login.html';
    return null;
  }

  try {
    const profile = await api.get('/api/auth/me', { token: session.access_token });
    if (!['admin', 'staff'].includes(profile.role)) {
      await signOut();
      window.location.href = './login.html?error=forbidden';
      return null;
    }
    return { session, profile, token: session.access_token };
  } catch {
    await signOut();
    window.location.href = './login.html';
    return null;
  }
}
