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
    return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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
    /* Dashboard styles */
    .dashboard { display: none; min-height: 100vh; }
    .dashboard-header {
      background: #27ae60;
      color: white;
      padding: 15px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dashboard-header h1 { font-size: 20px; }
    .user-info { display: flex; align-items: center; gap: 15px; }
    .logout-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .dashboard-content {
      max-width: 1200px;
      margin: 30px auto;
      padding: 0 20px;
    }
    .stats-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      color: #7f8c8d;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .stat-card .number {
      font-size: 32px;
      font-weight: bold;
      color: #27ae60;
    }
    .comments-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
    }
    .comments-section h2 {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e1e8ed;
    }
    .comment-item {
      padding: 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    .comment-item:last-child { border-bottom: none; }
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .comment-author { font-weight: 600; color: #27ae60; }
    .comment-time { color: #95a5a6; font-size: 12px; }
    .comment-content { color: #2c3e50; line-height: 1.6; }
    .comment-actions { margin-top: 10px; }
    .comment-actions button {
      background: #e74c3c;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #95a5a6;
    }
  </style>
</head>
<body>
  <!-- Login Page -->
  <div class="login-page" id="login-page">
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

  <!-- Dashboard -->
  <div class="dashboard" id="dashboard">
    <div class="dashboard-header">
      <h1>Waline 管理后台</h1>
      <div class="user-info">
        <span id="user-name"></span>
        <button class="logout-btn" onclick="logout()">退出登录</button>
      </div>
    </div>
    <div class="dashboard-content">
      <div class="stats-cards">
        <div class="stat-card">
          <h3>总评论数</h3>
          <div class="number" id="total-comments">0</div>
        </div>
        <div class="stat-card">
          <h3>今日评论</h3>
          <div class="number" id="today-comments">0</div>
        </div>
        <div class="stat-card">
          <h3>用户数</h3>
          <div class="number" id="total-users">0</div>
        </div>
      </div>
      <div class="comments-section">
        <h2>最新评论</h2>
        <div id="comments-list">
          <div class="empty-state">加载中...</div>
        </div>
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

        if (isLogin) {
          // Show dashboard after login
          showDashboard(data.data.user);
        } else {
          alert('注册成功！请登录');
          location.reload();
        }
      } catch (err) {
        errorMsg.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? '登录' : '注册';
      }
    });

    // Dashboard functions
    function showDashboard(user) {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      document.getElementById('user-name').textContent = user.nick || user.email;
      loadDashboardData();
    }

    function logout() {
      localStorage.removeItem('waline_token');
      localStorage.removeItem('waline_user');
      location.reload();
    }

    async function loadDashboardData() {
      try {
        const token = localStorage.getItem('waline_token');

        // Load comments
        const res = await fetch('/comment', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const data = await res.json();

        if (data.errno === 0) {
          const comments = data.data || [];
          document.getElementById('total-comments').textContent = comments.length;

          // Count today's comments
          const today = new Date().toDateString();
          const todayCount = comments.filter(c => {
            const d = new Date(c.createdAt);
            return !isNaN(d) && d.toDateString() === today;
          }).length;
          document.getElementById('today-comments').textContent = todayCount;

          // Render comments
          renderComments(comments.slice(0, 20));
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&#039;');
    }

    function renderComments(comments) {
      const container = document.getElementById('comments-list');
      if (comments.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无评论</div>';
        return;
      }

      container.innerHTML = comments.map(c => '<div class="comment-item">' +
        '<div class="comment-header">' +
          '<span class="comment-author">' + escapeHtml(c.nick || '匿名') + '</span>' +
          '<span class="comment-time">' + new Date(c.createdAt).toLocaleString() + '</span>' +
        '</div>' +
        '<div class="comment-content">' + escapeHtml(c.comment) + '</div>' +
        '<div class="comment-actions">' +
          '<button onclick="deleteComment(' + JSON.stringify(c.objectId || c.id) + ')">删除</button>' +
        '</div>' +
      '</div>').join('');
    }

    async function deleteComment(id) {
      if (!confirm('确定要删除这条评论吗？')) return;

      try {
        const token = localStorage.getItem('waline_token');
        const res = await fetch('/comment?id=' + id, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();

        if (data.errno === 0) {
          loadDashboardData();
        } else {
          alert('删除失败: ' + data.errmsg);
        }
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    }

    // Check if already logged in
    const savedToken = localStorage.getItem('waline_token');
    const savedUser = localStorage.getItem('waline_user');
    if (savedToken && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        showDashboard(user);
      } catch (e) {
        localStorage.removeItem('waline_token');
        localStorage.removeItem('waline_user');
      }
    }
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
