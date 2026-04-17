export default async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const kv = globalThis.WALINE_KV;
    
    if (!kv) {
      return new Response(JSON.stringify({ errno: 500, errmsg: 'WALINE_KV not found' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { email, password, nick } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const existing = await kv.get('email:' + email.toLowerCase());
    if (existing) {
      return new Response(JSON.stringify({ errno: 409, errmsg: '邮箱已注册' }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const userId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
    const salt = Date.now() + '' + Math.random();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if this is the first user (make them admin)
    const allUsers = await kv.list({ prefix: 'user:' });
    const isFirstUser = allUsers.keys.filter(k => !k.name.includes(':email:')).length === 0;

    const user = {
      id: userId,
      objectId: userId,
      email: email.toLowerCase(),
      password: hash,
      salt: salt,
      nick: nick || email.split('@')[0],
      type: isFirstUser ? 'administrator' : 'user',
      role: isFirstUser ? 'admin' : 'user',
      createdAt: new Date().toISOString()
    };

    await kv.put('user:' + userId, JSON.stringify(user));
    await kv.put('email:' + email.toLowerCase(), userId);

    return new Response(JSON.stringify({
      errno: 0,
      data: { objectId: userId, id: userId, email: user.email, nick: user.nick, type: user.type, role: user.role }
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (err) {
    return new Response(JSON.stringify({ errno: 500, errmsg: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
