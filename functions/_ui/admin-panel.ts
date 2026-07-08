/**
 * Admin Panel - Full Layui-based replacement
 * Matches primeedge-admin purple theme
 * Features: global page-loading animation, login (email + 2FA + social OAuth),
 *           register, forgot-password info, user management, comment management,
 *           profile page (basic info, change password, social binding/unbinding, 2FA setup)
 */
import type { Env } from '../env.js';

const STATIC_HEAD = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Waline 管理后台</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://registry.npmmirror.com/layui/2.13.5/files/dist/css/layui.css">
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

/* ===== Global Page-Loading Overlay ===== */
#pageLoading {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 16px; transition: opacity .4s;
}
#pageLoading .pl-icon { font-size: 48px; animation: plPulse 1.2s ease-in-out infinite; }
#pageLoading .pl-text { color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 500; letter-spacing: .5px; }
@keyframes plPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.92)} }

/* ===== Auth Pages (login / register / forgot) ===== */
.auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); }
.auth-card { background: #fff; border-radius: 16px; padding: 40px 36px; width: 400px; max-width: 95vw; box-shadow: 0 20px 60px rgba(99,102,241,0.25); }
.auth-logo { text-align: center; margin-bottom: 24px; }
.auth-logo h1 { font-size: 22px; font-weight: 700; color: var(--pe-accent); margin: 8px 0 0; }
.auth-logo p { font-size: 13px; color: var(--pe-text-muted); margin: 4px 0 0; }
.auth-field { margin-bottom: 14px; }
.auth-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--pe-text-primary); }
.auth-field input { width: 100%; padding: 10px 14px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 14px; background: var(--pe-bg-input); outline: none; transition: border-color .2s, box-shadow .2s; }
.auth-field input:focus { border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg); }
.auth-btn { width: 100%; padding: 11px; background: var(--pe-accent); color: #fff; border: none; border-radius: var(--pe-radius-sm); font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s; margin-top: 4px; }
.auth-btn:hover { background: var(--pe-accent-hover); }
.auth-btn:disabled { opacity: .6; cursor: not-allowed; }
.auth-err { color: var(--pe-danger); font-size: 13px; margin-top: 8px; min-height: 18px; }
.auth-links { display: flex; justify-content: space-between; margin-top: 14px; font-size: 12px; }
.auth-links a { color: var(--pe-accent); cursor: pointer; text-decoration: none; }
.auth-links a:hover { text-decoration: underline; }

/* Social login */
.social-divider { display: flex; align-items: center; gap: 10px; margin: 18px 0 14px; }
.social-divider::before,.social-divider::after { content:''; flex:1; height:1px; background:var(--pe-border); }
.social-divider span { font-size: 12px; color: var(--pe-text-muted); white-space: nowrap; }
.social-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.social-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 12px; font-weight: 500; color: var(--pe-text-secondary); background: var(--pe-bg-input); cursor: pointer; text-decoration: none; transition: all .15s; }
.social-btn:hover { border-color: var(--pe-accent); color: var(--pe-accent); background: var(--pe-accent-bg); }
.social-btn svg { width: 15px; height: 15px; flex-shrink: 0; }

/* 2FA code row */
.twofa-input { width: 100%; padding: 10px 14px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 18px; letter-spacing: 6px; text-align: center; background: var(--pe-bg-input); outline: none; }
.twofa-input:focus { border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg); }

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
.sidebar-user { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; cursor: pointer; }
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
.pe-card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid var(--pe-border); }

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
.pe-page-btn:hover,.pe-page-btn.active { background: var(--pe-accent); color: #fff; border-color: var(--pe-accent); }

/* ===== Search bar ===== */
.search-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.search-bar input,.search-bar select { padding: 7px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 13px; background: var(--pe-bg-input); outline: none; transition: border-color .2s; }
.search-bar input:focus,.search-bar select:focus { border-color: var(--pe-accent); }

/* ===== Toast ===== */
.pe-toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: var(--pe-radius-sm); font-size: 13px; z-index: 10000; animation: peSlideIn .3s ease; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.pe-toast-ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
.pe-toast-err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
@keyframes peSlideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }

/* ===== Modal ===== */
.pe-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.pe-modal { background: var(--pe-bg-card); border-radius: var(--pe-radius); padding: 24px; min-width: 340px; max-width: 92vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
.pe-modal h3 { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.pe-modal .field { margin-bottom: 14px; }
.pe-modal label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; color: var(--pe-text-secondary); }
.pe-modal input,.pe-modal select { width: 100%; padding: 8px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); font-size: 13px; background: var(--pe-bg-input); outline: none; }
.pe-modal input:focus,.pe-modal select:focus { border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg); }
.pe-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

/* ===== Comment content ===== */
.comment-text { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--pe-text-secondary); font-size: 12px; }

/* ===== Import / Export ===== */
.import-log { background: var(--pe-bg-input); border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm); padding: 12px 16px; font-size: 12px; font-family: monospace; max-height: 260px; overflow-y: auto; color: var(--pe-text-secondary); white-space: pre-wrap; word-break: break-all; line-height: 1.6; }
.import-log .log-ok  { color: var(--pe-success); }
.import-log .log-err { color: var(--pe-danger); }
.import-log .log-info { color: var(--pe-accent); }

/* ===== Loading ===== */
.loading-box { text-align: center; padding: 40px; color: var(--pe-text-muted); font-size: 14px; }

