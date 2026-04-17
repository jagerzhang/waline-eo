// Admin user API endpoint
import { WalineKV } from '../../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, extractBearerToken, getQueryParams } from '../_utils.js';

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
    const url = new URL(request.url);
    const params = getQueryParams(url);

    // Authenticate and check admin
    const token = extractBearerToken(request);
    if (!token || !jwtSecret) {
      return errorResponse('未登录', 401, corsHeaders);
    }

    const userInfo = await verifyJWT(token, jwtSecret);
    if (!userInfo) {
      return errorResponse('登录已过期', 401, corsHeaders);
    }

    if (userInfo.type !== 'administrator') {
      return errorResponse('需要管理员权限', 403, corsHeaders);
    }

    switch (request.method) {
      case 'GET': {
        // Get users list
        const { page = 1, pageSize = 10, type, keyword } = params;

        let users = await db.list('user');

        // Filter by type
        if (type) {
          users = users.filter(u => u.type === type);
        }

        // Filter by keyword
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase();
          users = users.filter(u =>
            (u.nick && u.nick.toLowerCase().includes(lowerKeyword)) ||
            (u.email && u.email.toLowerCase().includes(lowerKeyword))
          );
        }

        // Sort by createdAt desc
        users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const total = users.length;
        const start = (parseInt(page) - 1) * parseInt(pageSize);
        const paginated = users.slice(start, start + parseInt(pageSize));

        // Remove sensitive fields
        const sanitized = paginated.map(u => ({
          objectId: u.objectId || u.id,
          email: u.email,
          nick: u.nick,
          url: u.url,
          avatar: u.avatar,
          type: u.type,
          role: u.role,
          createdAt: u.createdAt
        }));

        return createResponse({
          errno: 0,
          data: sanitized,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize)),
          total
        }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update user
        const body = await parseBody(request);
        const { objectId, type, role, nick, url } = body;

        if (!objectId) {
          return errorResponse('用户ID不能为空', 400, corsHeaders);
        }

        const users = await db.query('user', { objectId });
        if (users.length === 0) {
          return errorResponse('用户不存在', 404, corsHeaders);
        }

        const existing = users[0];
        const updates = { ...existing };

        if (type !== undefined) updates.type = type;
        if (role !== undefined) updates.role = role;
        if (nick !== undefined) updates.nick = nick;
        if (url !== undefined) updates.url = url;

        updates.updatedAt = new Date().toISOString();
        await db.update('user', objectId, updates);

        return createResponse({
          errno: 0,
          data: {
            objectId: updates.objectId || updates.id,
            email: updates.email,
            nick: updates.nick,
            url: updates.url,
            avatar: updates.avatar,
            type: updates.type,
            role: updates.role
          }
        }, 200, corsHeaders);
      }

      case 'DELETE': {
        // Delete user
        const { objectId } = params;

        if (!objectId) {
          return errorResponse('用户ID不能为空', 400, corsHeaders);
        }

        // Prevent deleting yourself
        if (objectId === userInfo.objectId) {
          return errorResponse('不能删除自己的账号', 400, corsHeaders);
        }

        const users = await db.query('user', { objectId });
        if (users.length === 0) {
          return errorResponse('用户不存在', 404, corsHeaders);
        }

        await db.delete('user', objectId);

        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Admin user error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
