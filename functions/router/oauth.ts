import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { signJwt, verifyJwt } from '../middleware/auth.js';
import {
  type KVUser,
  getUserByEmail,
  getUserBySocial,
  getUserById,
  createUser,
  updateUser,
  getUserCount,
} from '../db/kv-store.js';

export const oauthRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const DEFAULT_OAUTH_URL = 'https://oauth.lithub.cc';

/**
 * GET /api/oauth - OAuth login flow (matching original Waline implementation)
 *
 * Step 1 (no code): Redirect user to external OAuth provider
 * Step 2 (with code): Exchange code for user info, create/link user, issue JWT
 */
oauthRoutes.get('/', async (c) => {
  const type = c.req.query('type');
  const code = c.req.query('code');
  const state = c.req.query('state') || '';
  const redirect = sanitizeRedirect(c.req.query('redirect'));
  const oauthUrl = c.env.OAUTH_URL || DEFAULT_OAUTH_URL;

  if (!type) {
    return c.json({ errno: 1, errmsg: 'type is required' }, 400);
  }

  // Step 1: No code -> redirect to OAuth provider
  if (!code) {
    // Build callback URL (back to this endpoint with redirect & type preserved)
    const reqUrl = new URL(c.req.url);
    const callbackUrl = `${reqUrl.origin}/api/oauth?redirect=${encodeURIComponent(redirect)}&type=${encodeURIComponent(type)}`;

    // Match original: ${oauthUrl}/${type}?redirect=${callbackUrl}&state=${token}
    // state passes through the user's JWT token (for account linking from profile page)
    const loginUrl = `${oauthUrl}/${type}?redirect=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;
    return c.redirect(loginUrl);
  }

  // Step 2: Have code -> exchange for user info
  try {
    // Match original: ${oauthUrl}/${type}?code=${code}&state=${state}
    const params = new URLSearchParams({ code });
    if (state) params.set('state', state);

    const userInfoUrl = `${oauthUrl}/${type}?${params.toString()}`;
    const resp = await fetch(userInfoUrl, {
      headers: { 'User-Agent': '@waline' },
    });

    if (!resp.ok) {
      return c.redirect(`${redirect}?error=oauth_failed`);
    }

    const oauthUser = await resp.json() as Record<string, any>;
    const socialId = String(oauthUser.id || oauthUser.login || oauthUser.name || '');
    const socialName = String(oauthUser.name || oauthUser.login || oauthUser.display_name || '');
    const socialEmail = String(oauthUser.email || '');
    const socialAvatar = String(oauthUser.avatar_url || oauthUser.avatar || '');
    const socialUrl = String(oauthUser.html_url || oauthUser.url || oauthUser.blog || '');

    if (!socialId) {
      return c.redirect(`${redirect}?error=oauth_no_id`);
    }

    const socialField = getSocialField(type);

    // Check if user is already logged in (binding from profile page)
    let currentUserId: number | null = null;
    if (state && c.env.JWT_SECRET) {
      try {
        const payload = await verifyJwt(state, c.env.JWT_SECRET);
        if (payload?.id) currentUserId = payload.id;
      } catch {
        // Invalid state token, ignore
      }
    }

    let user: KVUser | null = null;

    // If logged in, bind social account to current user
    if (currentUserId && socialField) {
      const currentUser = await getUserById(currentUserId);
      if (currentUser) {
        // Check if this social account is already linked to another user
        const existingSocialUser = await getUserBySocial(socialField, socialId);
        if (existingSocialUser && existingSocialUser.id !== currentUserId) {
          return c.redirect(`${redirect}?error=social_already_linked`);
        }
        await updateUser(currentUserId, { [socialField]: socialId });
        user = await getUserById(currentUserId);
      }
    }

    // If not binding mode, try to find existing user by social or email
    if (!user) {
      if (socialField) {
        user = await getUserBySocial(socialField, socialId);
      }
      if (!user && socialEmail) {
        user = await getUserByEmail(socialEmail);
        if (user && socialField) {
          await updateUser(user.id as number, { [socialField]: socialId });
          user = await getUserById(user.id as number);
        }
      }
    }

    // Create new user if not found
    if (!user) {
      const userCount = await getUserCount();
      const isFirst = userCount === 0;

      const email = socialEmail || `${type}_${socialId}@oauth.local`;

      const newUser = await createUser({
        display_name: socialName || socialId,
        email,
        password: '',
        type: isFirst ? 'administrator' : 'guest',
        url: socialUrl,
        avatar: socialAvatar,
        [socialField || 'github']: socialId,
      });

      user = newUser as any;
    }

    if (!user) {
      return c.redirect(`${redirect}?error=oauth_create_failed`);
    }

    if ((user.type as string) === 'banned') {
      return c.redirect(`${redirect}?error=account_banned`);
    }

    // Issue JWT
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.redirect(`${redirect}?error=server_error`);
    }

    const token = await signJwt({ id: user.id as number }, jwtSecret);

    // Set HttpOnly cookie for secure session management
    const isSecure = new URL(c.req.url).protocol === 'https:';
    const cookieHeader = `TOKEN=${encodeURIComponent(token)}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${86400 * 30}`;

    // Redirect with token (for admin panel) and set cookie (for server auth)
    const sep = redirect.includes('?') ? '&' : '?';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${redirect}${sep}token=${encodeURIComponent(token)}`,
        'Set-Cookie': cookieHeader,
      },
    });
  } catch {
    return c.redirect(`${redirect}?error=oauth_error`);
  }
});

/** Whitelist of valid redirect paths to prevent open redirect attacks */
const ALLOWED_REDIRECT_PATHS = new Set([
  '/', '/ui', '/ui/profile', '/ui/register',
]);

/** Ensure redirect is a safe path (prevent open redirect and phishing attacks) */
function sanitizeRedirect(input: string | undefined): string {
  if (!input) return '/ui';
  // Must start with single / and not contain protocol or auth bypass
  if (!input.startsWith('/') || input.startsWith('//')) return '/ui';
  // Strip query string and hash before validation
  const pathOnly = input.split('?')[0].split('#')[0];
  // Check against whitelist
  if (!ALLOWED_REDIRECT_PATHS.has(pathOnly)) {
    // Allow paths starting with /ui/ as sub-pages (but only valid chars)
    if (pathOnly.startsWith('/ui/') && /^\/ui\/[\w\-/.]+$/.test(pathOnly)) {
      return input;
    }
    return '/ui';
  }
  return input;
}

function getSocialField(type: string): string | null {
  const map: Record<string, string> = {
    github: 'github',
    twitter: 'twitter',
    facebook: 'facebook',
    google: 'google',
    weibo: 'weibo',
    qq: 'qq',
  };
  return map[type] || null;
}


