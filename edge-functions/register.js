export default async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Debug: check WALINE_KV directly (allow GET for debug)
  if (request.url.includes('?debug=1') || request.method === 'GET') {
    const kvInfo = {
      envExists: !!env,
      envType: typeof env,
      walineKvExists: env && 'WALINE_KV' in env,
      walineKvType: env && env.WALINE_KV ? typeof env.WALINE_KV : 'undefined',
      walineKvValue: env && env.WALINE_KV ? String(env.WALINE_KV) : null,
      walineKvKeys: env && env.WALINE_KV && typeof env.WALINE_KV === 'object' 
        ? Object.keys(env.WALINE_KV) : null,
      hasGet: env && env.WALINE_KV && typeof env.WALINE_KV.get === 'function',
      hasPut: env && env.WALINE_KV && typeof env.WALINE_KV.put === 'function',
    };
    
    // Try to call get if it exists
    if (env && env.WALINE_KV && typeof env.WALINE_KV.get === 'function') {
      try {
        const test = await env.WALINE_KV.get('test');
        kvInfo.testResult = test;
      } catch (e) {
        kvInfo.testError = e.message;
      }
    }
    
    return new Response(JSON.stringify(kvInfo, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    if (!env || !env.WALINE_KV) {
      return new Response(JSON.stringify({ 
        errno: 500, 
        errmsg: 'WALINE_KV not found',
        env: !!env,
        keys: env ? Object.keys(env) : null
      }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const kv = env.WALINE_KV;

    const body = await request.json();
    const { email, password, nick } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check existing user
    const existing = await kv.get('email:' + email.toLowerCase());
    if (existing) {
      return new Response(JSON.stringify({ errno: 409, errmsg: '邮箱已注册' }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate ID
    const userId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);

    // Hash password
    const salt = Date.now() + '' + Math.random();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hash,
      salt: salt,
      nick: nick || email.split('@')[0],
      type: 'user',
      createdAt: new Date().toISOString()
    };

    await kv.put('user:' + userId, JSON.stringify(user));
    await kv.put('email:' + email.toLowerCase(), userId);

    return new Response(JSON.stringify({
      errno: 0,
      data: { id: userId, email: user.email, nick: user.nick }
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (err) {
    return new Response(JSON.stringify({ errno: 500, errmsg: err.message, stack: err.stack }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
