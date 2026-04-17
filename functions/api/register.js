// Register API endpoint for EdgeOne Pages Functions
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse } from './_utils.js';

/**
 * Generate random bytes as hex string
 * @param {number} length - Number of bytes
 * @returns {string} Hex string
 */
function randomBytesHex(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const body = await parseBody(request);
    const { email, password, nick, url, avatar } = body;

    // Validate input
    if (!email || !password) {
      return errorResponse('邮箱和密码不能为空', 400, corsHeaders);
    }

    if (!isValidEmail(email)) {
      return errorResponse('邮箱格式不正确', 400, corsHeaders);
    }

    if (password.length < 6) {
      return errorResponse('密码至少需要6个字符', 400, corsHeaders);
    }

    const db = new WalineKV(env.WALINE_KV);

    // Check if email already exists
    const existingUsers = await db.query('user', { email: email.toLowerCase() });
    if (existingUsers.length > 0) {
      return errorResponse('该邮箱已被注册', 409, corsHeaders);
    }

    // Check if this is the first user (will be admin)
    const userCount = await db.count('user');
    const isFirstUser = userCount === 0;

    // Generate salt and hash password
    const salt = randomBytesHex(16);
    const hashedPassword = await hashPassword(password, salt);

    // Create user
    const userId = randomBytesHex(16);
    const user = {
      id: userId,
      objectId: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      salt: salt,
      nick: nick || email.split('@')[0],
      url: url || '',
      avatar: avatar || '',
      type: isFirstUser ? 'administrator' : 'user',
      role: isFirstUser ? 'admin' : 'user',
      emailVerified: true,
      twoFAEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.create('user', user);

    // Generate JWT token
    const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
    if (!jwtSecret) {
      return errorResponse('服务器配置错误：缺少 JWT 密钥', 500, corsHeaders);
    }

    // Create JWT payload
    const payload = {
      objectId: userId,
      email: user.email,
      nick: user.nick,
      type: user.type,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    // Sign JWT using Web Crypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(jwtSecret);
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

    const token = `${headerB64}.${payloadB64}.${signatureB64}`;

    return createResponse({
      errno: 0,
      data: {
        token,
        user: {
          objectId: userId,
          email: user.email,
          nick: user.nick,
          url: user.url,
          avatar: user.avatar,
          type: user.type,
          role: user.role
        }
      }
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Register error:', error);
    return errorResponse(error.message || '注册失败，请稍后重试', 500, corsHeaders);
  }
}