/* ===== Profile social row ===== */
.social-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--pe-border); }
.social-row:last-child { border-bottom: none; }
.social-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--pe-bg-input); flex-shrink: 0; }
.social-icon svg { width: 16px; height: 16px; }
.social-label { font-size: 13px; font-weight: 600; min-width: 64px; }
.social-bound { flex: 1; font-size: 12px; color: var(--pe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.social-bound.is-bound { color: var(--pe-success); }

/* ===== 2FA ===== */
.qr-wrap { text-align: center; padding: 12px 0; }
.qr-wrap img { border: 2px solid var(--pe-border); border-radius: 8px; }
.secret-box { background: var(--pe-bg-input); border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 12px; letter-spacing: 1px; word-break: break-all; margin: 8px 0 4px; color: var(--pe-text-secondary); }

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .admin-sidebar { transform: translateX(-100%); transition: transform .25s; }
  .admin-sidebar.open { transform: translateX(0); }
  .admin-content { margin-left: 0; }
  .pe-table { font-size: 12px; }
  .pe-table td,.pe-table th { padding: 8px; }
}
</style>
</head>
<body>

<!-- ===== Global Page-Loading Overlay ===== -->
<div id="pageLoading">
  <div class="pl-icon">&#x1F4AC;</div>
  <div class="pl-text">Waline 管理后台</div>
</div>

<!-- ===== Login Page ===== -->
<div id="loginPage" class="auth-wrap" style="display:none;">
  <div class="auth-card">
    <div class="auth-logo">
      <div style="font-size:40px;">&#x1F4AC;</div>
      <h1>Waline 管理后台</h1>
      <p>Waline On EdgeOne</p>
    </div>
    <div class="auth-field">
      <label>邮箱</label>
      <input type="email" id="loginEmail" placeholder="admin@example.com" autocomplete="username">
    </div>
    <div class="auth-field">
      <label>密码</label>
      <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password">
    </div>
    <div id="login2faWrap" style="display:none;" class="auth-field">
      <label>两步验证码</label>
      <input type="text" id="login2faCode" class="twofa-input" maxlength="6" placeholder="6位验证码" autocomplete="one-time-code" inputmode="numeric">
    </div>
    <button class="auth-btn" id="loginBtn">登录</button>
    <div class="auth-err" id="loginErr"></div>
    <div class="auth-links">
      <a id="toRegisterLink">没有账号？注册</a>
      <a id="toForgotLink">忘记密码？</a>
    </div>
    <div class="social-divider"><span>或通过社交账号登录</span></div>
    <div class="social-btns">
      <a class="social-btn" data-oauth="github">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 22.3 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z"/></svg>
        GitHub
      </a>
      <a class="social-btn" data-oauth="google">
        <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google
      </a>
      <a class="social-btn" data-oauth="qq">
        <svg viewBox="0 0 24 24" fill="#12B7F5"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.99.04-2.85.18-.76 1.22-5.17 1.22-5.17s-.31-.62-.31-1.54c0-1.45.84-2.53 1.88-2.53.89 0 1.32.67 1.32 1.47 0 .89-.57 2.24-.86 3.48-.25 1.04.52 1.88 1.53 1.88 1.83 0 3.24-1.93 3.24-4.71 0-2.46-1.77-4.18-4.29-4.18-2.92 0-4.63 2.19-4.63 4.45 0 .88.34 1.83.76 2.34.08.1.09.19.07.29-.08.32-.25 1.04-.28 1.18-.04.19-.14.23-.33.14-1.25-.58-2.03-2.42-2.03-3.89 0-3.15 2.29-6.05 6.61-6.05 3.47 0 6.16 2.47 6.16 5.77 0 3.44-2.17 6.21-5.18 6.21-1.01 0-1.97-.53-2.3-1.15l-.62 2.33c-.23.87-.84 1.96-1.25 2.62.94.29 1.94.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
        QQ
      </a>
      <a class="social-btn" data-oauth="weibo">
        <svg viewBox="0 0 24 24" fill="#E6162D"><path d="M10.098 20.323c-3.977.413-7.412-1.537-7.695-4.351-.284-2.816 2.691-5.415 6.67-5.829 3.976-.412 7.412 1.538 7.695 4.353.283 2.814-2.692 5.413-6.67 5.827zm7.625-10.36c-.243-.065-.408-.109-.283-.39.277-.619.305-1.155.006-1.538-.573-.726-2.143-.687-3.94.007 0 .001-.565.247-.42-.2.277-.962.236-1.768-.2-2.233-1.004-1.058-3.67.04-5.954 2.46C5.3 9.99 4.2 12.018 4.2 13.81c0 3.426 4.395 5.504 8.698 5.504 5.634 0 9.388-3.271 9.388-5.868 0-1.57-1.325-2.461-2.563-3.483zm-11.35 8.313c-1.8-.443-2.836-2.05-2.31-3.585.52-1.52 2.4-2.44 4.2-2.09 1.844.362 3.01 1.955 2.594 3.51-.418 1.562-2.355 2.598-4.484 2.165zm3.4-1.95c-.547.782-1.614 1.103-2.38.717-.763-.385-.93-1.328-.384-2.104.539-.77 1.596-1.095 2.355-.727.768.376.95 1.308.41 2.114zm.95-1.016c-.207.24-.534.33-.73.204-.2-.127-.22-.408-.016-.652.207-.243.52-.337.726-.21.2.133.22.412.02.658zm.57-.7c-.057.067-.15.09-.2.052-.057-.033-.063-.113-.01-.18.06-.065.153-.09.207-.055.055.037.06.113.003.183z"/></svg>
        微博
      </a>
      <a class="social-btn" data-oauth="twitter">
        <svg viewBox="0 0 24 24" fill="#1DA1F2"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
        Twitter
      </a>
      <a class="social-btn" data-oauth="facebook">
        <svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
    </div>
  </div>
</div>

<!-- ===== Register Page ===== -->
<div id="registerPage" class="auth-wrap" style="display:none;">
  <div class="auth-card">
    <div class="auth-logo">
      <div style="font-size:40px;">&#x270F;&#xFE0F;</div>
      <h1>注册账号</h1>
      <p>Waline On EdgeOne</p>
    </div>
    <div class="auth-field">
      <label>昵称</label>
      <input type="text" id="regName" placeholder="你的昵称" autocomplete="nickname">
    </div>
    <div class="auth-field">
      <label>邮箱</label>
      <input type="email" id="regEmail" placeholder="email@example.com" autocomplete="email">
    </div>
    <div class="auth-field">
      <label>密码</label>
      <input type="password" id="regPassword" placeholder="至少6位" autocomplete="new-password">
    </div>
    <div class="auth-field">
      <label>确认密码</label>
      <input type="password" id="regPasswordConfirm" placeholder="再次输入密码" autocomplete="new-password">
    </div>
    <button class="auth-btn" id="regBtn">注册</button>
    <div class="auth-err" id="regErr"></div>
    <div class="auth-links" style="justify-content:center;">
      <a id="toLoginFromRegLink">已有账号？去登录</a>
    </div>
  </div>
</div>

<!-- ===== Forgot Password Page ===== -->
<div id="forgotPage" class="auth-wrap" style="display:none;">
  <div class="auth-card">
    <div class="auth-logo">
      <div style="font-size:40px;">&#x1F511;</div>
      <h1>找回密码</h1>
      <p>管理员可直接在用户管理页重置密码</p>
    </div>
    <div style="background:var(--pe-accent-bg);border-radius:var(--pe-radius-sm);padding:16px;font-size:13px;color:var(--pe-text-secondary);line-height:1.7;">
      如果你是 <strong>管理员</strong>：登录后前往 <strong>用户管理</strong>，点击对应用户的「重置密码」按钮。<br><br>
      如果你忘记了管理员密码：请联系服务器管理员在 KV 存储中直接修改，或重新注册（首个注册用户自动成为管理员）。
    </div>
    <div style="margin-top:20px;">
      <button class="auth-btn" id="forgotBackBtn">返回登录</button>
    </div>
  </div>
</div>

<!-- ===== Admin Layout ===== -->
<div id="adminLayout" class="admin-layout" style="display:none;">
  <aside class="admin-sidebar" id="adminSidebar">
    <div class="sidebar-logo">
      <h2>&#x1F4AC; Waline 管理</h2>
      <p>Waline On EdgeOne</p>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-group-label" id="navGroupAdmin">内容管理</div>
      <a class="nav-item" data-page="users" id="navUsers">
        <i class="layui-icon layui-icon-username"></i> 用户管理
      </a>
      <a class="nav-item" data-page="comments" id="navComments">
        <i class="layui-icon layui-icon-chat"></i> 评论管理
      </a>
      <a class="nav-item" data-page="db" id="navDb">
        <i class="layui-icon layui-icon-transfer"></i> 数据管理
      </a>
      <div class="nav-group-label" style="margin-top:8px;">个人</div>
      <a class="nav-item" data-page="profile" id="navProfile">
        <i class="layui-icon layui-icon-user"></i> 个人资料
      </a>
      <div class="nav-group-label" style="margin-top:8px;" id="navGroupSystem">系统</div>
      <a class="nav-item" href="/ui/worker-setting" target="_self" id="navWorkerSetting">
        <i class="layui-icon layui-icon-set"></i> 评论系统设置
      </a>
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-user" id="sidebarUserArea">
        <img id="sidebarAvatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%236366F1'/%3E%3C/svg%3E" alt="avatar">
        <div class="sidebar-user-info">
          <div class="name" id="sidebarName">加载中...</div>
          <div class="role" id="sidebarRole">-</div>
        </div>
      </div>
      <button class="logout-btn" id="logoutBtn">
        <i class="layui-icon layui-icon-logout"></i> 退出登录
      </button>
    </div>
  </aside>
  <main class="admin-content" id="adminContent">
    <div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>
  </main>
</div>

<!-- 兼容旧版 @waline/admin /ui/profile?token=... 跳转拦截 -->
<script>
(function(){
  var t = `;

const STATIC_MID = `;
  var oe = `;

const STATIC_TAIL = `;
  if (t) {
    try {
      localStorage.setItem('TOKEN', t);
      document.cookie = 'TOKEN=' + encodeURIComponent(t) + ';path=/;max-age=2592000;SameSite=Lax;Secure';
    } catch(e) {}
    location.replace('/ui');
    return;
  }
  if (oe) { window.__oauthError = oe; }
})();
</script>
<script>
(function(){
  'use strict';
  var API = location.origin;

  /* ---------- token 恢复 ---------- */
  function cookieToken() {
    var m = document.cookie.match(/(?:^|;\\s*)TOKEN=([^;]+)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch(e) { return m[1]; }
  }
  var token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
  // 只有在非退出状态下才从 Cookie 恢复
  if (!token && !sessionStorage.getItem('LOGGED_OUT')) {
    token = cookieToken();
    if (token) {
      try { localStorage.setItem('TOKEN', token); } catch(e) {}
    }
  }
  var currentUser = null;
  var login2faMode = false;

  /* ---------- API helper ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + '/api' + path, Object.assign({}, opts, { headers: headers }))
      .then(function(r) {
        return r.text().then(function(txt) {
          try { return JSON.parse(txt); }
          catch(e) { return { errno: 1, errmsg: '服务器返回非 JSON 响应' }; }
        });
      });
  }

  /* ---------- toast ---------- */
  function toast(msg, ok) {
    var el = document.createElement('div');
    el.className = 'pe-toast ' + (ok !== false ? 'pe-toast-ok' : 'pe-toast-err');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0'; el.style.transition = 'opacity .3s';
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  }

  /* ---------- XSS escape ---------- */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* ---------- 页面加载遮罩 ---------- */
  function hidePageLoading() {
    var pl = document.getElementById('pageLoading');
    if (!pl) return;
    pl.style.opacity = '0';
    setTimeout(function() { pl.style.display = 'none'; }, 400);
  }

  /* ---------- 页面切换 ---------- */
  function showPage(name) {
    ['loginPage','registerPage','forgotPage','adminLayout'].forEach(function(id) {
      document.getElementById(id).style.display = 'none';
    });
    if (name === 'login') {
      document.getElementById('loginPage').style.display = 'flex';
      setTimeout(function(){ document.getElementById('loginEmail').focus(); }, 80);
    } else if (name === 'register') {
      document.getElementById('registerPage').style.display = 'flex';
      setTimeout(function(){ document.getElementById('regName').focus(); }, 80);
    } else if (name === 'forgot') {
      document.getElementById('forgotPage').style.display = 'flex';
    } else if (name === 'admin') {
      document.getElementById('adminLayout').style.display = 'flex';
    }
  }

  /* ---------- 通用模态框关闭 ---------- */
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('pe-modal-cancel')) {
      var mask = t.closest('.pe-modal-mask'); if (mask) mask.remove(); return;
    }
    if (t && t.classList && t.classList.contains('pe-modal-mask')) { t.remove(); }
  });

  function showModal(html) {
    var mask = document.createElement('div');
    mask.className = 'pe-modal-mask';
    mask.innerHTML = html;
    document.body.appendChild(mask);
    return mask;
  }

  /* ---------- OAuth 跳转 ---------- */
  function oauthGo(type, bindToken) {
    var redirect = encodeURIComponent('/ui');
    var state = encodeURIComponent(bindToken || '');
    location.href = '/api/oauth?type=' + type + '&redirect=' + redirect + (state ? '&state=' + state : '');
  }

  /* ---------- Popup 检测（@waline/client 登录弹窗） ---------- */
  // 仅当 URL 路径为 /ui/login（Waline 客户端打开的登录弹窗）时才视作 popup。
  // 注意：用户从博客点击头像跳转 /ui/profile?token=... 时也有 window.opener，但不应被关闭。
  function isPopup() {
    try {
      if (!window.opener || window.opener.closed) return false;
      return /^\\/ui\\/login\\/?$/.test(location.pathname);
    } catch(e) { return false; }
  }
  function sendPopupResult(data) {
    try { window.opener.postMessage({ type: 'userInfo', data: data }, '*'); } catch(e) {}
    window.close();
  }

  /* ============ INIT ============ */
  function init() {
    if (window.__oauthError) {
      var errMap = {
        oauth_failed: 'OAuth 授权失败，请重试',
        oauth_no_id: '无法获取社交账号 ID',
        social_already_linked: '该社交账号已绑定其他用户',
        oauth_create_failed: '创建账号失败',
        account_banned: '账号已被封禁',
        server_error: '服务器错误',
        oauth_error: 'OAuth 授权过程出错'
      };
      setTimeout(function(){ toast(errMap[window.__oauthError] || ('OAuth 错误: ' + window.__oauthError), false); }, 600);
    }
    if (!token) { hidePageLoading(); showPage('login'); return; }
    api('/token').then(function(d) {
      hidePageLoading();
      if (d.errno === 0 && d.data) {
        currentUser = d.data;
        // 如果是 Waline 客户端的登录弹窗，发送 postMessage 并关闭
        // @waline/client 要求 data 中必须包含 token 字段，GET /api/token 不返回 token，需手动注入
        if (isPopup()) { d.data.token = token; sendPopupResult(d.data); return; }
        showPage('admin');
        updateSidebar();
        navTo(currentUser.type === 'administrator' ? 'users' : 'profile');
      } else {
        token = null; localStorage.removeItem('TOKEN');
        document.cookie = 'TOKEN=;path=/;max-age=0';
        showPage('login');
      }
    }).catch(function() { hidePageLoading(); showPage('login'); });
  }

  /* ---------- 侧边栏更新 ---------- */
  function updateSidebar() {
    if (!currentUser) return;
    document.getElementById('sidebarName').textContent = currentUser.display_name || currentUser.email || '用户';
    document.getElementById('sidebarRole').textContent = currentUser.type === 'administrator' ? '管理员' : '普通用户';
    if (currentUser.avatar) document.getElementById('sidebarAvatar').src = currentUser.avatar;
    var isAdmin = currentUser.type === 'administrator';
    document.getElementById('navGroupAdmin').style.display = isAdmin ? '' : 'none';
    document.getElementById('navUsers').style.display = isAdmin ? '' : 'none';
    document.getElementById('navComments').style.display = isAdmin ? '' : 'none';
    document.getElementById('navDb').style.display = isAdmin ? '' : 'none';
    document.getElementById('navGroupSystem').style.display = isAdmin ? '' : 'none';
    document.getElementById('navWorkerSetting').style.display = isAdmin ? '' : 'none';
  }

  /* ============ LOGIN ============ */
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('loginEmail').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('loginPassword').focus(); });
  document.getElementById('login2faCode').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('toRegisterLink').addEventListener('click', function(){ showPage('register'); });
  document.getElementById('toForgotLink').addEventListener('click', function(){ showPage('forgot'); });

  /* social buttons on login page */
  document.querySelectorAll('#loginPage .social-btn[data-oauth]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.preventDefault(); oauthGo(btn.dataset.oauth, ''); });
  });

  function doLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var pwd   = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginErr');
    var btn   = document.getElementById('loginBtn');
    if (!email || !pwd) { errEl.textContent = '请填写邮箱和密码'; return; }
    var body = { email: email, password: pwd };
    if (login2faMode) {
      var code = document.getElementById('login2faCode').value.trim();
      if (!code) { errEl.textContent = '请输入两步验证码'; return; }
      body.code = code;
    }
    btn.disabled = true; btn.textContent = '登录中...'; errEl.textContent = '';
    api('/token', { method: 'POST', body: JSON.stringify(body) }).then(function(d) {
      if (d.errno === 0 && d.data && d.data.token) {
        token = d.data.token;
        sessionStorage.removeItem('LOGGED_OUT');
        localStorage.setItem('TOKEN', token);
        document.cookie = 'TOKEN=' + encodeURIComponent(token) + ';path=/;max-age=2592000;SameSite=Lax;Secure';
        currentUser = d.data;
        // 如果是 Waline 客户端的登录弹窗，发送 postMessage 并关闭
        if (isPopup()) { sendPopupResult(d.data); return; }
        showPage('admin'); updateSidebar();
        navTo(currentUser.type === 'administrator' ? 'users' : 'profile');
      } else if (d.data && d.data['2fa']) {
        login2faMode = true;
        document.getElementById('login2faWrap').style.display = '';
        document.getElementById('login2faCode').focus();
        errEl.textContent = '请输入验证器 App 中的 6 位验证码';
        btn.disabled = false; btn.textContent = '验证并登录';
      } else {
        errEl.textContent = d.errmsg || '登录失败，请检查邮箱和密码';
        btn.disabled = false; btn.textContent = '登录';
      }
    }).catch(function() {
      errEl.textContent = '网络错误，请重试';
      btn.disabled = false; btn.textContent = '登录';
    });
  }

  /* ============ REGISTER ============ */
  document.getElementById('regBtn').addEventListener('click', doRegister);
  document.getElementById('toLoginFromRegLink').addEventListener('click', function(){ showPage('login'); });
  document.getElementById('regPasswordConfirm').addEventListener('keydown', function(e){ if(e.key==='Enter') doRegister(); });

  function doRegister() {
    var name    = document.getElementById('regName').value.trim();
    var email   = document.getElementById('regEmail').value.trim();
    var pwd     = document.getElementById('regPassword').value;
    var confirm = document.getElementById('regPasswordConfirm').value;
    var errEl   = document.getElementById('regErr');
    var btn     = document.getElementById('regBtn');
    if (!email)          { errEl.textContent = '请填写邮箱'; return; }
    if (pwd.length < 6)  { errEl.textContent = '密码至少 6 位'; return; }
    if (pwd !== confirm) { errEl.textContent = '两次密码不一致'; return; }
    btn.disabled = true; btn.textContent = '注册中...'; errEl.textContent = '';
    api('/user', { method: 'POST', body: JSON.stringify({ display_name: name, email: email, password: pwd }) })
      .then(function(d) {
        if (d.errno === 0) {
          toast('注册成功，请登录');
          showPage('login');
          document.getElementById('loginEmail').value = email;
          document.getElementById('loginPassword').focus();
        } else {
          errEl.textContent = d.errmsg || '注册失败';
          btn.disabled = false; btn.textContent = '注册';
        }
      }).catch(function() {
        errEl.textContent = '网络错误，请重试';
        btn.disabled = false; btn.textContent = '注册';
      });
  }

  /* ============ FORGOT ============ */
  document.getElementById('forgotBackBtn').addEventListener('click', function(){ showPage('login'); });

  /* ============ ADMIN LAYOUT ============ */
  document.getElementById('sidebarUserArea').addEventListener('click', function(){ navTo('profile'); });
  document.getElementById('logoutBtn').addEventListener('click', function() {
    // 调用服务端注销 token
    var logoutToken = token;
    if (logoutToken) {
      fetch(API + '/api/token', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + logoutToken }
      }).catch(function(){});
    }
    // 清除所有存储
    localStorage.removeItem('TOKEN');
    sessionStorage.removeItem('TOKEN');
    // 更可靠的 Cookie 删除
    document.cookie = 'TOKEN=;path=/;max-age=0;SameSite=Lax;Secure';
    document.cookie = 'TOKEN=;path=/;max-age=0';
    document.cookie = 'TOKEN=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // 设置退出标记，防止从 Cookie 恢复
    sessionStorage.setItem('LOGGED_OUT', '1');
    token = null; currentUser = null; login2faMode = false;
    showPage('login');
  });

  /* Sidebar nav item click handlers */
  document.querySelectorAll('.nav-item[data-page]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      navTo(el.dataset.page);
    });
  });

  function navTo(page) {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(el){ el.classList.remove('active'); });
    var active = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (active) active.classList.add('active');
    if (page === 'users')    loadUsersPage();
    else if (page === 'comments') loadCommentsPage();
    else if (page === 'profile')  loadProfilePage();
    else if (page === 'db')       loadDbPage();
  }

  /* ============ USERS PAGE ============ */
  var usersPage = 1, usersPageSize = 15;

  function loadUsersPage(page) {
    usersPage = page || 1;
    var c = document.getElementById('adminContent');
    c.innerHTML = '<div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>';
    api('/user?page=' + usersPage + '&pageSize=' + usersPageSize).then(function(d) {
      if (d.errno !== 0) { c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">' + esc(d.errmsg||'加载失败') + '</div>'; return; }
      var data = d.data || {}, users = data.data || [], totalPages = data.totalPages || 1;
      var html = '<div class="content-header"><h2>用户管理</h2><p>第 ' + usersPage + ' / ' + totalPages + ' 页，本页 ' + users.length + ' 名用户</p></div>';
      html += '<div class="pe-card"><div style="overflow-x:auto;"><table class="pe-table"><thead><tr>';
      html += '<th>用户</th><th>邮箱</th><th>角色</th><th>注册时间</th><th class="actions">操作</th></tr></thead><tbody>';
      if (!users.length) {
        html += '<tr><td colspan="5" style="text-align:center;color:var(--pe-text-muted);padding:32px;">暂无用户数据</td></tr>';
      } else {
        users.forEach(function(u) {
          var isBanned  = u.type === 'banned';
          var isAdmin   = u.type === 'administrator';
          var roleClass = isAdmin ? 'badge-admin' : (isBanned ? 'badge-banned' : 'badge-guest');
          var roleLabel = isAdmin ? '管理员' : (isBanned ? '已封禁' : '普通用户');
          var avatar    = u.avatar || 'https://cravatar.cn/avatar/?d=mp&s=40';
          var createdAt = u.createdAt ? u.createdAt.replace('T',' ').replace('Z','').substring(0,16) : '-';
          html += '<tr>';
          html += '<td><div style="display:flex;align-items:center;gap:8px;"><img src="' + esc(avatar) + '" width="32" height="32" style="border-radius:50%;object-fit:cover;" data-fb="https://cravatar.cn/avatar/?d=mp"><span style="font-weight:600;">' + esc(u.display_name||'-') + '</span></div></td>';
          html += '<td style="color:var(--pe-text-secondary);">' + esc(u.email||'-') + '</td>';
          html += '<td><span class="badge ' + roleClass + '">' + roleLabel + '</span></td>';
          html += '<td style="color:var(--pe-text-muted);font-size:12px;">' + createdAt + '</td>';
          html += '<td class="actions">';
          if (!isAdmin) html += '<button class="pe-btn pe-btn-primary user-action" data-action="role" data-id="' + esc(u.objectId) + '" data-name="' + esc(u.display_name) + '" data-type="' + esc(u.type) + '">设角色</button>';
          html += '<button class="pe-btn pe-btn-warning user-action" data-action="resetpwd" data-id="' + esc(u.objectId) + '" data-name="' + esc(u.display_name) + '">重置密码</button>';
          if (!isBanned && !isAdmin) html += '<button class="pe-btn pe-btn-default user-action" data-action="ban" data-id="' + esc(u.objectId) + '" data-name="' + esc(u.display_name) + '">封禁</button>';
          if (isBanned)              html += '<button class="pe-btn pe-btn-success user-action" data-action="unban" data-id="' + esc(u.objectId) + '" data-name="' + esc(u.display_name) + '">解封</button>';
          html += '<button class="pe-btn pe-btn-danger user-action" data-action="delete" data-id="' + esc(u.objectId) + '" data-name="' + esc(u.display_name) + '">删除</button>';
          html += '</td></tr>';
        });
      }
      html += '</tbody></table></div>';
      if (totalPages > 1) {
        html += '<div class="pe-pagination">';
        for (var p = 1; p <= Math.min(totalPages,20); p++)
          html += '<button class="pe-page-btn' + (p===usersPage?' active':'') + '" data-page="' + p + '">' + p + '</button>';
        if (totalPages > 20) html += '<span style="padding:5px 8px;color:var(--pe-text-muted);">...</span>';
        html += '</div>';
      }
      html += '</div>';
      c.innerHTML = html;
      if (c._userClickHandler) c.removeEventListener('click', c._userClickHandler);
      c._userClickHandler = function(e) {
        var btn = e.target.closest('.user-action');
        if (btn) {
          var action=btn.dataset.action, id=btn.dataset.id, name=btn.dataset.name;
          if (action==='role')     showSetRoleModal(id, name, btn.dataset.type);
          else if (action==='resetpwd') showResetPwdModal(id, name);
          else if (action==='ban')      banUser(id, name, true);
          else if (action==='unban')    banUser(id, name, false);
          else if (action==='delete')   deleteUser(id, name);
          return;
        }
        var pageBtn = e.target.closest('.pe-page-btn[data-page]');
        if (pageBtn && c.querySelector('.user-action')) loadUsersPage(parseInt(pageBtn.dataset.page));
      };
      c.addEventListener('click', c._userClickHandler);
      c.querySelectorAll('img[data-fb]').forEach(function(img){
        img.addEventListener('error', function(){ this.src = this.dataset.fb; });
      });
    }).catch(function(){ c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">加载失败，请刷新重试</div>'; });
  }

  function showSetRoleModal(id, name, currentType) {
    var mask = showModal(
      '<div class="pe-modal"><h3>修改角色：' + esc(name) + '</h3>' +
      '<div class="field"><label>角色</label><select id="roleSelect">' +
      '<option value="administrator"' + (currentType==='administrator'?' selected':'') + '>管理员</option>' +
      '<option value="guest"' + (currentType!=='administrator'?' selected':'') + '>普通用户</option>' +
      '</select></div>' +
      '<div class="pe-modal-footer"><button class="pe-btn pe-btn-default pe-modal-cancel">取消</button><button class="pe-btn pe-btn-primary" id="doSetRoleBtn">确认</button></div></div>'
    );
    mask.querySelector('#doSetRoleBtn').addEventListener('click', function() {
      var type = mask.querySelector('#roleSelect').value;
      api('/user/' + id, { method: 'PUT', body: JSON.stringify({ type: type }) }).then(function(d) {
        if (d.errno === 0) { toast('角色已更新'); mask.remove(); loadUsersPage(usersPage); }
        else toast(d.errmsg||'操作失败', false);
      }).catch(function(){ toast('请求失败', false); });
    });
  }

  function showResetPwdModal(id, name) {
    var mask = showModal(
      '<div class="pe-modal"><h3>重置密码：' + esc(name) + '</h3>' +
      '<div class="field"><label>新密码</label><input type="password" id="newPwdInput" placeholder="输入新密码（至少6位）"></div>' +
      '<div class="field"><label>确认密码</label><input type="password" id="newPwdConfirm" placeholder="再次输入新密码"></div>' +
      '<div class="pe-modal-footer"><button class="pe-btn pe-btn-default pe-modal-cancel">取消</button><button class="pe-btn pe-btn-primary" id="doResetPwdBtn">确认重置</button></div></div>'
    );
    mask.querySelector('#doResetPwdBtn').addEventListener('click', function() {
      var pwd = mask.querySelector('#newPwdInput').value, cfm = mask.querySelector('#newPwdConfirm').value;
      if (!pwd || pwd.length < 6) { toast('密码至少 6 位', false); return; }
      if (pwd !== cfm) { toast('两次密码不一致', false); return; }
      api('/user/' + id, { method: 'PUT', body: JSON.stringify({ password: pwd }) }).then(function(d) {
        if (d.errno === 0) { toast('密码已重置'); mask.remove(); }
        else toast(d.errmsg||'操作失败', false);
      }).catch(function(){ toast('请求失败', false); });
    });
  }

  function banUser(id, name, ban) {
    if (!confirm((ban ? '确定封禁' : '解除封禁') + '用户「' + name + '」？')) return;
    api('/user/' + id, { method: 'PUT', body: JSON.stringify({ type: ban ? 'banned' : 'guest' }) }).then(function(d) {
      if (d.errno === 0) { toast(ban ? '已封禁' : '已解封'); loadUsersPage(usersPage); }
      else toast(d.errmsg||'操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  }

  function deleteUser(id, name) {
    if (!confirm('确定删除用户「' + name + '」？此操作不可撤销！')) return;
    api('/user/' + id, { method: 'DELETE' }).then(function(d) {
      if (d.errno === 0) { toast('用户已删除'); loadUsersPage(usersPage); }
      else toast(d.errmsg||'操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  }

  /* ============ COMMENTS PAGE ============ */
  var cmtPage = 1, cmtPageSize = 15, cmtStatus = '', cmtKeyword = '';

  function loadCommentsPage(page) {
    cmtPage = page || 1;
    var c = document.getElementById('adminContent');
    c.innerHTML = '<div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>';
    var qs = '?type=list&page=' + cmtPage + '&pageSize=' + cmtPageSize;
    if (cmtStatus)  qs += '&status='  + encodeURIComponent(cmtStatus);
    if (cmtKeyword) qs += '&keyword=' + encodeURIComponent(cmtKeyword);
    api('/comment' + qs).then(function(d) {
      if (d.errno !== 0) { c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">' + esc(d.errmsg||'加载失败') + '</div>'; return; }
      var data = d.data || {}, comments = data.data || [], totalPages = data.totalPages || 1;
      var html = '<div class="content-header"><h2>评论管理</h2><p>共 ' + (data.count||comments.length) + ' 条评论</p></div>';
      html += '<div class="pe-card"><div class="search-bar">';
      html += '<select id="cmtStatusFilter"><option value="">全部状态</option><option value="approved"' + (cmtStatus==='approved'?' selected':'') + '>已通过</option><option value="waiting"' + (cmtStatus==='waiting'?' selected':'') + '>待审核</option><option value="spam"' + (cmtStatus==='spam'?' selected':'') + '>垃圾</option></select>';
      html += '<input id="cmtKeywordInput" value="' + esc(cmtKeyword) + '" placeholder="搜索评论内容..." style="flex:1;min-width:140px;">';
      html += '<button class="pe-btn pe-btn-primary" id="cmtSearchBtn">搜索</button></div>';
      html += '<div style="overflow-x:auto;"><table class="pe-table"><thead><tr>';
      html += '<th>评论内容</th><th>评论者</th><th>页面</th><th>状态</th><th>时间</th><th class="actions">操作</th></tr></thead><tbody>';
      if (!comments.length) {
        html += '<tr><td colspan="6" style="text-align:center;color:var(--pe-text-muted);padding:32px;">暂无评论数据</td></tr>';
      } else {
        comments.forEach(function(cm) {
          var sc = 'badge-' + (cm.status||'approved');
          var sl = cm.status==='waiting' ? '待审核' : (cm.status==='spam' ? '垃圾' : '已通过');
          var ts = cm.insertedAt ? cm.insertedAt.replace('T',' ').replace('Z','').substring(0,16) : '-';
          var pt = (cm.comment||'').replace(/<[^>]+>/g,'').substring(0,60);
          html += '<tr>';
          html += '<td><div class="comment-text" title="' + esc(pt) + '">' + esc(pt) + '</div></td>';
          html += '<td style="font-size:12px;white-space:nowrap;">' + esc(cm.nick||'匿名') + '</td>';
          html += '<td style="font-size:12px;color:var(--pe-text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(cm.url||'') + '">' + esc(cm.url||'-') + '</td>';
          html += '<td><span class="badge ' + sc + '">' + sl + '</span></td>';
          html += '<td style="font-size:12px;color:var(--pe-text-muted);white-space:nowrap;">' + ts + '</td>';
          html += '<td class="actions">';
          if (cm.status!=='approved') html += '<button class="pe-btn pe-btn-success cmt-action" data-action="status" data-id="' + esc(cm.objectId) + '" data-status="approved">通过</button>';
          if (cm.status!=='waiting')  html += '<button class="pe-btn pe-btn-warning cmt-action" data-action="status" data-id="' + esc(cm.objectId) + '" data-status="waiting">待审</button>';
          if (cm.status!=='spam')     html += '<button class="pe-btn pe-btn-default cmt-action" data-action="status" data-id="' + esc(cm.objectId) + '" data-status="spam">垃圾</button>';
          html += '<button class="pe-btn pe-btn-danger cmt-action" data-action="delete" data-id="' + esc(cm.objectId) + '">删除</button>';
          html += '</td></tr>';
        });
      }
      html += '</tbody></table></div>';
      if (totalPages > 1) {
        html += '<div class="pe-pagination">';
        for (var p = 1; p <= Math.min(totalPages,20); p++)
          html += '<button class="pe-page-btn' + (p===cmtPage?' active':'') + '" data-page="' + p + '">' + p + '</button>';
        if (totalPages > 20) html += '<span style="padding:5px 8px;color:var(--pe-text-muted);">...</span>';
        html += '</div>';
      }
      html += '</div>';
      c.innerHTML = html;
      if (c._cmtClickHandler) c.removeEventListener('click', c._cmtClickHandler);
      c._cmtClickHandler = function(e) {
        var btn = e.target.closest('.cmt-action');
        if (btn) {
          var action=btn.dataset.action, id=btn.dataset.id;
          if (action==='status') setCmtStatus(id, btn.dataset.status);
          else if (action==='delete') deleteCmt(id);
          return;
        }
        var pageBtn = e.target.closest('.pe-page-btn[data-page]');
        if (pageBtn && c.querySelector('.cmt-action')) loadCommentsPage(parseInt(pageBtn.dataset.page));
      };
      c.addEventListener('click', c._cmtClickHandler);
      var sf = c.querySelector('#cmtStatusFilter'), si = c.querySelector('#cmtKeywordInput'), sb = c.querySelector('#cmtSearchBtn');
      if (sf) sf.addEventListener('change', function(){ cmtStatus = this.value; loadCommentsPage(1); });
      if (sb && si) {
        var doSearch = function(){ cmtKeyword = si.value; loadCommentsPage(1); };
        sb.addEventListener('click', doSearch);
        si.addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });
      }
    }).catch(function(){ c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">加载失败，请刷新重试</div>'; });
  }

  function setCmtStatus(id, status) {
    api('/comment/' + id, { method: 'PUT', body: JSON.stringify({ status: status }) }).then(function(d) {
      if (d.errno === 0) { toast('状态已更新'); loadCommentsPage(cmtPage); }
      else toast(d.errmsg||'操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  }

  function deleteCmt(id) {
    if (!confirm('确定删除该评论？')) return;
    api('/comment/' + id, { method: 'DELETE' }).then(function(d) {
      if (d.errno === 0) { toast('评论已删除'); loadCommentsPage(cmtPage); }
      else toast(d.errmsg||'操作失败', false);
    }).catch(function(){ toast('请求失败', false); });
  }

  /* ============ PROFILE PAGE ============ */
  var SOCIALS = [
    { key:'github',   label:'GitHub',   color:'#24292e' },
    { key:'google',   label:'Google',   color:'#EA4335' },
    { key:'qq',       label:'QQ',       color:'#12B7F5' },
    { key:'weibo',    label:'微博',      color:'#E6162D' },
    { key:'twitter',  label:'Twitter',  color:'#1DA1F2' },
    { key:'facebook', label:'Facebook', color:'#1877F2' },
  ];

  function loadProfilePage(forceRefresh) {
    var c = document.getElementById('adminContent');
    if (!forceRefresh && currentUser) {
      renderProfile(c, currentUser);
      return;
    }
    c.innerHTML = '<div class="loading-box"><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i> 加载中...</div>';
    api('/token').then(function(d) {
      if (d.errno !== 0 || !d.data) {
        c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">获取用户信息失败</div>'; return;
      }
      currentUser = d.data;
      renderProfile(c, d.data);
    }).catch(function(){ c.innerHTML = '<div class="loading-box" style="color:var(--pe-danger);">加载失败，请刷新重试</div>'; });
  }
  function renderProfile(c, u) {
      var avatar = u.avatar || 'https://cravatar.cn/avatar/?d=mp&s=80';

      var html = '<div class="content-header"><h2>个人资料</h2><p>管理你的账号信息、安全设置与社交账号绑定</p></div>';

      /* -- 基本信息 -- */
      html += '<div class="pe-card" style="max-width:640px;">';
      html += '<div class="pe-card-title">基本信息</div>';
      html += '<div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">';
      html += '<img id="profileAvatar" src="' + esc(avatar) + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--pe-accent-bg);" data-fb="https://cravatar.cn/avatar/?d=mp">';
      html += '<div><div style="font-size:16px;font-weight:600;">' + esc(u.display_name||'未设置昵称') + '</div>';
      html += '<div style="font-size:13px;color:var(--pe-text-muted);">' + esc(u.email||'') + '</div>';
      html += '<div style="font-size:12px;color:var(--pe-text-muted);margin-top:2px;">ID: ' + esc(String(u.objectId||'')) + '</div></div></div>';

      var fStyle = 'width:100%;padding:8px 12px;border:1px solid var(--pe-border);border-radius:var(--pe-radius-sm);font-size:13px;background:var(--pe-bg-input);outline:none;';
      html += '<div class="field" style="margin-bottom:14px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:var(--pe-text-secondary);">昵称</label>';
      html += '<input type="text" id="profileName" value="' + esc(u.display_name||'') + '" placeholder="输入昵称" style="' + fStyle + '"></div>';
      html += '<div class="field" style="margin-bottom:14px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:var(--pe-text-secondary);">头像 URL</label>';
      html += '<input type="text" id="profileAvatarUrl" value="' + esc(u.avatar||'') + '" placeholder="头像图片地址" style="' + fStyle + '"></div>';
      html += '<div class="field" style="margin-bottom:16px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:var(--pe-text-secondary);">个人网站</label>';
      html += '<input type="text" id="profileUrl" value="' + esc(u.url||'') + '" placeholder="https://example.com" style="' + fStyle + '"></div>';
      html += '<button class="pe-btn pe-btn-primary" id="profileSaveBtn">保存修改</button></div>';

      /* -- 修改密码 -- */
      html += '<div class="pe-card" style="max-width:640px;">';
      html += '<div class="pe-card-title">修改密码</div>';
      html += '<div class="field" style="margin-bottom:14px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:var(--pe-text-secondary);">新密码</label>';
      html += '<input type="password" id="profileNewPwd" placeholder="留空则不修改" style="' + fStyle + 'max-width:360px;"></div>';
      html += '<div class="field" style="margin-bottom:16px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:var(--pe-text-secondary);">确认新密码</label>';
      html += '<input type="password" id="profileNewPwdConfirm" placeholder="再次输入新密码" style="' + fStyle + 'max-width:360px;"></div>';
      html += '<button class="pe-btn pe-btn-warning" id="profileChangePwdBtn">修改密码</button></div>';

      /* -- 社交账号绑定 -- */
      html += '<div class="pe-card" style="max-width:640px;">';
      html += '<div class="pe-card-title">社交账号绑定</div>';
      html += '<p style="font-size:12px;color:var(--pe-text-muted);margin:0 0 12px;">绑定后可使用社交账号直接登录，也可为评论展示社交链接。</p>';
      SOCIALS.forEach(function(s) {
        var boundId = u[s.key] || '';
        var isBound = !!boundId;
        html += '<div class="social-row">';
        html += '<div class="social-icon" style="color:' + s.color + '"><i class="layui-icon layui-icon-link" style="font-size:14px;"></i></div>';
        html += '<span class="social-label">' + esc(s.label) + '</span>';
        html += '<span class="social-bound' + (isBound?' is-bound':'') + '">' + (isBound ? '已绑定：' + esc(boundId) : '未绑定') + '</span>';
        if (isBound) {
          html += '<button class="pe-btn pe-btn-danger" style="padding:4px 10px;font-size:11px;" data-social-unbind="' + s.key + '">解绑</button>';
        } else {
          html += '<button class="pe-btn pe-btn-default" style="padding:4px 10px;font-size:11px;" data-social-bind="' + s.key + '">绑定</button>';
        }
        html += '</div>';
      });
      html += '</div>';

      /* -- 两步验证 -- */
      html += '<div class="pe-card" style="max-width:640px;">';
      html += '<div class="pe-card-title">两步验证（2FA）</div>';
      if (u['2fa']) {
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
        html += '<span style="background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;">已启用</span>';
        html += '<span style="font-size:13px;color:var(--pe-text-secondary);">你的账号已开启两步验证保护</span></div>';
        html += '<button class="pe-btn pe-btn-danger" id="disable2faBtn">关闭两步验证</button>';
      } else {
        html += '<p style="font-size:13px;color:var(--pe-text-secondary);margin:0 0 16px;">使用 Google Authenticator、1Password 等 TOTP 应用扫描二维码，然后输入验证码完成开启。</p>';
        html += '<button class="pe-btn pe-btn-primary" id="setup2faBtn">开启两步验证</button>';
      }
      html += '</div>';

      c.innerHTML = html;

      /* 头像预览 */
      var avatarInput = c.querySelector('#profileAvatarUrl');
      var avatarImg   = c.querySelector('#profileAvatar');
      if (avatarInput) avatarInput.addEventListener('input', function(){ avatarImg.src = this.value || 'https://cravatar.cn/avatar/?d=mp&s=80'; });
      if (avatarImg)   avatarImg.addEventListener('error', function(){ this.src = this.dataset.fb; });

      /* 保存基本信息 */
      c.querySelector('#profileSaveBtn').addEventListener('click', function() {
        var updates = { url: c.querySelector('#profileUrl').value.trim() };
        var n = c.querySelector('#profileName').value.trim();
        var a = c.querySelector('#profileAvatarUrl').value.trim();
        if (n) updates.display_name = n;
        updates.avatar = a;
        api('/user/' + u.objectId, { method: 'PUT', body: JSON.stringify(updates) }).then(function(d) {
          if (d.errno === 0) {
            toast('资料已更新');
            if (updates.display_name) document.getElementById('sidebarName').textContent = updates.display_name;
            if (updates.avatar)       document.getElementById('sidebarAvatar').src = updates.avatar;
            currentUser = Object.assign(currentUser || {}, updates);
          } else toast(d.errmsg||'保存失败', false);
        }).catch(function(){ toast('请求失败', false); });
      });

      /* 修改密码 */
      c.querySelector('#profileChangePwdBtn').addEventListener('click', function() {
        var pwd = c.querySelector('#profileNewPwd').value;
        var cfm = c.querySelector('#profileNewPwdConfirm').value;
        if (!pwd)            { toast('请输入新密码', false); return; }
        if (pwd.length < 6)  { toast('密码至少 6 位', false); return; }
        if (pwd !== cfm)     { toast('两次密码不一致', false); return; }
        api('/user/' + u.objectId, { method: 'PUT', body: JSON.stringify({ password: pwd }) }).then(function(d) {
          if (d.errno === 0) { toast('密码已修改'); c.querySelector('#profileNewPwd').value = ''; c.querySelector('#profileNewPwdConfirm').value = ''; }
          else toast(d.errmsg||'修改失败', false);
        }).catch(function(){ toast('请求失败', false); });
      });

      /* 社交绑定/解绑 + 2FA 事件委托 */
      if (c._profileClickHandler) c.removeEventListener('click', c._profileClickHandler);
      c._profileClickHandler = function(e) {
        /* 绑定 */
        var bindBtn = e.target.closest('[data-social-bind]');
        if (bindBtn) { oauthGo(bindBtn.dataset.socialBind, token || ''); return; }
        /* 解绑 */
        var unbindBtn = e.target.closest('[data-social-unbind]');
        if (unbindBtn) {
          var t2 = unbindBtn.dataset.socialUnbind;
          if (!confirm('确定解绑 ' + t2 + ' 账号？')) return;
          var body = {}; body[t2] = '';
          api('/user/' + u.objectId, { method: 'PUT', body: JSON.stringify(body) }).then(function(d) {
            if (d.errno === 0) { toast('已解绑'); loadProfilePage(true); }
            else toast(d.errmsg||'解绑失败', false);
          }).catch(function(){ toast('请求失败', false); });
          return;
        }
        /* 开启 2FA */
        if (e.target.closest('#setup2faBtn')) { show2faSetup(); return; }
        /* 关闭 2FA */
        if (e.target.closest('#disable2faBtn')) {
          if (!confirm('确定关闭两步验证？关闭后账号安全性将降低。')) return;
          api('/user/' + u.objectId, { method: 'PUT', body: JSON.stringify({ '2fa': '' }) }).then(function(d) {
            if (d.errno === 0) { toast('两步验证已关闭'); loadProfilePage(true); }
            else toast(d.errmsg||'操作失败', false);
          }).catch(function(){ toast('请求失败', false); });
        }
      };
      c.addEventListener('click', c._profileClickHandler);
  }

  /* ============ 2FA SETUP MODAL ============ */
  function show2faSetup() {
    var secret = '';
    var mask = showModal(
      '<div class="pe-modal" style="min-width:360px;">' +
      '<h3>开启两步验证</h3>' +
      '<p style="font-size:13px;color:var(--pe-text-secondary);margin:0 0 12px;">使用 TOTP 应用扫描下方二维码，或手动输入密钥，然后输入6位验证码确认。</p>' +
      '<div class="qr-wrap" id="tfaQrWrap"><div class="loading-box" style="padding:16px;">加载中...</div></div>' +
      '<div class="secret-box" id="tfaSecret" style="display:none;"></div>' +
      '<div class="field" style="margin-top:14px;"><label>验证码</label><input type="text" id="tfaCode" class="twofa-input" maxlength="6" placeholder="6位验证码" inputmode="numeric"></div>' +
      '<div class="pe-modal-footer"><button class="pe-btn pe-btn-default pe-modal-cancel">取消</button><button class="pe-btn pe-btn-primary" id="tfaConfirmBtn">确认开启</button></div>' +
      '</div>'
    );
    api('/token/2fa').then(function(d) {
      if (d.errno !== 0 || !d.data) { mask.querySelector('#tfaQrWrap').innerHTML = '<p style="color:var(--pe-danger);text-align:center;">获取配置失败</p>'; return; }
      secret = d.data.secret;
      var qrUrl = 'https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=' + encodeURIComponent(d.data.otpauth_url) + '&choe=UTF-8';
      mask.querySelector('#tfaQrWrap').innerHTML = '<img src="' + qrUrl + '" width="200" height="200" alt="QR Code"><p style="font-size:12px;color:var(--pe-text-muted);margin:6px 0 0;">扫描二维码或手动输入下方密钥</p>';
      var se = mask.querySelector('#tfaSecret'); se.style.display = ''; se.textContent = secret;
    }).catch(function(){ mask.querySelector('#tfaQrWrap').innerHTML = '<p style="color:var(--pe-danger);text-align:center;">网络错误</p>'; });

    mask.querySelector('#tfaConfirmBtn').addEventListener('click', function() {
      var code = mask.querySelector('#tfaCode').value.trim();
      if (!code || code.length !== 6) { toast('请输入6位验证码', false); return; }
      api('/token/2fa', { method: 'POST', body: JSON.stringify({ secret: secret, code: code }) }).then(function(d) {
        if (d.errno === 0) { toast('两步验证已开启'); mask.remove(); loadProfilePage(true); }
        else toast(d.errmsg||'验证码错误，请重试', false);
      }).catch(function(){ toast('请求失败', false); });
    });
  }

  /* ============ DB PAGE (Import / Export) ============ */
  function loadDbPage() {
    var c = document.getElementById('adminContent');
    c.innerHTML =
      '<div class="content-header"><h2>数据管理</h2><p>导出或导入 Waline 标准格式的数据（Comment / Counter / Users 三张表）</p></div>' +
      '<div class="pe-card">' +
        '<div class="pe-card-title">导出数据</div>' +
        '<p style="font-size:13px;color:var(--pe-text-secondary);margin:0 0 14px;">将当前全部数据打包为 Waline 通用 JSON 格式，可用于备份或迁移到其他 Waline 实例。</p>' +
        '<button class="pe-btn pe-btn-primary" id="exportBtn"><i class="layui-icon layui-icon-download-circle"></i> 导出所有数据</button>' +
        '<span id="exportStatus" style="margin-left:12px;font-size:13px;color:var(--pe-text-muted);"></span>' +
      '</div>' +
      '<div class="pe-card">' +
        '<div class="pe-card-title">导入数据</div>' +
        '<p style="font-size:13px;color:var(--pe-text-secondary);margin:0 0 4px;">选择 Waline 标准格式的 JSON 文件。导入前将<strong style="color:var(--pe-danger);">清空</strong>对应表中的现有数据，请先导出备份。</p>' +
        '<p style="font-size:12px;color:var(--pe-text-muted);margin:0 0 14px;">支持来自 @waline/admin 或本系统导出的 JSON 文件（含 Comment、Counter、Users）。</p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">' +
          '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:7px 14px;border:1px solid var(--pe-border);border-radius:var(--pe-radius-sm);background:var(--pe-bg-input);font-size:13px;" id="fileLabel">' +
            '<i class="layui-icon layui-icon-upload"></i> <span id="fileLabelText">选择 JSON 文件</span>' +
          '</label>' +
          '<input type="file" id="importFile" accept=".json,application/json" style="display:none;">' +
          '<button class="pe-btn pe-btn-warning" id="importBtn" disabled><i class="layui-icon layui-icon-transfer"></i> 开始导入</button>' +
        '</div>' +
        '<div id="importLog" class="import-log" style="display:none;"></div>' +
      '</div>' +
      '<div class="pe-card">' +
        '<div class="pe-card-title">评论性能维护</div>' +
        '<p style="font-size:13px;color:var(--pe-text-secondary);margin:0 0 14px;">从 comment 源数据重建文章评论索引、状态索引、子评论索引和评论缓存版本。导入旧备份后建议执行一次。</p>' +
        '<button class="pe-btn pe-btn-primary" id="rebuildCommentIndexesBtn"><i class="layui-icon layui-icon-refresh"></i> 重建评论索引</button>' +
        '<span id="rebuildCommentIndexesStatus" style="margin-left:12px;font-size:13px;color:var(--pe-text-muted);"></span>' +
      '</div>';

    /* ---- 导出 ---- */
    c.querySelector('#exportBtn').addEventListener('click', function() {
      var btn = this;
      var status = c.querySelector('#exportStatus');
      btn.disabled = true;
      status.textContent = '正在导出...';
      status.style.color = 'var(--pe-text-muted)';
      api('/db').then(function(d) {
        if (d.errno !== 0) { status.textContent = d.errmsg || '导出失败'; status.style.color = 'var(--pe-danger)'; btn.disabled = false; return; }
        var blob = new Blob([JSON.stringify(d.data, null, 2)], { type: 'application/json' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href   = url;
        a.download = 'waline-backup-' + new Date().toISOString().slice(0,10) + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        status.textContent = '导出成功！';
        status.style.color = 'var(--pe-success)';
        btn.disabled = false;
      }).catch(function(e) {
        status.textContent = '请求失败：' + (e.message || '');
        status.style.color = 'var(--pe-danger)';
        btn.disabled = false;
      });
    });

    /* ---- 文件选择 ---- */
    c.querySelector('#rebuildCommentIndexesBtn').addEventListener('click', function() {
      if (!confirm('确认从 comment 源数据重建评论索引？数据量较大时可能需要等待一会儿。')) return;
      var btn = this;
      var status = c.querySelector('#rebuildCommentIndexesStatus');
      btn.disabled = true;
      status.textContent = '正在重建...';
      status.style.color = 'var(--pe-text-muted)';
      api('/db/rebuild-comment-indexes', { method: 'POST' }).then(function(d) {
        if (d.errno !== 0) {
          status.textContent = d.errmsg || '重建失败';
          status.style.color = 'var(--pe-danger)';
        } else {
          status.textContent = d.errmsg || '重建完成';
          status.style.color = 'var(--pe-success)';
        }
        btn.disabled = false;
      }).catch(function(e) {
        status.textContent = '请求失败：' + (e.message || '');
        status.style.color = 'var(--pe-danger)';
        btn.disabled = false;
      });
    });

    var fileInput  = c.querySelector('#importFile');
    var importBtn  = c.querySelector('#importBtn');
    var fileLabelText = c.querySelector('#fileLabelText');
    c.querySelector('#fileLabel').addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        fileLabelText.textContent = this.files[0].name;
        importBtn.disabled = false;
      }
    });

    /* ---- 导入 ---- */
    importBtn.addEventListener('click', function() {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!confirm('导入将清空现有的 Comment、Counter、Users 数据，确定继续？')) return;

      var logEl = c.querySelector('#importLog');
      logEl.style.display = '';
      logEl.innerHTML = '';
      importBtn.disabled = true;

      function log(msg, type) {
        var span = document.createElement('span');
        span.className = type ? 'log-' + type : '';
        span.textContent = msg + '\\n';
        logEl.appendChild(span);
        logEl.scrollTop = logEl.scrollHeight;
      }

      var reader = new FileReader();
      reader.onload = function(ev) {
        var data;
        try { data = JSON.parse(ev.target.result); }
        catch(e) { log('❌ JSON 解析失败：' + e.message, 'err'); importBtn.disabled = false; return; }

        if (!data || !data.data) { log('❌ 不是有效的 Waline 导出格式（缺少 data 字段）', 'err'); importBtn.disabled = false; return; }

        var tables = ['Comment', 'Counter', 'Users'];
        var total = 0, done = 0, fail = 0;
        tables.forEach(function(t) { total += (data.data[t] || []).length; });
        log('📋 文件解析成功。Comment: ' + (data.data.Comment||[]).length + ' 条，Counter: ' + (data.data.Counter||[]).length + ' 条，Users: ' + (data.data.Users||[]).length + ' 条', 'info');

        /* 串行处理：清空 → 逐条插入 */
        function processTable(idx) {
          if (idx >= tables.length) {
            log('\\n导入写入完成，正在重建评论索引...', 'info');
            api('/db/rebuild-comment-indexes', { method: 'POST' }).then(function(r) {
              if (r.errno === 0) {
                log(r.errmsg || '评论索引重建完成', 'ok');
              } else {
                log('评论索引重建失败：' + (r.errmsg || 'unknown'), 'err');
              }
              log('导入完成：成功 ' + done + ' 条，失败 ' + fail + ' 条', fail ? 'err' : 'ok');
              importBtn.disabled = false;
            }).catch(function(e) {
              log('评论索引重建请求失败：' + (e.message || ''), 'err');
              log('导入完成：成功 ' + done + ' 条，失败 ' + fail + ' 条', fail ? 'err' : 'ok');
              importBtn.disabled = false;
            });
            return;
          }
          var t = tables[idx];
          var rows = data.data[t] || [];
          if (!rows.length) { log('[' + t + '] 无数据，跳过', 'info'); processTable(idx + 1); return; }

          log('\\n[' + t + '] 清空旧数据...', 'info');
          api('/db?table=' + t, { method: 'DELETE' }).then(function() {
            log('[' + t + '] 清空完成，开始写入 ' + rows.length + ' 条...', 'info');
            var i = 0;
            function insertNext() {
              if (i >= rows.length) { processTable(idx + 1); return; }
              var row = rows[i++];
              api('/db?table=' + t, { method: 'POST', body: JSON.stringify(row) }).then(function(r) {
                if (r.errno === 0) { done++; } else { fail++; log('[' + t + '] 第 ' + i + ' 条失败：' + (r.errmsg||'unknown'), 'err'); }
                insertNext();
              }).catch(function(e) { fail++; log('[' + t + '] 第 ' + i + ' 条网络错误：' + (e.message||''), 'err'); insertNext(); });
            }
            insertNext();
          }).catch(function(e) {
            log('[' + t + '] 清空失败：' + (e.message||''), 'err');
            processTable(idx + 1);
          });
        }
        processTable(0);
      };
      reader.onerror = function() { log('❌ 文件读取失败', 'err'); importBtn.disabled = false; };
      reader.readAsText(file);
    });
  }

  /* ============ START ============ */
  init();
  // Safety timeout: if init hasn't hidden the page loading after 15s, force hide it
  setTimeout(function() {
    var pl = document.getElementById('pageLoading');
    if (pl && pl.style.display !== 'none') {
      hidePageLoading();
      if (!currentUser) showPage('login');
    }
  }, 15000);
})();
</script>
</body>
</html>`;

function safeStringify(s: string): string {
  return JSON.stringify(s).replace(/<\//g, '<\\/');
}

export async function getAdminPage(env: Env, requestUrl: string): Promise<string> {
  const url = new URL(requestUrl);
  const urlToken = url.searchParams.get('token') || '';
  const oauthError = url.searchParams.get('error') || '';
  return STATIC_HEAD + safeStringify(urlToken) + STATIC_MID + safeStringify(oauthError) + STATIC_TAIL;
}

/** Fingerprint for ETag — only valid when no dynamic params */
export const ADMIN_ETAG = `"admin-${STATIC_HEAD.length + STATIC_MID.length + STATIC_TAIL.length}"`;
