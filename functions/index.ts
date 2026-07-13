import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './env.js';
import { auth } from './middleware/auth.js';
import { commentRoutes } from './router/comment.js';
import { articleRoutes } from './router/article.js';
import { userRoutes } from './router/user.js';
import { tokenRoutes } from './router/token.js';
import { getSetting, settingsRoutes } from './router/settings.js';
import { oauthRoutes } from './router/oauth.js';
import { dbRoutes } from './router/db.js';
import { imageRoutes } from './router/image.js';
import { verificationRoutes } from './router/verification.js';
import { getWalinePage } from './_ui/waline-page.js';
import { getAdminPage, ADMIN_ETAG } from './_ui/admin-panel.js';
import { getCustomSettingsPage, get404Page } from './_ui/custom-admin.js';
import { isAllowedOrigin } from './utils/cors-origin.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ==================== 全局速率限制中间件 ====================
// 按 IP 限流，防止暴力破解和滥用
const GLOBAL_RATE_LIMIT = 120; // 每分钟最多请求数（GET/HEAD 除外）
const GLOBAL_RATE_WINDOW = 60;  // 窗口时间（秒）

async function globalRateLimit(ip: string): Promise<boolean> {
  const key = `rl:global:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    const raw = await WALINE_KV.get(key);
    const record = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
    if (now - record.windowStart > GLOBAL_RATE_WINDOW) {
      record.count = 1;
      record.windowStart = now;
    } else {
      record.count++;
    }
    await WALINE_KV.put(key, JSON.stringify(record), { expirationTtl: GLOBAL_RATE_WINDOW * 2 });
    return record.count <= GLOBAL_RATE_LIMIT;
  } catch {
    // KV 不可用时放行（避免阻断正常流量）
    return true;
  }
}

app.use('*', async (c, next) => {
  const method = c.req.method;
  // 仅对写操作和敏感操作进行限流，GET/HEAD/OPTIONS 放行
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const ip = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!(await globalRateLimit(ip))) {
      return c.json({ errno: 1, errmsg: 'Too many requests, please try again later' }, 429);
    }
  }
  await next();
});

// CORS
app.use(
  '*',
  cors({
    origin: async (origin, c) => {
      if (!origin) return '';
      const kvSiteUrl = await getSetting('site_url').catch(() => null);
      return isAllowedOrigin(origin, c.env, kvSiteUrl || '') ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'x-waline-version'],
    credentials: true,
  }),
);

// Waline version header (used by admin panel for export __version field)
app.use('*', async (c, next) => {
  await next();
  c.header('x-waline-version', '1.0.0');
});

// Auth middleware - parse JWT on all routes (non-blocking, skips if no token)
app.use('*', auth);

// Global error handler (catches malformed JSON bodies, etc.)
app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ errno: 1, errmsg: 'Invalid JSON body' }, 400);
  }
  console.error('[Unhandled Error]', err?.message || err);
  return c.json({ errno: 1, errmsg: err?.message || 'Internal Server Error' }, 500);
});

// Routes
app.route('/api/comment', commentRoutes);
app.route('/api/article', articleRoutes);
app.route('/api/user', userRoutes);
app.route('/api/token', tokenRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/oauth', oauthRoutes);
app.route('/api/db', dbRoutes);
app.route('/api/image', imageRoutes);
app.route('/api/verification', verificationRoutes);

// Worker custom settings page (server-side auth-gated)
app.get('/ui/worker-setting', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.html(get404Page(), 404);
  }
  return c.html(getCustomSettingsPage(c.req.url));
});

// Admin panel UI (original @waline/admin from CDN)
app.get('/ui', async (c) => {
  const url = new URL(c.req.url);
  const hasDynamic = url.searchParams.has('token') || url.searchParams.has('error');
  if (!hasDynamic && c.req.header('If-None-Match') === ADMIN_ETAG) {
    return new Response(null, { status: 304 });
  }
  const html = await getAdminPage(c.env, c.req.url);
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (!hasDynamic) {
    headers['ETag'] = ADMIN_ETAG;
    headers['Cache-Control'] = 'private, max-age=0, must-revalidate';
  }
  return c.html(html, 200, headers);
});
app.get('/ui/', async (c) => {
  const url = new URL(c.req.url);
  const hasDynamic = url.searchParams.has('token') || url.searchParams.has('error');
  if (!hasDynamic && c.req.header('If-None-Match') === ADMIN_ETAG) {
    return new Response(null, { status: 304 });
  }
  const html = await getAdminPage(c.env, c.req.url);
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (!hasDynamic) {
    headers['ETag'] = ADMIN_ETAG;
    headers['Cache-Control'] = 'private, max-age=0, must-revalidate';
  }
  return c.html(html, 200, headers);
});
app.get('/ui/*', async (c) => {
  const url = new URL(c.req.url);
  const hasDynamic = url.searchParams.has('token') || url.searchParams.has('error');
  if (!hasDynamic && c.req.header('If-None-Match') === ADMIN_ETAG) {
    return new Response(null, { status: 304 });
  }
  const html = await getAdminPage(c.env, c.req.url);
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (!hasDynamic) {
    headers['ETag'] = ADMIN_ETAG;
    headers['Cache-Control'] = 'private, max-age=0, must-revalidate';
  }
  return c.html(html, 200, headers);
});

// Waline frontend UI (root page)
app.get('/', (c) => {
  return c.html(getWalinePage());
});

// Password reset redirect handler: exchanges one-time code for JWT + secure cookie
app.get('/api/reset-redirect', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.redirect('/ui?error=invalid_reset');
  }
  try {
    const token = await WALINE_KV.get(`reset:${code}`);
    if (!token) {
      return c.redirect('/ui?error=reset_expired');
    }
    // Delete the one-time code immediately (single-use)
    await WALINE_KV.delete(`reset:${code}`);

    const isSecure = new URL(c.req.url).protocol === 'https:';
    const cookieStr = `TOKEN=${encodeURIComponent(token)}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${86400}`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/ui/profile',
        'Set-Cookie': cookieStr,
      },
    });
  } catch {
    return c.redirect('/ui?error=reset_error');
  }
});

// Fallback: catch any unmatched /ui routes (safety net for platform routing quirks)
app.notFound(async (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname === '/ui' || pathname.startsWith('/ui/')) {
    const html = await getAdminPage(c.env, c.req.url);
    return c.html(html);
  }
  return c.json({ errno: 1, errmsg: 'Not Found' }, 404);
});

export function onRequest(context: {
  request: Request;
  params: Record<string, string>;
  env: Record<string, any>;
  waitUntil?: (promise: Promise<any>) => void;
  executionCtx?: { waitUntil: (promise: Promise<any>) => void; passThroughOnException?: () => void };
}): Response | Promise<Response> {
  const executionCtx = context.executionCtx || (context.waitUntil
    ? { waitUntil: context.waitUntil.bind(context), passThroughOnException: () => {} }
    : undefined);
  return app.fetch(context.request, context.env, executionCtx as any);
}

export default app;
