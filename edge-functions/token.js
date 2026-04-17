// Token API endpoint (login, logout, update profile)
export default async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
  if (!jwtSecret) {
    return new Response(JSON.stringify({ 
      errno: 500, 
      errmsg: '服务器配置错误：缺少 JWT 密钥',
      debug: {
        hasEnv: !!env,
        envKeys: env ? Object.keys(env) : null,
        hasJWT_TOKEN: env && 'JWT_TOKEN' in env,
        jwtTokenType: env && env.JWT_TOKEN ? typeof env.JWT_TOKEN : 'undefined'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Helper: Extract bearer token
  const getToken = () => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  };

  // Helper: Verify JWT
  const verifyJWT = async (token) => {
    try {
      const [, payloadB64] = token.split('.');
      if (!payloadB64) return null;
      const payload = JSON.parse(atob(payloadB64));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  };

  // Helper: Hash password
  const hashPassword = async (password, salt) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Helper: Generate JWT
  const generateJWT = async (payload) => {
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

    return `${headerB64}.${payloadB64}.${signatureB64}`;
  };

  try {
    switch (request.method) {
      case 'POST': {
        // Login
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ errno: 400, errmsg: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { email, password } = body;

        if (!email || !password) {
          return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Find user by email - try multiple key formats for compatibility
        const emailLower = email.toLowerCase();
        let userId = await globalThis.WALINE_KV.get('email:' + emailLower);

        // Try alternative key formats if not found
        if (!userId) {
          userId = await globalThis.WALINE_KV.get('user:email:' + emailLower);
        }

        if (!userId) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '邮箱或密码错误' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const userData = await globalThis.WALINE_KV.get('user:' + userId);
        if (!userData) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '邮箱或密码错误' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const user = JSON.parse(userData);

        // Verify password
        const hashedPassword = await hashPassword(password, user.salt || '');
        if (hashedPassword !== user.password) {
          // Debug info for password mismatch (remove in production)
          console.error('Password mismatch:', {
            email: emailLower,
            userId: userId,
            hasSalt: !!user.salt,
            saltLength: user.salt ? user.salt.length : 0,
            storedHashLength: user.password ? user.password.length : 0,
            computedHashLength: hashedPassword.length
          });
          return new Response(JSON.stringify({ errno: 401, errmsg: '邮箱或密码错误' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Generate token
        const payload = {
          objectId: user.objectId || user.id,
          email: user.email,
          nick: user.nick,
          type: user.type,
          role: user.role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        };

        const token = await generateJWT(payload);

        return new Response(JSON.stringify({
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
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'PUT': {
        // Update profile
        const token = getToken();
        if (!token) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '未登录' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const decoded = await verifyJWT(token);
        if (!decoded) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '登录已过期' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ errno: 400, errmsg: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { nick, url, avatar } = body;

        const userData = await globalThis.WALINE_KV.get('user:' + decoded.objectId);
        if (!userData) {
          return new Response(JSON.stringify({ errno: 404, errmsg: '用户不存在' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const user = JSON.parse(userData);
        const updates = {
          ...user,
          nick: nick !== undefined ? nick : user.nick,
          url: url !== undefined ? url : user.url,
          avatar: avatar !== undefined ? avatar : user.avatar,
          updatedAt: new Date().toISOString()
        };

        await globalThis.WALINE_KV.put('user:' + (user.objectId || user.id), JSON.stringify(updates));

        return new Response(JSON.stringify({
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
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'DELETE': {
        // Logout - just return success
        return new Response(JSON.stringify({ errno: 0, data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      default:
        return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
  } catch (error) {
    console.error('Token error:', error);
    return new Response(JSON.stringify({ errno: 500, errmsg: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
