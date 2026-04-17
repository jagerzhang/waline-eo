// EdgeOne Pages Functions Entry Point
// Waline EdgeOne - Full Featured

import { WalineKV } from '../src/kv.js';
import { CommentAPI } from '../src/api/comment.js';
import { UserAPI } from '../src/api/user.js';
import { AdminAPI } from '../src/api/admin.js';
import { NotifyService } from '../src/service/notify.js';
import { MarkdownService } from '../src/service/markdown.js';
import { AkismetService } from '../src/service/akismet.js';
import { AvatarService } from '../src/service/avatar.js';
import { verify as verifyJWT, extractBearerToken } from '../src/utils/auth.js';
import { adminUI } from '../src/ui/admin.js';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

// Configuration
const getConfig = (env) => ({
  jwtSecret: env.JWT_TOKEN || env.JWT_SECRET,
  siteName: env.SITE_NAME || 'Waline',
  siteUrl: env.SITE_URL || '',
  adminEmail: env.ADMIN_EMAIL,
  adminPasswordHash: env.ADMIN_PASSWORD_HASH,
  avatarProxy: env.AVATAR_PROXY,
  disallowIPList: env.DISALLOW_IP_LIST ? env.DISALLOW_IP_LIST.split(',') : [],
  forbiddenWords: env.FORBIDDEN_WORDS ? env.FORBIDDEN_WORDS.split(',') : [],
  levels: env.LEVELS ? env.LEVELS.split(',').map(Number) : [0, 10, 20, 50, 100, 200],
  audit: env.COMMENT_AUDIT === 'true',
  disableUserAgent: env.DISABLE_USERAGENT === 'true',
  disableRegion: env.DISABLE_REGION === 'true',
  ipQPS: parseInt(env.IP_QPS) || 60,
  likeIncMax: parseInt(env.LIKE_INC_MAX) || 10,
  oauthUrl: env.OAUTH_URL || 'https://oauth.lithub.cc',
  smtp: {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT) || 465,
    secure: env.SMTP_SECURE !== 'false',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    service: env.SMTP_SERVICE,
  },
  akismet: {
    key: env.AKISMET_KEY,
    site: env.SITE_URL,
  },
});

// Main Handler
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Initialize configuration
  const config = getConfig(env);

  // Initialize services
  const db = new WalineKV(env.WALINE_KV);
  const markdown = new MarkdownService(env);
  const notify = new NotifyService(env, config);
  const akismet = new AkismetService(config.akismet);
  const avatar = new AvatarService(config);

  // Initialize APIs
  const commentAPI = new CommentAPI(db, config, markdown, notify, akismet, avatar);
  const userAPI = new UserAPI(db, config, notify);
  const adminAPI = new AdminAPI(db, config);

  // Build context
  const ctx = {
    request,
    url,
    path,
    method: request.method,
    config,
    db,
    userInfo: null,
    isAdmin: false,
  };

  // Authenticate user if token provided
  try {
    const token = extractBearerToken(request);
    if (token && config.jwtSecret) {
      const decoded = await verifyJWT(token, config.jwtSecret);
      if (decoded) {
        ctx.userInfo = decoded;
        ctx.isAdmin = decoded.type === 'administrator';
      }
    }
  } catch (e) {
    // Invalid token, continue as guest
  }

  try {
    // Admin UI
    if (path === '/ui' || path === '/ui/' || path === '/') {
      return adminUI(request);
    }

    // Route matching
    const route = matchRoute(path, request.method);
    
    if (!route) {
      return jsonResponse({ errno: 404, errmsg: 'Not Found' }, 404);
    }

    // Execute handler
    const result = await route.handler(ctx, { commentAPI, userAPI, adminAPI });

    if (result instanceof Response) {
      return result;
    }

    return jsonResponse(result.data || result, result.status || 200);

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse(
      { errno: 500, errmsg: error.message || 'Internal Server Error' },
      500
    );
  }
}

