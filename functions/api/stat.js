// Statistics API endpoint
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, extractBearerToken, getQueryParams } from './_utils.js';

/**
 * Verify JWT token
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<Object|null>}
 */
async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const db = new WalineKV(env.WALINE_KV);
    const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;

    // Authenticate if needed
    let userInfo = null;
    let isAdmin = false;
    if (jwtSecret) {
      const token = extractBearerToken(request);
      if (token) {
        userInfo = await verifyJWT(token, jwtSecret);
        isAdmin = userInfo && userInfo.type === 'administrator';
      }
    }

    switch (request.method) {
      case 'GET': {
        // Get statistics
        const comments = await db.list('comment');
        const users = await db.list('user');

        const approvedComments = comments.filter(c => c.status === 'approved' || !c.status);
        const pendingComments = comments.filter(c => c.status === 'pending');
        const spamComments = comments.filter(c => c.status === 'spam');

        const stats = {
          totalComments: comments.length,
          approvedComments: approvedComments.length,
          pendingComments: pendingComments.length,
          spamComments: spamComments.length,
          totalUsers: users.length,
          totalArticles: new Set(comments.map(c => c.url).filter(Boolean)).size
        };

        // Add daily stats for last 7 days (admin only)
        if (isAdmin) {
          const dailyStats = {};
          const now = new Date();
          for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyStats[dateStr] = 0;
          }

          comments.forEach(c => {
            const date = (c.createdAt || c.insertedAt || '').split('T')[0];
            if (dailyStats.hasOwnProperty(date)) {
              dailyStats[date]++;
            }
          });

          stats.daily = dailyStats;
        }

        return createResponse({ errno: 0, data: stats }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update stats (admin only)
        if (!isAdmin) {
          return errorResponse('需要管理员权限', 403, corsHeaders);
        }

        // Stats are calculated dynamically, nothing to update
        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Stat error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
