// Admin comment API endpoint
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
        // Get comments list
        const { page = 1, pageSize = 10, status, keyword } = params;

        let comments = await db.list('comment');

        // Filter by status
        if (status) {
          comments = comments.filter(c => c.status === status);
        }

        // Filter by keyword
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase();
          comments = comments.filter(c =>
            (c.comment && c.comment.toLowerCase().includes(lowerKeyword)) ||
            (c.nick && c.nick.toLowerCase().includes(lowerKeyword)) ||
            (c.mail && c.mail.toLowerCase().includes(lowerKeyword))
          );
        }

        // Sort by createdAt desc
        comments.sort((a, b) => new Date(b.createdAt || b.insertedAt) - new Date(a.createdAt || a.insertedAt));

        // Pagination
        const total = comments.length;
        const start = (parseInt(page) - 1) * parseInt(pageSize);
        const paginated = comments.slice(start, start + parseInt(pageSize));

        return createResponse({
          errno: 0,
          data: paginated,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize)),
          total
        }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update comment (status, content)
        const body = await parseBody(request);
        const { objectId, status, comment: newContent } = body;

        if (!objectId) {
          return errorResponse('评论ID不能为空', 400, corsHeaders);
        }

        const comments = await db.query('comment', { objectId });
        if (comments.length === 0) {
          return errorResponse('评论不存在', 404, corsHeaders);
        }

        const existing = comments[0];
        const updates = { ...existing };

        if (status !== undefined) {
          updates.status = status;
        }

        if (newContent !== undefined) {
          updates.comment = newContent;
        }

        updates.updatedAt = new Date().toISOString();
        await db.update('comment', objectId, updates);

        return createResponse({ errno: 0, data: updates }, 200, corsHeaders);
      }

      case 'DELETE': {
        // Delete comment
        const { objectId } = params;

        if (!objectId) {
          return errorResponse('评论ID不能为空', 400, corsHeaders);
        }

        const comments = await db.query('comment', { objectId });
        if (comments.length === 0) {
          return errorResponse('评论不存在', 404, corsHeaders);
        }

        await db.delete('comment', objectId);

        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Admin comment error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
