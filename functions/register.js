// Register API endpoint
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ errno: 400, errmsg: 'Invalid JSON' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { email, password, nick } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱格式不正确' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '密码至少需要6个字符' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!env.WALINE_KV) {
      return new Response(JSON.stringify({ errno: 500, errmsg: 'KV 存储未配置' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    const existingId = await env.WALINE_KV.get('user:email:' + email.toLowerCase());
    if (existingId) {
      return new Response(JSON.stringify({ errno: 409, errmsg: '该邮箱已被注册' }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if first user
    const { keys } = await env.WALINE_KV.list({ prefix: 'user:' });
    const isFirstUser = keys.filter(k => !k.name.includes(':email:')).length === 0;

    // Generate ID
    const userId = crypto.randomUUID ? crypto.randomUUID() : 
      `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;

    // Hash password
    const salt = `${Date.now()}${Math.random()}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
    const hashedPassword = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const user = {
      objectId: userId, id: userId,
      email: email.toLowerCase(),
      password: hashedPassword, salt,
      nick: nick || email.split('@')[0],
      url: '', avatar: '',
      type: isFirstUser ? 'administrator' : 'user',
      role: isFirstUser ? 'admin' : 'user',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await env.WALINE_KV.put('user:' + userId, JSON.stringify(user));
    await env.WALINE_KV.put('user:email:' + email.toLowerCase(), userId);

    // Generate JWT
    const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
    if (!jwtSecret) {
      return new Response(JSON.stringify({ errno: 500, errmsg: 'JWT 密钥未配置' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const payload = {
      objectId: userId, email: user.email, nick: user.nick,
      type: user.type, role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    };

    const keyData = encoder.encode(jwtSecret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${headerB64}.${payloadB64}`));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${headerB64}.${payloadB64}.${sigB64}`;

    return new Response(JSON.stringify({
      errno: 0,
      data: { token, user: { objectId: userId, email: user.email, nick: user.nick, url: '', avatar: '', type: user.type, role: user.role }}
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (error) {
    return new Response(JSON.stringify({ errno: 500, errmsg: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
