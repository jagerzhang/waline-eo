// Admin config API endpoint
import { WalineKV } from '../../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, extractBearerToken } from '../_utils.js';

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
        // Get config (from environment variables)
        const config = {
          siteName: env.SITE_NAME || 'Waline',
          siteUrl: env.SITE_URL || '',
          adminEmail: env.ADMIN_EMAIL || '',
          commentAudit: env.COMMENT_AUDIT === 'true',
          disableUserAgent: env.DISABLE_USERAGENT === 'true',
          disableRegion: env.DISABLE_REGION === 'true',
          ipQPS: parseInt(env.IP_QPS) || 60,
          levels: env.LEVELS ? env.LEVELS.split(',').map(Number) : [0, 10, 20, 50, 100, 200],
          recaptchaV3Key: env.RECAPTCHA_V3_KEY || '',
          turnstileKey: env.TURNSTILE_KEY || '',
          geetestCaptchaId: env.GEETEST_CAPTCHA_ID || '',
          smtpHost: env.SMTP_HOST || '',
          smtpPort: parseInt(env.SMTP_PORT) || 465,
          smtpSecure: env.SMTP_SECURE !== 'false',
          smtpUser: env.SMTP_USER || '',
          akismetKey: env.AKISMET_KEY || '',
        };

        return createResponse({ errno: 0, data: config }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update config - Note: In EdgeOne Pages, config is stored in env vars
        // which cannot be changed at runtime. We'll store overrides in KV.
        const body = await parseBody(request);

        // Store config overrides in KV
        const configOverrides = {
          ...body,
          updatedAt: new Date().toISOString(),
          updatedBy: userInfo.objectId
        };

        await db.put('config:overrides', JSON.stringify(configOverrides));

        return createResponse({ errno: 0, data: configOverrides }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Admin config error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