// Route Matcher
function matchRoute(path, method) {
  const routes = [
    // Health & Version
    { path: '/health', method: 'GET', handler: async (ctx) => ({ errno: 0, data: { status: 'ok', version: '1.39.3-edgeone' } }) },
    { path: '/version', method: 'GET', handler: async (ctx) => ({ errno: 0, data: { version: '1.39.3-edgeone' } }) },
    
    // Comment APIs
    { path: '/comment', method: 'GET', handler: async (ctx, apis) => apis.commentAPI.get(ctx) },
    { path: '/comment', method: 'POST', handler: async (ctx, apis) => apis.commentAPI.post(ctx) },
    { path: '/comment', method: 'PUT', handler: async (ctx, apis) => apis.commentAPI.put(ctx) },
    { path: '/comment', method: 'DELETE', handler: async (ctx, apis) => apis.commentAPI.delete(ctx) },
    
    // User APIs
    { path: '/user', method: 'GET', handler: async (ctx, apis) => apis.userAPI.get(ctx) },
    { path: '/login', method: 'POST', handler: async (ctx, apis) => apis.userAPI.login(ctx) },
    { path: '/register', method: 'POST', handler: async (ctx, apis) => apis.userAPI.register(ctx) },
    { path: '/token', method: 'POST', handler: async (ctx, apis) => apis.userAPI.refreshToken(ctx) },
    { path: '/token', method: 'DELETE', handler: async (ctx, apis) => apis.userAPI.logout(ctx) },
    { path: '/forgot', method: 'POST', handler: async (ctx, apis) => apis.userAPI.forgot(ctx) },
    { path: '/verify', method: 'POST', handler: async (ctx, apis) => apis.userAPI.verify(ctx) },
    
    // OAuth
    { path: '/oauth', method: 'GET', handler: async (ctx, apis) => apis.userAPI.oauthLogin(ctx) },
    { path: '/oauth/callback', method: 'GET', handler: async (ctx, apis) => apis.userAPI.oauthCallback(ctx) },
    
    // Article/Count
    { path: '/article', method: 'GET', handler: async (ctx, apis) => apis.commentAPI.getArticleCount(ctx) },
    { path: '/article', method: 'POST', handler: async (ctx, apis) => apis.commentAPI.updateArticleCount(ctx) },
    { path: '/count', method: 'GET', handler: async (ctx, apis) => apis.commentAPI.getCounts(ctx) },
    
    // Recent/Hot
    { path: '/recent', method: 'GET', handler: async (ctx, apis) => apis.commentAPI.getRecent(ctx) },
    { path: '/hot', method: 'GET', handler: async (ctx, apis) => apis.commentAPI.getHot(ctx) },
    
    // Statistics
    { path: '/stat', method: 'GET', handler: async (ctx, apis) => apis.adminAPI.getStats(ctx) },
    { path: '/stat', method: 'PUT', handler: async (ctx, apis) => apis.adminAPI.updateStats(ctx) },
    
    // Admin APIs
    { path: '/admin/comment', method: 'GET', handler: async (ctx, apis) => apis.adminAPI.getComments(ctx) },
    { path: '/admin/comment', method: 'PUT', handler: async (ctx, apis) => apis.adminAPI.updateComment(ctx) },
    { path: '/admin/comment', method: 'DELETE', handler: async (ctx, apis) => apis.adminAPI.deleteComment(ctx) },
    { path: '/admin/user', method: 'GET', handler: async (ctx, apis) => apis.adminAPI.getUsers(ctx) },
    { path: '/admin/user', method: 'PUT', handler: async (ctx, apis) => apis.adminAPI.updateUser(ctx) },
    { path: '/admin/user', method: 'DELETE', handler: async (ctx, apis) => apis.adminAPI.deleteUser(ctx) },
    { path: '/admin/config', method: 'GET', handler: async (ctx, apis) => apis.adminAPI.getConfig(ctx) },
    { path: '/admin/config', method: 'PUT', handler: async (ctx, apis) => apis.adminAPI.updateConfig(ctx) },
    
    // Import/Export
    { path: '/db/export', method: 'GET', handler: async (ctx, apis) => apis.adminAPI.exportData(ctx) },
    { path: '/db/import', method: 'POST', handler: async (ctx, apis) => apis.adminAPI.importData(ctx) },
    
    // Upload
    { path: '/upload', method: 'POST', handler: async (ctx, apis) => apis.adminAPI.upload(ctx) },
  ];

  // Exact match first
  let route = routes.find(r => r.path === path && r.method === method);
  if (route) return route;

  // Pattern match
  route = routes.find(r => {
    if (r.method !== method) return false;
    if (path.startsWith(r.path + '/')) return true;
    return false;
  });

  return route;
}

// JSON Response Helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
