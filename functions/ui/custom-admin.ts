/**
 * EdgeOne Settings Page - Typecho-style admin page for non-standard Waline features
 * Served at /ui/worker-setting, server-side auth-gated (only admins see this page)
 */

/**
 * Returns a genuine-looking 404 page for non-admin visitors
 */
export function get404Page(): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>404 Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;margin-top:120px;color:#656d76">
<h1 style="font-size:48px;margin-bottom:8px">404</h1><p>Not Found</p>
</body>
</html>`;
}

/**
 * Returns the full Typecho-styled settings page (only served to authenticated admins)
 */
export function getCustomSettingsPage(requestUrl: string): string {
  const url = new URL(requestUrl);
  const apiBase = url.origin;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>EdgeOne Settings - Waline Management</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
/* Typecho admin theme */
*{box-sizing:border-box}
body{margin:0;font:87.5%/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f6f6f3;color:#444}
a{color:#467b96;text-decoration:none}a:hover{color:#499bc3}

/* Navigation */
.typecho-head-nav{padding:0 10px;background:#292d33;height:36px;line-height:36px}
.typecho-head-nav .inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.typecho-head-nav .nav-links{display:flex;align-items:center;gap:0}
.typecho-head-nav a{color:#bbb;padding:0 20px;display:inline-block;height:36px;line-height:36px;font-size:13px}
.typecho-head-nav a:hover,.typecho-head-nav a.focus{color:#fff;background:#202328;text-decoration:none}
.typecho-head-nav .nav-sep{border-right:1px solid #383d45}
.typecho-head-nav .operate{margin-left:auto}

/* Page title */
.typecho-page-title{max-width:960px;margin:30px auto 0;padding:0 10px}
.typecho-page-title h2{font-size:1.28571em;margin:0 0 10px;font-weight:400}

/* Content */
.container{max-width:960px;margin:20px auto;padding:0 10px}

/* Options/form */
.typecho-option-tabs{list-style:none;margin:0 0 -1px;padding:0;display:flex;border-bottom:1px solid #d9d9d6}
.typecho-option-tabs li{margin:0}
.typecho-option-tabs li a{display:block;padding:8px 20px;color:#444;border:1px solid transparent;border-bottom:none;margin-bottom:-1px;font-size:13px}
.typecho-option-tabs li.active a{background:#fff;border-color:#d9d9d6;border-bottom-color:#fff;font-weight:bold}
.typecho-option-tabs li a:hover{color:#467b96;text-decoration:none}

.typecho-table-wrap{padding:30px;background:#fff;border:1px solid #d9d9d6;border-top:none}

.typecho-option{margin-bottom:20px}
.typecho-option .typecho-label{display:block;margin-bottom:.5em;font-weight:bold;font-size:13px}
.typecho-option .description{margin:.5em 0 0;color:#999;font-size:12px}

input[type="text"],input[type="password"],input[type="url"],input[type="number"],textarea,select{
  background:#fff;border:1px solid #d9d9d6;padding:7px;border-radius:2px;font-size:13px;font-family:inherit;outline:none;
}
input[type="text"]:focus,input[type="password"]:focus,input[type="url"]:focus,input[type="number"]:focus,textarea:focus,select:focus{
  border-color:#467b96;box-shadow:0 0 0 2px rgba(70,123,150,.15);
}
input[type="text"],input[type="password"],input[type="url"],input[type="number"]{width:100%;max-width:480px}
textarea{width:100%;max-width:480px;resize:vertical;min-height:80px;line-height:1.5}
select{height:32px;min-width:200px}

/* Version picker */
.version-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.version-row input{flex:1;max-width:320px}
.version-row select{flex:0 0 auto;max-width:200px}
.version-row .btn{flex:0 0 auto}

/* Toggle */
.toggle-row{display:flex;align-items:center;gap:10px}
.toggle{position:relative;display:inline-block;width:40px;height:22px;vertical-align:middle}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:22px;transition:.2s}
.toggle-slider:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
.toggle input:checked+.toggle-slider{background:#467b96}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px)}
.toggle-label{font-size:13px;color:#666}

/* Buttons */
.btn{border:none;background:#e9e9e6;cursor:pointer;border-radius:2px;display:inline-block;padding:0 12px;height:32px;color:#666;font-size:13px;vertical-align:middle;line-height:32px}
.btn:hover{background:#dbdbd6;transition:.2s}
.primary{background:#467b96;color:#fff}
.primary:hover{background:#3c6a81}
.btn-warn{background:#b94a48;color:#fff}
.btn-warn:hover{background:#a4403f}
.btn-xs{padding:0 10px;height:25px;font-size:12px;line-height:25px}
.actions{margin-top:20px;display:flex;gap:8px}

/* Toast */
.toast{position:fixed;top:16px;right:16px;padding:10px 16px;border-radius:2px;font-size:13px;z-index:100;animation:fadeIn .2s}
.toast-ok{background:#e6efc2;color:#264409}.toast-err{background:#fbe3e4;color:#8a1f11}
@keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}

/* Loading spinner */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid #ccc;border-top-color:#467b96;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-left:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<!-- Navigation -->
<div class="typecho-head-nav">
  <div class="inner">
    <div class="nav-links">
      <span style="color:#fff;font-size:13px;padding:0 20px">Waline On EdgeOne 设置</span>
    </div>
    <div class="operate">
      <a href="/ui">← 返回管理面板</a>
    </div>
  </div>
</div>

<!-- Content -->
<div class="container">
  <!-- Tab bar -->
  <ul class="typecho-option-tabs" id="tabs">
    <li class="active"><a href="#" data-tab="frontend">前端版本</a></li>
    <li><a href="#" data-tab="basic">基础设置</a></li>
    <li><a href="#" data-tab="comment">评论策略</a></li>
    <li><a href="#" data-tab="email">邮件通知</a></li>
    <li><a href="#" data-tab="pushplus">PushPlus</a></li>
  </ul>

  <!-- Tab: Frontend Version -->
  <div class="typecho-table-wrap tab-panel" id="tab-frontend">
    <div class="typecho-option">
      <label class="typecho-label">@waline/client CDN 版本</label>
      <div class="version-row">
        <input type="text" id="set-version" placeholder="v3" />
        <select id="version-select">
          <option value="">选择版本…</option>
          <option value="latest">latest</option>
        </select>
        <button class="btn btn-xs" id="refresh-versions" title="刷新版本列表">↻ 刷新</button>
      </div>
      <p class="description">从 unpkg CDN 加载的 @waline/client 版本。可输入版本号（如 <code>v3</code>、<code>3.3.2</code>）或从下拉菜单选择。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">Worker 信息显示</label>
      <select id="set-worker-display">
        <option value="always">始终显示</option>
        <option value="admin" selected>仅管理员登录</option>
        <option value="disabled">禁用</option>
      </select>
      <p class="description">控制 Waline on EdgeOne 标识在页面和控制台中的可见性。「始终」对所有人可见，「仅管理员」仅管理员登录后可见，「禁用」完全隐藏。</p>
    </div>
  </div>

  <!-- Tab: Basic Settings -->
  <div class="typecho-table-wrap tab-panel" id="tab-basic" style="display:none">
    <div class="typecho-option">
      <label class="typecho-label">站点名称</label>
      <input type="text" id="set-site-name" placeholder="我的博客" />
      <p class="description">用于邮件、RSS 和通知消息中的网站名称。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">站点地址</label>
      <input type="url" id="set-site-url" placeholder="https://example.com" />
      <p class="description">网站完整地址，用于邮件和 RSS 链接。需以 https:// 开头。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">博主邮箱</label>
      <input type="text" id="set-author-email" placeholder="admin@example.com" />
      <p class="description">博主邮箱地址。新评论通知会发送到此邮箱；评论者邮箱与此相同时会标记为「博主」。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">评论间隔限制（秒）</label>
      <input type="number" id="set-ipqps" placeholder="60" />
      <p class="description">同一 IP 发表评论的最小间隔秒数，填 0 表示不限制。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">强制评论审核</label>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="set-comment-audit" />
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">开启后所有匿名评论默认进入待审核状态</span>
      </div>
      <p class="description">此开关开启时，匿名评论默认状态为 waiting。已登录用户不受此影响（由「评论策略」tab 控制）。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">Akismet API Key</label>
      <input type="text" id="set-akismet-key" placeholder="可选，用于垃圾评论检测" />
      <p class="description">填写后启用 Akismet 反垃圾评论检测。留空则不启用。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">禁用地区解析</label>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="set-disable-region" />
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">关闭评论中的地区信息展示</span>
      </div>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">禁用 UA 解析</label>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="set-disable-useragent" />
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">关闭评论中的浏览器/操作系统信息展示</span>
      </div>
    </div>
  </div>

  <!-- Tab: Comment Policy -->
  <div class="typecho-table-wrap tab-panel" id="tab-comment" style="display:none">
    <h4 style="margin:0 0 16px;font-size:14px;color:#444;border-bottom:1px solid #eee;padding-bottom:8px">默认状态</h4>
    <div class="typecho-option">
      <label class="typecho-label">匿名评论默认状态</label>
      <select id="set-comment-status">
        <option value="approved">直接通过 (approved)</option>
        <option value="waiting">等待审核 (waiting)</option>
      </select>
      <p class="description">未登录用户发表评论的默认状态。此设置优先于环境变量 COMMENT_AUDIT。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">用户评论默认状态</label>
      <select id="set-user-comment-status">
        <option value="approved">直接通过 (approved)</option>
        <option value="waiting">等待审核 (waiting)</option>
      </select>
      <p class="description">已登录用户发表评论的默认状态。</p>
    </div>
  </div>

  <!-- Tab: Email Notification -->
  <div class="typecho-table-wrap tab-panel" id="tab-email" style="display:none">
    <h4 style="margin:0 0 16px;font-size:14px;color:#444;border-bottom:1px solid #eee;padding-bottom:8px">SMTP 设置</h4>
    <div class="typecho-option">
      <label class="typecho-label">SMTP 服务</label>
      <select id="set-smtp-service">
        <option value="">原生 SMTP</option>
        <option value="resend">Resend (HTTP API)</option>
        <option value="sendgrid">SendGrid (HTTP API)</option>
      </select>
      <p class="description">邮件发送方式。Resend / SendGrid 不需要填写下方主机端口，只需填写用户名/密码（API Key）。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">SMTP 服务器地址</label>
      <input type="text" id="set-smtp-host" placeholder="smtp.example.com" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">SMTP 服务器端口</label>
      <input type="number" id="set-smtp-port" placeholder="465" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">SMTP 用户名</label>
      <input type="text" id="set-smtp-user" placeholder="user@example.com" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">SMTP 密码 / API Key</label>
      <input type="password" id="set-smtp-pass" placeholder="password or api key" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">使用 SSL</label>
      <select id="set-smtp-secure">
        <option value="1" selected>是 (SSL/TLS)</option>
        <option value="0">否</option>
      </select>
      <p class="description">465 端口通常使用 SSL；587 端口通常不使用。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">发件人名称</label>
      <input type="text" id="set-sender-name" placeholder="Waline" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">发件人邮箱</label>
      <input type="text" id="set-sender-email" placeholder="noreply@example.com" />
    </div>

    <h4 style="margin:24px 0 16px;font-size:14px;color:#444;border-bottom:1px solid #eee;padding-bottom:8px">SMTP 测试</h4>
    <div class="typecho-option">
      <label class="typecho-label">测试收件邮箱</label>
      <input type="text" id="set-test-mail-to" placeholder="admin@example.com" />
      <p class="description">填写后点击下方按钮，将使用当前保存的 SMTP 配置发送一封测试邮件。</p>
    </div>
    <div class="typecho-option">
      <button class="btn" id="test-mail-btn">发送测试邮件</button>
      <span id="test-mail-result" style="margin-left:10px;font-size:13px;color:#666"></span>
    </div>

    <h4 style="margin:24px 0 16px;font-size:14px;color:#444;border-bottom:1px solid #eee;padding-bottom:8px">邮件模板</h4>
    <div class="typecho-option">
      <label class="typecho-label">评论回复邮件标题</label>
      <input type="text" id="set-mail-subject" placeholder="您在 {{site.name}} 的评论有了新的回复" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">评论回复邮件内容</label>
      <textarea id="set-mail-template" rows="4" placeholder="<p>您好，{{parent.nick}}：</p><p>{{comment.nick}} 回复了您的评论...</p>"></textarea>
      <p class="description">可用变量：{{site.name}} {{site.url}} {{comment.nick}} {{comment.mail}} {{comment.content}} {{comment.url}} {{parent.nick}} {{parent.content}}</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">新评论通知邮件标题</label>
      <input type="text" id="set-mail-subject-admin" placeholder="{{site.name}} 上有新评论" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">新评论通知邮件内容</label>
      <textarea id="set-mail-template-admin" rows="4" placeholder="<p>新评论来自 {{comment.nick}}...</p>"></textarea>
      <p class="description">可用变量同上。</p>
    </div>
  </div>

  <!-- Tab: PushPlus -->
  <div class="typecho-table-wrap tab-panel" id="tab-pushplus" style="display:none">
    <h4 style="margin:0 0 16px;font-size:14px;color:#444;border-bottom:1px solid #eee;padding-bottom:8px">PushPlus 推送设置</h4>
    <div class="typecho-option">
      <label class="typecho-label">用户令牌 (token)</label>
      <input type="text" id="set-push-plus-key" placeholder="从 pushplus.plus 获取的 token" />
      <p class="description">必填。没有 token 将不会推送。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">群组编码 (topic)</label>
      <input type="text" id="set-push-plus-topic" placeholder="可选" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">发送模板</label>
      <input type="text" id="set-push-plus-template" placeholder="html" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">发送渠道</label>
      <input type="text" id="set-push-plus-channel" placeholder="wechat" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">Webhook 编码</label>
      <input type="text" id="set-push-plus-webhook" placeholder="仅在 channel 为 webhook 时填写" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">回调地址</label>
      <input type="text" id="set-push-plus-callbackurl" placeholder="可选" />
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="btn primary" id="save-btn">保存设置</button>
  </div>
</div>

<script>
(function(){
  var API = ${JSON.stringify(apiBase)};
  var token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

  function toast(msg, ok) {
    var el = document.createElement('div');
    el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function(){ el.remove(); }, 3000);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + '/api' + path, Object.assign({}, opts, { headers: headers })).then(function(r){ return r.json(); });
  }

  // Tab switching
  var tabs = document.querySelectorAll('.typecho-option-tabs a');
  var panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      var target = this.getAttribute('data-tab');
      tabs.forEach(function(t){ t.parentElement.classList.remove('active'); });
      this.parentElement.classList.add('active');
      panels.forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('tab-' + target).style.display = '';
    });
  });

  // Fetch npm versions via jsdelivr API
  function fetchVersions() {
    var btn = document.getElementById('refresh-versions');
    var sel = document.getElementById('version-select');
    btn.disabled = true;
    btn.innerHTML = '↻<span class="spinner"></span>';
    fetch('https://data.jsdelivr.com/v1/packages/npm/@waline/client')
      .then(function(r){ return r.json(); })
      .then(function(data) {
        sel.innerHTML = '<option value="">选择版本…</option><option value="latest">latest' +
          (data.tags && data.tags.latest ? ' (' + esc(data.tags.latest) + ')' : '') + '</option>';
        if (data.versions) {
          data.versions.slice(0, 30).forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.version;
            opt.textContent = v.version;
            sel.appendChild(opt);
          });
        }
        toast('版本列表已刷新', true);
      })
      .catch(function(e){ toast('获取版本失败: ' + e.message, false); })
      .finally(function(){ btn.disabled = false; btn.textContent = '↻ 刷新'; });
  }

  document.getElementById('refresh-versions').addEventListener('click', fetchVersions);
  document.getElementById('version-select').addEventListener('change', function() {
    if (this.value) document.getElementById('set-version').value = this.value;
  });

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.value = val || '';
    } else if (el.type === 'checkbox') {
      el.checked = !!val;
    } else {
      el.value = val || '';
    }
  }

  // Load settings
  api('/settings').then(function(sr) {
    var s = sr.data || {};
    setVal('set-version', s.waline_client_version);
    setVal('set-comment-status', s.comment_default_status);
    setVal('set-user-comment-status', s.user_comment_default_status);
    setVal('set-worker-display', s.worker_display);

    // Basic settings
    setVal('set-site-name', s.site_name);
    setVal('set-site-url', s.site_url);
    setVal('set-author-email', s.author_email);
    setVal('set-ipqps', s.ipqps);
    setVal('set-comment-audit', s.comment_audit === 'true');
    setVal('set-akismet-key', s.akismet_key);
    setVal('set-disable-region', s.disable_region === 'true');
    setVal('set-disable-useragent', s.disable_useragent === 'true');

    // Email
    setVal('set-smtp-service', s.smtp_service);
    setVal('set-smtp-host', s.smtp_host);
    setVal('set-smtp-port', s.smtp_port);
    setVal('set-smtp-user', s.smtp_user);
    setVal('set-smtp-pass', s.smtp_pass);
    setVal('set-smtp-secure', s.smtp_secure);
    setVal('set-sender-name', s.sender_name);
    setVal('set-sender-email', s.sender_email);
    setVal('set-mail-subject', s.mail_subject);
    setVal('set-mail-template', s.mail_template);
    setVal('set-mail-subject-admin', s.mail_subject_admin);
    setVal('set-mail-template-admin', s.mail_template_admin);

    // PushPlus
    setVal('set-push-plus-key', s.push_plus_key);
    setVal('set-push-plus-topic', s.push_plus_topic);
    setVal('set-push-plus-template', s.push_plus_template);
    setVal('set-push-plus-channel', s.push_plus_channel);
    setVal('set-push-plus-webhook', s.push_plus_webhook);
    setVal('set-push-plus-callbackurl', s.push_plus_callbackurl);

    // Match selected version in dropdown
    var sel = document.getElementById('version-select');
    var ver = s.waline_client_version || 'v3';
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === ver) { sel.selectedIndex = i; break; }
    }
  }).catch(function(){ toast('加载设置失败', false); });

  // Auto-fetch versions on load
  fetchVersions();

  // Save
  document.getElementById('save-btn').addEventListener('click', function() {
    var settings = {
      waline_client_version: document.getElementById('set-version').value.trim() || 'v3',
      comment_default_status: document.getElementById('set-comment-status').value,
      user_comment_default_status: document.getElementById('set-user-comment-status').value,
      worker_display: document.getElementById('set-worker-display').value,
      // Basic settings
      site_name: document.getElementById('set-site-name').value.trim(),
      site_url: document.getElementById('set-site-url').value.trim(),
      author_email: document.getElementById('set-author-email').value.trim(),
      ipqps: document.getElementById('set-ipqps').value.trim(),
      comment_audit: document.getElementById('set-comment-audit').checked ? 'true' : 'false',
      akismet_key: document.getElementById('set-akismet-key').value.trim(),
      disable_region: document.getElementById('set-disable-region').checked ? 'true' : 'false',
      disable_useragent: document.getElementById('set-disable-useragent').checked ? 'true' : 'false',
      // Email
      smtp_service: document.getElementById('set-smtp-service').value,
      smtp_host: document.getElementById('set-smtp-host').value.trim(),
      smtp_port: document.getElementById('set-smtp-port').value.trim(),
      smtp_user: document.getElementById('set-smtp-user').value.trim(),
      smtp_pass: document.getElementById('set-smtp-pass').value.trim(),
      smtp_secure: document.getElementById('set-smtp-secure').value,
      sender_name: document.getElementById('set-sender-name').value.trim(),
      sender_email: document.getElementById('set-sender-email').value.trim(),
      mail_subject: document.getElementById('set-mail-subject').value.trim(),
      mail_template: document.getElementById('set-mail-template').value.trim(),
      mail_subject_admin: document.getElementById('set-mail-subject-admin').value.trim(),
      mail_template_admin: document.getElementById('set-mail-template-admin').value.trim(),
      // PushPlus
      push_plus_key: document.getElementById('set-push-plus-key').value.trim(),
      push_plus_topic: document.getElementById('set-push-plus-topic').value.trim(),
      push_plus_template: document.getElementById('set-push-plus-template').value.trim(),
      push_plus_channel: document.getElementById('set-push-plus-channel').value.trim(),
      push_plus_webhook: document.getElementById('set-push-plus-webhook').value.trim(),
      push_plus_callbackurl: document.getElementById('set-push-plus-callbackurl').value.trim(),
    };
    api('/settings', { method: 'PUT', body: JSON.stringify(settings) }).then(function(r) {
      toast(r.errno ? (r.errmsg || '保存失败') : '设置已保存！', !r.errno);
    }).catch(function(){ toast('保存失败', false); });
  });

  // Test mail
  document.getElementById('test-mail-btn').addEventListener('click', function() {
    var btn = document.getElementById('test-mail-btn');
    var result = document.getElementById('test-mail-result');
    var to = document.getElementById('set-test-mail-to').value.trim();
    if (!to) {
      result.textContent = '请填写测试收件邮箱';
      result.style.color = '#b94a48';
      return;
    }
    btn.disabled = true;
    result.textContent = '发送中…';
    result.style.color = '#666';
    api('/settings/test-mail', { method: 'POST', body: JSON.stringify({ to: to }) }).then(function(r) {
      result.textContent = r.errmsg || (r.errno ? '发送失败' : '已发送');
      result.style.color = r.errno ? '#b94a48' : '#264409';
      if (!r.errno) toast('测试邮件已发送', true);
    }).catch(function(e) {
      result.textContent = '请求失败: ' + (e.message || '');
      result.style.color = '#b94a48';
    }).finally(function() {
      btn.disabled = false;
    });
  });
})();
</script>
</body>
</html>`;
}
