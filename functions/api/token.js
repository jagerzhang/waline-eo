// Token API endpoint (login, refresh, update profile, logout)
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, extractBearerToken } from './_utils.js';

/**
 * Hash password using Web Crypto API
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate JWT token
 * @param {Object} payload
 * @param {string} secret
 * @returns {Promise<string>}
 */
async function generateJWT(payload, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(dataToSign)
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

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

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signature,
      encoder.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
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

  const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
  if (!jwtSecret) {
    return errorResponse('服务器配置错误：缺少 JWT 密钥', 500, corsHeaders);
  }

  try {
    const db = new WalineKV(env.WALINE_KV);

    switch (request.method) {
      case 'POST': {
        // Login
        const body = await parseBody(request);
        const { email, password } = body;

        if (!email || !password) {
          return errorResponse('邮箱和密码不能为空', 400, corsHeaders);
        }

        // Find user
        const users = await db.query('user', { email: email.toLowerCase() });
        if (users.length === 0) {
          return errorResponse('邮箱或密码错误', 401, corsHeaders);
        }

        const user = users[0];

        // Verify password
        const hashedPassword = await hashPassword(password, user.salt || '');
        if (hashedPassword !== user.password) {
          return errorResponse('邮箱或密码错误', 401, corsHeaders);
        }

        // Generate token
        const payload = {
          objectId: user.objectId || user.id,
          email: user.email,
          nick: user.nick,
          type: user.type,
          role: user.role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };

        const token = await generateJWT(payload, jwtSecret);

        return createResponse({
          errno: 0,
          data: {
            token,
            user: {
              objectId: user.objectId || user.id,
              email: user.email,
              nick: user.nick,
              url: user.url,
              avatar: user.avatar,
              type: user.type,
              role: user.role
            }
          }
        }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update profile
        const token = extractBearerToken(request);
        if (!token) {
          return errorResponse('未登录', 401, corsHeaders);
        }

        const decoded = await verifyJWT(token, jwtSecret);
        if (!decoded) {
          return errorResponse('登录已过期', 401, corsHeaders);
        }

        const body = await parseBody(request);
        const { nick, url, avatar } = body;

        const users = await db.query('user', { objectId: decoded.objectId });
        if (users.length === 0) {
          return errorResponse('用户不存在', 404, corsHeaders);
        }

        const user = users[0];
        const updates = {
          ...user,
          nick: nick || user.nick,
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

      case 'DELETE': {
        // Logout - just return success (client should remove token)
        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Token error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
