/**
 * Admin Panel - Full Layui-based replacement
 * Matches primeedge-admin purple theme
 * Supports: login, user management (list/role/ban/delete/reset-pwd), comment management
 */
import type { Env } from '../env.js';
import { getSetting } from '../router/settings.js';

export async function getAdminPage(env: Env, requestUrl: string): Promise<string> {
  const url = new URL(requestUrl);
  // 兼容旧版 @waline/admin 的 /ui/profile?token=... 跳转：将 token 提取后注入，页面端完成存储并重定向
  const urlToken = url.searchParams.get('token') || '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Waline 管理后台</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/layui@2.13.5/dist/css/layui.css">
<style>
:root {
  --pe-bg-base: #EEF1F6;
  --pe-bg-card: #FFFFFF;
  --pe-bg-input: #F5F6FA;
  --pe-border: #E3E6ED;
  --pe-text-primary: #1A202C;
  --pe-text-secondary: #64748B;
  --pe-text-muted: #94A3B8;
  --pe-accent: #6366F1;
  --pe-accent-hover: #4F46E5;
  --pe-accent-bg: rgba(99,102,241,0.08);
  --pe-success: #10B981;
  --pe-danger: #EF4444;
  --pe-warning: #F59E0B;
  --pe-radius: 10px;
  --pe-radius-sm: 6px;
  --pe-shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --pe-shadow-card: 0 2px 8px rgba(0,0,0,0.06);
  --sidebar-w: 220px;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--pe-bg-base); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--pe-text-primary); }

