// User API endpoint
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
    const url = new URL(request.url);
    const params = getQueryParams(url);

    // Authenticate
    let userInfo = null;
    if (jwtSecret) {
      const token = extractBearerToken(request);
      if (token) {
        userInfo = await verifyJWT(token, jwtSecret);
      }
    }

    switch (request.method) {
      case 'GET': {
        // Get user info
        if (!userInfo) {
          return errorResponse('未登录', 401, corsHeaders);
        }

        const users = await db.query('user', { objectId: userInfo.objectId });
        if (users.length === 0) {
          return errorResponse('用户不存在', 404, corsHeaders);
        }

        const user = users[0];
        return createResponse({
          errno: 0,
          data: {
            objectId: user.objectId || user.id,
            email: user.email,
            nick: user.nick,
            url: user.url,
            avatar: user.avatar,
            type: user.type,
            role: user.role
          }
        }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update profile
        if (!userInfo) {
          return errorResponse('未登录', 401, corsHeaders);
        }

        const body = await parseBody(request);
        const { nick, url, avatar } = body;

        const users = await db.query('user', { objectId: userInfo.objectId });
        if (users.length === 0) {
          return errorResponse('用户不存在', 404, corsHeaders);
        }

        const user = users[0];
        const updates = {
          ...user,
          nick: nick !== undefined ? nick : user.nick,
          url: url !== undefined ? url : user.url,
          avatar: avatar !== undefined ? avatar : user.avatar,
          updatedAt: new Date().toISOString()
        };

        await db.update('user', user.objectId || user.id, updates);

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

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('User error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
