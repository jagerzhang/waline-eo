// Admin UI endpoint
export default async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waline 管理后台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f6fa;
      color: #2c3e50;
      line-height: 1.6;
    }
    .login-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #27ae60 0%, #219a52 100%);
      padding: 20px;
    }
    .login-box {
      background: #fff;
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }
    .login-box h1 {
      text-align: center;
      margin-bottom: 8px;
      color: #27ae60;
    }
    .login-box .subtitle {
      text-align: center;
      color: #7f8c8d;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group { margin-bottom: 20px; }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #2c3e50;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e1e8ed;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.3s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #27ae60;
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: #27ae60;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn:hover { background: #219a52; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .switch-mode {
      text-align: center;
      margin-top: 20px;
      color: #7f8c8d;
      font-size: 14px;
    }
    .switch-mode a {
      color: #27ae60;
      text-decoration: none;
      cursor: pointer;
    }
    .error-msg {
      color: #e74c3c;
      font-size: 14px;
      margin-top: 8px;
      text-align: center;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="login-page">
    <div class="login-box">
      <h1>Waline</h1>
      <p class="subtitle" id="mode-title">登录到管理后台</p>

      <form id="auth-form">
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" id="email" placeholder="your@email.com" required>
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="password" placeholder="至少6个字符" required>
        </div>
        <div class="form-group hidden" id="nick-group">
          <label>昵称</label>
          <input type="text" id="nick" placeholder="显示名称">
        </div>
        <div class="error-msg" id="error-msg"></div>
        <button type="submit" class="btn" id="submit-btn">登录</button>
      </form>

      <div class="switch-mode">
        <span id="switch-text">还没有账号？</span>
        <a id="switch-link">立即注册</a>
      </div>
    </div>
  </div>

  <script>
    const form = document.getElementById('auth-form');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const nick = document.getElementById('nick');
    const nickGroup = document.getElementById('nick-group');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-msg');
    const modeTitle = document.getElementById('mode-title');
    const switchText = document.getElementById('switch-text');
    const switchLink = document.getElementById('switch-link');

    let isLogin = true;

    switchLink.addEventListener('click', () => {
      isLogin = !isLogin;
      if (isLogin) {
        modeTitle.textContent = '登录到管理后台';
        submitBtn.textContent = '登录';
        switchText.textContent = '还没有账号？';
        switchLink.textContent = '立即注册';
        nickGroup.classList.add('hidden');
      } else {
        modeTitle.textContent = '注册新账号';
        submitBtn.textContent = '注册';
        switchText.textContent = '已有账号？';
        switchLink.textContent = '立即登录';
        nickGroup.classList.remove('hidden');
      }
      errorMsg.textContent = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = isLogin ? '登录中...' : '注册中...';

      try {
        const endpoint = isLogin ? '/token' : '/register';
        const body = isLogin
          ? { email: email.value, password: password.value }
          : { email: email.value, password: password.value, nick: nick.value };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.errno !== 0) {
          throw new Error(data.errmsg || '请求失败');
        }

        // Save token
        localStorage.setItem('waline_token', data.data.token);
        localStorage.setItem('waline_user', JSON.stringify(data.data.user));

        alert(isLogin ? '登录成功！' : '注册成功！');
        // Redirect to dashboard (you can implement this)
        location.reload();
      } catch (err) {
        errorMsg.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? '登录' : '注册';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders
    }
  });
}