/* ===== Login Page ===== */
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); }
.login-card { background: #fff; border-radius: 16px; padding: 40px 36px; width: 380px; max-width: 95vw; box-shadow: 0 20px 60px rgba(99,102,241,0.25); }
.login-logo { text-align: center; margin-bottom: 28px; }
.login-logo h1 { font-size: 22px; font-weight: 700; color: var(--pe-accent); margin: 8px 0 0; }
.login-logo p { font-size: 13px; color: var(--pe-text-muted); margin: 4px 0 0; }
.login-field { margin-bottom: 16px; }
.login-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--pe-text-primary); }
.login-field input { width: 100%; padding: 10px 14px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 14px; background: var(--pe-bg-input); outline: none; transition: border-color .2s, box-shadow .2s; }
.login-field input:focus { border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg); }
.login-btn { width: 100%; padding: 11px; background: var(--pe-accent); color: #fff; border: none; border-radius: var(--pe-radius-sm); font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s; margin-top: 4px; }
.login-btn:hover { background: var(--pe-accent-hover); }
.login-err { color: var(--pe-danger); font-size: 13px; margin-top: 8px; min-height: 18px; }

/* ===== Admin Layout ===== */
.admin-layout { display: flex; min-height: 100vh; }
.admin-sidebar { width: var(--sidebar-w); background: var(--pe-bg-card); border-right: 1px solid var(--pe-border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-logo { padding: 20px 20px 16px; border-bottom: 1px solid var(--pe-border); }
.sidebar-logo h2 { font-size: 15px; font-weight: 700; color: var(--pe-accent); margin: 0; }
.sidebar-logo p { font-size: 11px; color: var(--pe-text-muted); margin: 2px 0 0; }
.sidebar-nav { flex: 1; padding: 12px 0; overflow-y: auto; }
.nav-group-label { font-size: 11px; font-weight: 600; color: var(--pe-text-muted); letter-spacing: .5px; text-transform: uppercase; padding: 8px 20px 4px; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 9px 20px; font-size: 13px; color: var(--pe-text-secondary); cursor: pointer; border-radius: 0; transition: all .15s; text-decoration: none; }
.nav-item:hover { background: var(--pe-accent-bg); color: var(--pe-accent); }
.nav-item.active { background: var(--pe-accent-bg); color: var(--pe-accent); font-weight: 600; border-right: 3px solid var(--pe-accent); }
.nav-item i { width: 16px; text-align: center; font-size: 14px; }
.sidebar-bottom { padding: 16px 20px; border-top: 1px solid var(--pe-border); }
.sidebar-user { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.sidebar-user img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.sidebar-user-info { flex: 1; min-width: 0; }
.sidebar-user-info .name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-user-info .role { font-size: 11px; color: var(--pe-text-muted); }
.logout-btn { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--pe-text-secondary); cursor: pointer; padding: 6px 0; background: none; border: none; width: 100%; transition: color .2s; }
.logout-btn:hover { color: var(--pe-danger); }

.admin-content { margin-left: var(--sidebar-w); flex: 1; padding: 24px; min-height: 100vh; }
.content-header { margin-bottom: 20px; }
.content-header h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
.content-header p { font-size: 13px; color: var(--pe-text-muted); margin: 0; }

/* ===== Card ===== */
.pe-card { background: var(--pe-bg-card); border-radius: var(--pe-radius); padding: 20px 24px; box-shadow: var(--pe-shadow-card); margin-bottom: 20px; }

/* ===== Table ===== */
.pe-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pe-table th { padding: 10px 12px; text-align: left; font-weight: 600; color: var(--pe-text-secondary); border-bottom: 2px solid var(--pe-border); background: var(--pe-bg-input); }
.pe-table td { padding: 10px 12px; border-bottom: 1px solid var(--pe-border); vertical-align: middle; }
.pe-table tr:hover td { background: var(--pe-accent-bg); }
.pe-table td.actions { white-space: nowrap; }

/* ===== Buttons ===== */
.pe-btn { border: none; cursor: pointer; border-radius: var(--pe-radius-sm); display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; font-size: 12px; font-weight: 500; transition: all .15s; }
.pe-btn-primary { background: var(--pe-accent); color: #fff; }
.pe-btn-primary:hover { background: var(--pe-accent-hover); }
.pe-btn-success { background: var(--pe-success); color: #fff; }
.pe-btn-danger { background: var(--pe-danger); color: #fff; }
.pe-btn-warning { background: var(--pe-warning); color: #fff; }
.pe-btn-default { background: var(--pe-bg-input); color: var(--pe-text-primary); border: 1px solid var(--pe-border); }
.pe-btn-default:hover { border-color: var(--pe-accent); color: var(--pe-accent); }
.pe-btn + .pe-btn { margin-left: 4px; }
.pe-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== Badge ===== */
.badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-admin { background: #EDE9FE; color: #7C3AED; }
.badge-guest { background: #F0FDF4; color: #15803D; }
.badge-banned { background: #FEF2F2; color: #B91C1C; }
.badge-approved { background: #F0FDF4; color: #15803D; }
.badge-waiting { background: #FEF9C3; color: #854D0E; }
.badge-spam { background: #FEF2F2; color: #B91C1C; }

/* ===== Pagination ===== */
.pe-pagination { display: flex; gap: 6px; justify-content: center; padding: 16px 0 0; flex-wrap: wrap; }
.pe-page-btn { border: 1px solid var(--pe-border); background: var(--pe-bg-card); color: var(--pe-text-secondary); border-radius: var(--pe-radius-sm); padding: 5px 12px; font-size: 12px; cursor: pointer; transition: all .15s; }
.pe-page-btn:hover, .pe-page-btn.active { background: var(--pe-accent); color: #fff; border-color: var(--pe-accent); }

/* ===== Search bar ===== */
.search-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.search-bar input, .search-bar select { padding: 7px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 13px; background: var(--pe-bg-input); outline: none; transition: border-color .2s; }
.search-bar input:focus, .search-bar select:focus { border-color: var(--pe-accent); }

/* ===== Toast ===== */
.pe-toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: var(--pe-radius-sm); font-size: 13px; z-index: 9999; animation: peSlideIn .3s ease; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.pe-toast-ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
.pe-toast-err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
@keyframes peSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

/* ===== Modal ===== */
.pe-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.pe-modal { background: var(--pe-bg-card); border-radius: var(--pe-radius); padding: 24px; min-width: 340px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
.pe-modal h3 { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.pe-modal .field { margin-bottom: 14px; }
.pe-modal label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; color: var(--pe-text-secondary); }
.pe-modal input, .pe-modal select { width: 100%; padding: 8px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 13px; background: var(--pe-bg-input); outline: none; }
.pe-modal input:focus, .pe-modal select:focus { border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg); }
.pe-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

/* ===== Comment content ===== */
.comment-text { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--pe-text-secondary); font-size: 12px; }

/* ===== Loading ===== */
.loading-box { text-align: center; padding: 40px; color: var(--pe-text-muted); font-size: 14px; }

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .admin-sidebar { transform: translateX(-100%); transition: transform .25s; }
  .admin-sidebar.open { transform: translateX(0); }
  .admin-content { margin-left: 0; }
  .pe-table { font-size: 12px; }
  .pe-table td, .pe-table th { padding: 8px; }
}
</style>
</head>
<body>

<!-- Login Page (hidden initially) -->
<div id="loginPage" class="login-wrap" style="display:none;">
  <div class="login-card">
    <div class="login-logo">
      <div style="font-size:40px;">💬</div>
      <h1>Waline 管理后台</h1>
      <p>Waline On EdgeOne</p>
    </div>
    <div class="login-field">
      <label>邮箱</label>
      <input type="email" id="loginEmail" placeholder="admin@example.com" autocomplete="username">
    </div>
    <div class="login-field">
      <label>密码</label>
      <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password">
    </div>
    <button class="login-btn" id="loginBtn">登录</button>
    <div class="login-err" id="loginErr"></div>
  </div>
</div>

<!-- Admin Layout (hidden initially) -->
<div id="adminLayout" class="admin-layout" style="display:none;">
  <!-- Sidebar -->
  <aside class="admin-sidebar" id="adminSidebar">
    <div class="sidebar-logo">
      <h2>💬 Waline 管理</h2>
      <p>Waline On EdgeOne</p>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-group-label">内容管理</div>
      <a class="nav-item active" data-page="users" onclick="navTo('users')">
        <i class="layui-icon layui-icon-username"></i> 用户管理
      </a>
      <a class="nav-item" data-page="comments" onclick="navTo('comments')">
        <i class="layui-icon layui-icon-chat"></i> 评论管理
      </a>
      <div class="nav-group-label" style="margin-top:8px;">系统</div>
      <a class="nav-item" href="/ui/worker-setting" target="_self">
        <i class="layui-icon layui-icon-set"></i> 评论系统设置
      </a>
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <img id="sidebarAvatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%236366F1'/%3E%3C/svg%3E" alt="avatar">
        <div class="sidebar-user-info">
          <div class="name" id="sidebarName">管理员</div>
          <div class="role" id="sidebarRole">administrator</div>
        </div>
      </div>
      <button class="logout-btn" onclick="doLogout()">
        <i class="layui-icon layui-icon-logout"></i> 退出登录
      </button>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="admin-content" id="adminContent">
    <div class="loading-box">加载中...</div>
  </main>
</div>

<!-- 兼容旧版 @waline/admin：/ui/profile?token=... 跳转拦截，必须在所有其他脚本之前执行 -->
<script>
(function(){
  var t = ${JSON.stringify(urlToken)};
  if (t) {
    try { localStorage.setItem('TOKEN', t); } catch(e) {}
    location.replace('/ui');
  }
})();
</script>

<script src="https://cdn.jsdelivr.net/npm/layui@2.13.5/dist/layui.js"></script>
<script>
(function(){
  // API 地址直接从浏览器 location.origin 获取，无需服务端注入
  var API = location.origin;
  var token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
  var currentUser = null;

  // ===== API Helper =====
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + '/api' + path, Object.assign({}, opts, { headers: headers })).then(function(r){ return r.json(); });
  }

  // ===== Toast =====
  function toast(msg, ok) {
    var el = document.createElement('div');
    el.className = 'pe-toast ' + (ok !== false ? 'pe-toast-ok' : 'pe-toast-err');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){ el.remove(); }, 300); }, 3000);
  }

  // ===== Escape =====
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ===== Init =====
  function init() {
    if (!token) { showLogin(); return; }
    api('/token').then(function(d) {
      if (d.errno === 0 && d.data && d.data.type === 'administrator') {
        currentUser = d.data;
        showAdmin();
      } else {
        token = null;
        localStorage.removeItem('TOKEN');
        showLogin();
      }
    }).catch(function() { showLogin(); });
  }

  // ===== Login =====
  function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminLayout').style.display = 'none';
    setTimeout(function(){ document.getElementById('loginEmail').focus(); }, 100);
  }

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('loginEmail').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('loginPassword').focus(); });

  function doLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var pwd = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginErr');
    var btn = document.getElementById('loginBtn');
    if (!email || !pwd) { errEl.textContent = '请填写邮箱和密码'; return; }
    btn.disabled = true; btn.textContent = '登录中...';
    errEl.textContent = '';
    api('/user/login', { method: 'POST', body: JSON.stringify({ email: email, password: pwd }) }).then(function(d) {
      if (d.errno === 0 && d.token) {
        if (d.data && d.data.type !== 'administrator') {
          errEl.textContent = '您没有管理员权限';
          btn.disabled = false; btn.textContent = '登录';
          return;
        }
        token = d.token;
        localStorage.setItem('TOKEN', token);
        currentUser = d.data;
        showAdmin();
      } else {
        errEl.textContent = d.errmsg || '登录失败，请检查邮箱和密码';
        btn.disabled = false; btn.textContent = '登录';
      }
    }).catch(function() {
      errEl.textContent = '网络错误，请重试';
      btn.disabled = false; btn.textContent = '登录';
    });
  }

  // ===== Admin Layout =====
  function showAdmin() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';
    if (currentUser) {
      document.getElementById('sidebarName').textContent = currentUser.display_name || currentUser.email || '管理员';
      document.getElementById('sidebarRole').textContent = currentUser.type || 'administrator';
      if (currentUser.avatar) document.getElementById('sidebarAvatar').src = currentUser.avatar;
    }
    navTo('users');
  }

  window.navTo = function(page) {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(el){ el.classList.remove('active'); });
    var active = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (active) active.classList.add('active');
    if (page === 'users') loadUsersPage();
    else if (page === 'comments') loadCommentsPage();
  };

  window.doLogout = function() {
    localStorage.removeItem('TOKEN');
    sessionStorage.removeItem('TOKEN');
    token = null;
    currentUser = null;
    showLogin();
  };

  // ===== Users Page =====
  var usersPage = 1;
  var usersPageSize = 15;

  function loadUsersPage(page) {
    usersPage = page || 1;
    var c = document.getElementById('adminContent');
    c.innerHTML = '<div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>';

    api('/user?page=' + usersPage + '&pageSize=' + usersPageSize).then(function(d) {
      if (d.errno !== 0) { c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">' + esc(d.errmsg || '加载失败') + '</div>'; return; }
      var data = d.data || {};
      var users = data.data || [];
      var totalPages = data.totalPages || 1;

      var html = '<div class="content-header"><h2>用户管理</h2><p>共 ' + (data.total || users.length) + ' 名用户</p></div>';
      html += '<div class="pe-card">';
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">';
      html += '</div>';
      html += '<div style="overflow-x:auto;"><table class="pe-table"><thead><tr>';
      html += '<th>用户</th><th>邮箱</th><th>角色</th><th>注册时间</th><th class="actions">操作</th>';
      html += '</tr></thead><tbody>';

      if (!users.length) {
        html += '<tr><td colspan="5" style="text-align:center;color:var(--pe-text-muted);padding:32px;">暂无用户数据</td></tr>';
      } else {
        users.forEach(function(u) {
          var roleClass = u.type === 'administrator' ? 'badge-admin' : (u.label === 'banned' ? 'badge-banned' : 'badge-guest');
          var roleLabel = u.type === 'administrator' ? '管理员' : (u.label === 'banned' ? '已封禁' : '普通用户');
          var avatar = u.avatar || ('https://cravatar.cn/avatar/?d=mp&s=40');
          var createdAt = u.createdAt ? u.createdAt.replace('T', ' ').replace('Z', '').substring(0, 16) : '-';
          html += '<tr>';
          html += '<td><div style="display:flex;align-items:center;gap:8px;"><img src="' + esc(avatar) + '" width="32" height="32" style="border-radius:50%;object-fit:cover;" onerror="this.src=this.dataset.fb" data-fb="https://cravatar.cn/avatar/?d=mp"><span style="font-weight:600;">' + esc(u.display_name || '-') + '</span></div></td>';
          html += '<td style="color:var(--pe-text-secondary);">' + esc(u.email || '-') + '</td>';
          html += '<td><span class="badge ' + roleClass + '">' + roleLabel + '</span></td>';
          html += '<td style="color:var(--pe-text-muted);font-size:12px;">' + createdAt + '</td>';
          html += '<td class="actions">';
          if (u.type !== 'administrator') {
            html += '<button class="pe-btn pe-btn-primary user-action" data-action="role" data-id="' + u.objectId + '" data-name="' + esc(u.display_name) + '" data-type="' + esc(u.type) + '">设角色</button>';
          }
          html += '<button class="pe-btn pe-btn-warning user-action" data-action="resetpwd" data-id="' + u.objectId + '" data-name="' + esc(u.display_name) + '">重置密码</button>';
          if (u.label !== 'banned' && u.type !== 'administrator') {
            html += '<button class="pe-btn pe-btn-default user-action" data-action="ban" data-id="' + u.objectId + '" data-name="' + esc(u.display_name) + '">封禁</button>';
          } else if (u.label === 'banned') {
            html += '<button class="pe-btn pe-btn-success user-action" data-action="unban" data-id="' + u.objectId + '" data-name="' + esc(u.display_name) + '">解封</button>';
          }
          html += '<button class="pe-btn pe-btn-danger user-action" data-action="delete" data-id="' + u.objectId + '" data-name="' + esc(u.display_name) + '">删除</button>';
          html += '</td></tr>';
        });
      }

      html += '</tbody></table></div>';

      // Pagination
      if (totalPages > 1) {
        html += '<div class="pe-pagination">';
        for (var p = 1; p <= totalPages; p++) {
          html += '<button class="pe-page-btn' + (p === usersPage ? ' active' : '') + '" onclick="loadUsersPage(' + p + ')">' + p + '</button>';
        }
        html += '</div>';
      }

      html += '</div>';
      c.innerHTML = html;
      // 事件委托：处理用户操作按钮（避免 onclick 内联引号嵌套问题）
      c.addEventListener('click', function(e) {
        var btn = (e.target as HTMLElement).closest('.user-action') as HTMLElement;
        if (!btn) return;
        var action = btn.dataset.action, id = btn.dataset.id, name = btn.dataset.name;
        if (action === 'role') showSetRoleModal(id, name, btn.dataset.type);
        else if (action === 'resetpwd') showResetPwdModal(id, name);
        else if (action === 'ban') banUser(id, name);
        else if (action === 'unban') unbanUser(id, name);
        else if (action === 'delete') deleteUser(id, name);
      });
    }).catch(function() {
      c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">加载失败，请刷新重试</div>';
    });
  }

  window.showSetRoleModal = function(id, name, currentType) {
    var mask = document.createElement('div');
    mask.className = 'pe-modal-mask';
    mask.innerHTML = '<div class="pe-modal"><h3>修改角色：' + esc(name) + '</h3>' +
      '<div class="field"><label>角色</label><select id="roleSelect">' +
      '<option value="administrator"' + (currentType==='administrator'?' selected':'') + '>管理员</option>' +
      '<option value="guest"' + (currentType!=='administrator'?' selected':'') + '>普通用户</option>' +
      '</select></div>' +
      '<div class="pe-modal-footer">' +
      '<button class="pe-btn pe-btn-default" onclick="this.closest(\'.pe-modal-mask\').remove()">取消</button>' +
      '<button class="pe-btn pe-btn-primary" onclick="doSetRole(' + id + ')">确认</button>' +
      '</div></div>';
    document.body.appendChild(mask);
  };

  window.doSetRole = function(id) {
    var type = document.getElementById('roleSelect').value;
    api('/user/' + id, { method: 'PUT', body: JSON.stringify({ type: type }) }).then(function(d) {
      if (d.errno === 0) { toast('角色已更新'); document.querySelector('.pe-modal-mask')?.remove(); loadUsersPage(usersPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.showResetPwdModal = function(id, name) {
    var mask = document.createElement('div');
    mask.className = 'pe-modal-mask';
    mask.innerHTML = '<div class="pe-modal"><h3>重置密码：' + esc(name) + '</h3>' +
      '<div class="field"><label>新密码</label><input type="password" id="newPwdInput" placeholder="输入新密码（至少6位）"></div>' +
      '<div class="field"><label>确认密码</label><input type="password" id="newPwdConfirm" placeholder="再次输入新密码"></div>' +
      '<div class="pe-modal-footer">' +
      '<button class="pe-btn pe-btn-default" onclick="this.closest(\'.pe-modal-mask\').remove()">取消</button>' +
      '<button class="pe-btn pe-btn-primary" onclick="doResetPwd(' + id + ')">确认重置</button>' +
      '</div></div>';
    document.body.appendChild(mask);
  };

  window.doResetPwd = function(id) {
    var pwd = document.getElementById('newPwdInput').value;
    var confirm = document.getElementById('newPwdConfirm').value;
    if (!pwd || pwd.length < 6) { toast('密码至少 6 位', false); return; }
    if (pwd !== confirm) { toast('两次密码不一致', false); return; }
    api('/user/' + id, { method: 'PUT', body: JSON.stringify({ password: pwd }) }).then(function(d) {
      if (d.errno === 0) { toast('密码已重置'); document.querySelector('.pe-modal-mask')?.remove(); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.banUser = function(id, name) {
    if (!confirm('确定封禁用户「' + name + '」？')) return;
    api('/user/' + id, { method: 'PUT', body: JSON.stringify({ label: 'banned' }) }).then(function(d) {
      if (d.errno === 0) { toast('已封禁用户'); loadUsersPage(usersPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.unbanUser = function(id, name) {
    if (!confirm('解除用户「' + name + '」的封禁？')) return;
    api('/user/' + id, { method: 'PUT', body: JSON.stringify({ label: '' }) }).then(function(d) {
      if (d.errno === 0) { toast('已解封'); loadUsersPage(usersPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.deleteUser = function(id, name) {
    if (!confirm('确定删除用户「' + name + '」？此操作不可撤销！')) return;
    api('/user/' + id, { method: 'DELETE' }).then(function(d) {
      if (d.errno === 0) { toast('用户已删除'); loadUsersPage(usersPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  // ===== Comments Page =====
  var cmtPage = 1;
  var cmtPageSize = 15;
  var cmtStatus = '';
  var cmtKeyword = '';

  function loadCommentsPage(page) {
    cmtPage = page || 1;
    var c = document.getElementById('adminContent');
    c.innerHTML = '<div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>';

    var qs = '?type=list&page=' + cmtPage + '&pageSize=' + cmtPageSize;
    if (cmtStatus) qs += '&status=' + encodeURIComponent(cmtStatus);
    if (cmtKeyword) qs += '&keyword=' + encodeURIComponent(cmtKeyword);

    api('/comment' + qs).then(function(d) {
      if (d.errno !== 0) { c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">' + esc(d.errmsg || '加载失败') + '</div>'; return; }
      var data = d.data || {};
      var comments = data.data || [];
      var totalPages = data.totalPages || 1;

      var html = '<div class="content-header"><h2>评论管理</h2><p>共 ' + (data.count || comments.length) + ' 条评论</p></div>';
      html += '<div class="pe-card">';
      html += '<div class="search-bar">';
      html += '<select id="cmtStatusFilter" onchange="cmtStatus=this.value;loadCommentsPage(1)"><option value="">全部状态</option><option value="approved"' + (cmtStatus==='approved'?' selected':'') + '>已通过</option><option value="waiting"' + (cmtStatus==='waiting'?' selected':'') + '>待审核</option><option value="spam"' + (cmtStatus==='spam'?' selected':'') + '>垃圾</option></select>';
      html += '<input id="cmtKeywordInput" value="' + esc(cmtKeyword) + '" placeholder="搜索评论内容..." style="flex:1;min-width:140px;">';
      html += '<button class="pe-btn pe-btn-primary" id="cmtSearchBtn">搜索</button>';
      html += '</div>';

      html += '<div style="overflow-x:auto;"><table class="pe-table"><thead><tr>';
      html += '<th>评论内容</th><th>评论者</th><th>页面</th><th>状态</th><th>时间</th><th class="actions">操作</th>';
      html += '</tr></thead><tbody>';

      if (!comments.length) {
        html += '<tr><td colspan="6" style="text-align:center;color:var(--pe-text-muted);padding:32px;">暂无评论数据</td></tr>';
      } else {
        comments.forEach(function(cm) {
          var statusClass = 'badge-' + (cm.status || 'approved');
          var statusLabel = cm.status === 'waiting' ? '待审核' : (cm.status === 'spam' ? '垃圾' : '已通过');
          var timeStr = cm.insertedAt ? cm.insertedAt.replace('T', ' ').replace('Z', '').substring(0, 16) : '-';
          var plainText = (cm.comment || '').replace(/<[^>]+>/g, '').substring(0, 60);
          html += '<tr>';
          html += '<td><div class="comment-text" title="' + esc(plainText) + '">' + esc(plainText) + '</div></td>';
          html += '<td style="font-size:12px;white-space:nowrap;">' + esc(cm.nick || '匿名') + '</td>';
          html += '<td style="font-size:12px;color:var(--pe-text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(cm.url || '') + '">' + esc(cm.url || '-') + '</td>';
          html += '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>';
          html += '<td style="font-size:12px;color:var(--pe-text-muted);white-space:nowrap;">' + timeStr + '</td>';
          html += '<td class="actions">';
          if (cm.status !== 'approved') html += '<button class="pe-btn pe-btn-success cmt-action" data-action="status" data-id="' + cm.objectId + '" data-status="approved">通过</button>';
          if (cm.status !== 'waiting') html += '<button class="pe-btn pe-btn-warning cmt-action" data-action="status" data-id="' + cm.objectId + '" data-status="waiting">待审</button>';
          if (cm.status !== 'spam') html += '<button class="pe-btn pe-btn-default cmt-action" data-action="status" data-id="' + cm.objectId + '" data-status="spam">垃圾</button>';
          html += '<button class="pe-btn pe-btn-danger cmt-action" data-action="delete" data-id="' + cm.objectId + '">删除</button>';
          html += '</td></tr>';
        });
      }

      html += '</tbody></table></div>';

      // Pagination
      if (totalPages > 1) {
        html += '<div class="pe-pagination">';
        for (var p = 1; p <= Math.min(totalPages, 20); p++) {
          html += '<button class="pe-page-btn' + (p === cmtPage ? ' active' : '') + '" onclick="loadCommentsPage(' + p + ')">' + p + '</button>';
        }
        if (totalPages > 20) html += '<span style="padding:5px 8px;color:var(--pe-text-muted);">...</span>';
        html += '</div>';
      }

      html += '</div>';
      c.innerHTML = html;
      // 事件委托：处理评论操作按钮（避免 onclick 内联引号嵌套问题）
      c.addEventListener('click', function(e) {
        var btn = (e.target as HTMLElement).closest('.cmt-action') as HTMLElement;
        if (!btn) return;
        var action = btn.dataset.action, id = btn.dataset.id;
        if (action === 'status') setCmtStatus(id, btn.dataset.status);
        else if (action === 'delete') deleteCmt(id);
      });
      // 搜索框事件绑定
      var searchBtn = document.getElementById('cmtSearchBtn');
      var searchInput = document.getElementById('cmtKeywordInput') as HTMLInputElement;
      if (searchBtn && searchInput) {
        var doSearch = function() { cmtKeyword = searchInput.value; loadCommentsPage(1); };
        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keydown', function(e) { if ((e as KeyboardEvent).key === 'Enter') doSearch(); });
      }
    }).catch(function() {
      c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">加载失败，请刷新重试</div>';
    });
  }

  window.setCmtStatus = function(id, status) {
    api('/comment/' + id, { method: 'PUT', body: JSON.stringify({ status: status }) }).then(function(d) {
      if (d.errno === 0) { toast('状态已更新'); loadCommentsPage(cmtPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.deleteCmt = function(id) {
    if (!confirm('确定删除该评论？')) return;
    api('/comment/' + id, { method: 'DELETE' }).then(function(d) {
      if (d.errno === 0) { toast('评论已删除'); loadCommentsPage(cmtPage); }
      else toast(d.errmsg || '操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  };

  window.loadUsersPage = loadUsersPage;
  window.loadCommentsPage = loadCommentsPage;

  // ===== Start =====
  init();
})();
</script>
</body>
</html>`;
}
