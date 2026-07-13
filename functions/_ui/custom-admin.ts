/**
 * EdgeOne Settings Page - Layui admin style (matches primeedge-admin theme)
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
 * Returns the Layui-styled settings page (only served to authenticated admins)
 */
export function getCustomSettingsPage(_requestUrl: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Waline 评论设置</title>
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
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--pe-bg-base); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--pe-text-primary); }

/* Header */
.pe-header {
  height: 56px; background: var(--pe-bg-card); border-bottom: 1px solid var(--pe-border);
  display: flex; align-items: center; padding: 0 24px; box-shadow: var(--pe-shadow-sm);
  position: sticky; top: 0; z-index: 100;
}
.pe-header-title { font-size: 16px; font-weight: 600; color: var(--pe-text-primary); display: flex; align-items: center; gap: 10px; }
.pe-header-title i { color: var(--pe-accent); }
.pe-header-right { margin-left: auto; }
.pe-header-right a { color: var(--pe-text-secondary); font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--pe-radius-sm); transition: all .2s; }
.pe-header-right a:hover { background: var(--pe-accent-bg); color: var(--pe-accent); }

/* Main layout */
.pe-main { max-width: 960px; margin: 24px auto; padding: 0 20px; }

/* Tab style override */
.layui-tab { background: transparent; border: none; box-shadow: none; }
.layui-tab-title { border-bottom: 2px solid var(--pe-border); padding: 0; }
.layui-tab-title li { font-size: 14px; color: var(--pe-text-secondary); border: none !important; padding: 0 20px; line-height: 40px; min-width: auto; transition: color .2s; }
.layui-tab-title li:hover { color: var(--pe-accent); }
.layui-tab-title .layui-this { color: var(--pe-accent) !important; font-weight: 600; }
.layui-tab-title .layui-this::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: var(--pe-accent); border-radius: 2px; }
.layui-tab-content { padding: 24px 0 0; }

/* Card panels */
.setting-card { background: var(--pe-bg-card); border-radius: var(--pe-radius); padding: 24px 28px; box-shadow: var(--pe-shadow-card); margin-bottom: 20px; }
.setting-card h4 { margin: 0 0 16px; font-size: 14px; font-weight: 600; color: var(--pe-text-primary); padding-bottom: 10px; border-bottom: 1px solid var(--pe-border); }

/* Form items */
.pe-form-item { margin-bottom: 20px; }
.pe-form-item label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--pe-text-primary); }
.pe-form-item .pe-desc { margin: 6px 0 0; font-size: 12px; color: var(--pe-text-muted); line-height: 1.5; }
.pe-form-item input[type="text"],
.pe-form-item input[type="password"],
.pe-form-item input[type="url"],
.pe-form-item input[type="number"],
.pe-form-item textarea,
.pe-form-item select {
  width: 100%; max-width: 480px; padding: 8px 12px; border: 1px solid var(--pe-border); border-radius: var(--pe-radius-sm);
  font-size: 13px; background: var(--pe-bg-input); outline: none; transition: border-color .2s, box-shadow .2s;
}
.pe-form-item input:focus, .pe-form-item textarea:focus, .pe-form-item select:focus {
  border-color: var(--pe-accent); box-shadow: 0 0 0 3px var(--pe-accent-bg);
}
.pe-form-item textarea { resize: vertical; min-height: 80px; }
.pe-form-item select { height: 36px; cursor: pointer; }

/* Toggle switch */
.pe-switch { position: relative; display: inline-block; width: 40px; height: 22px; vertical-align: middle; }
.pe-switch input { opacity: 0; width: 0; height: 0; }
.pe-switch-slider { position: absolute; cursor: pointer; inset: 0; background: #CBD5E1; border-radius: 22px; transition: .2s; }
.pe-switch-slider:before { content: ""; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: .2s; }
.pe-switch input:checked + .pe-switch-slider { background: var(--pe-accent); }
.pe-switch input:checked + .pe-switch-slider:before { transform: translateX(18px); }
.pe-switch-label { font-size: 13px; color: var(--pe-text-secondary); margin-left: 10px; vertical-align: middle; }

/* Buttons */
.pe-btn { border: none; cursor: pointer; border-radius: var(--pe-radius-sm); display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 13px; font-weight: 500; transition: all .2s; }
.pe-btn-primary { background: var(--pe-accent); color: #fff; }
.pe-btn-primary:hover { background: var(--pe-accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.pe-btn-default { background: var(--pe-bg-input); color: var(--pe-text-primary); border: 1px solid var(--pe-border); }
.pe-btn-default:hover { border-color: var(--pe-accent); color: var(--pe-accent); }
.pe-btn-sm { padding: 5px 12px; font-size: 12px; }

/* Version row */
.version-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.version-row input { flex: 1; max-width: 260px; }
.version-row select { flex: 0 0 auto; max-width: 180px; }

/* Toast */
.pe-toast { position: fixed; top: 70px; right: 20px; padding: 12px 20px; border-radius: var(--pe-radius-sm); font-size: 13px; z-index: 9999; animation: peSlideIn .3s ease; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.pe-toast-ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
.pe-toast-err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
@keyframes peSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

/* Footer actions */
.pe-actions { padding: 20px 0; display: flex; gap: 10px; }
</style>
</head>
<body>

<!-- Header -->
<div class="pe-header">
  <div class="pe-header-title">
    <i class="layui-icon layui-icon-set"></i>
    Waline 评论系统设置
  </div>
  <div class="pe-header-right">
    <a href="/ui"><i class="layui-icon layui-icon-left"></i> 返回管理面板</a>
  </div>
</div>

<!-- Main Content -->
<div class="pe-main">
  <div class="layui-tab layui-tab-brief">
    <ul class="layui-tab-title">
      <li class="layui-this">前端版本</li>
      <li>基础设置</li>
      <li>评论策略</li>
      <li>邮件通知</li>
      <li>PushPlus</li>
      <li>图片上传</li>
      <li>安全验证</li>
    </ul>
    <div class="layui-tab-content">

      <!-- Tab 1: Frontend Version -->
      <div class="layui-tab-item layui-show">
        <div class="setting-card">
          <h4>前端组件版本</h4>
          <div class="pe-form-item">
            <label>@waline/client CDN 版本</label>
            <div class="version-row">
              <input type="text" id="set-version" placeholder="v3" />
              <select id="version-select">
                <option value="">选择版本...</option>
                <option value="latest">latest</option>
              </select>
              <button class="pe-btn pe-btn-default pe-btn-sm" id="refresh-versions"><i class="layui-icon layui-icon-refresh"></i> 刷新</button>
            </div>
            <p class="pe-desc">@waline/client 前端组件版本。可输入版本号（如 v3、3.3.2）或从下拉菜单选择。</p>
          </div>
          <div class="pe-form-item">
            <label>Worker 信息显示</label>
            <select id="set-worker-display">
              <option value="always">始终显示</option>
              <option value="admin" selected>仅管理员登录</option>
              <option value="disabled">禁用</option>
            </select>
            <p class="pe-desc">控制 Waline on EdgeOne 标识的可见性。</p>
          </div>
        </div>
      </div>

      <!-- Tab 2: Basic Settings -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>站点信息</h4>
          <div class="pe-form-item">
            <label>站点名称</label>
            <input type="text" id="set-site-name" placeholder="我的博客" />
            <p class="pe-desc">用于邮件、RSS 和通知消息中的网站名称。</p>
          </div>
          <div class="pe-form-item">
            <label>站点地址</label>
            <input type="url" id="set-site-url" placeholder="https://example.com" />
            <p class="pe-desc">网站完整地址，用于邮件和 RSS 链接。需以 https:// 开头。</p>
          </div>
          <div class="pe-form-item">
            <label>博主邮箱</label>
            <input type="text" id="set-author-email" placeholder="admin@example.com" />
            <p class="pe-desc">博主邮箱地址。新评论通知发送到此邮箱，评论者邮箱与此相同时标记为「博主」。</p>
          </div>
        </div>
        <div class="setting-card">
          <h4>安全与限制</h4>
          <div class="pe-form-item">
            <label>评论间隔限制（秒）</label>
            <input type="number" id="set-ipqps" placeholder="60" />
            <p class="pe-desc">同一 IP 发表评论的最小间隔秒数，填 0 表示不限制。</p>
          </div>
          <div class="pe-form-item">
            <label>强制评论审核</label>
            <div>
              <label class="pe-switch"><input type="checkbox" id="set-comment-audit" /><span class="pe-switch-slider"></span></label>
              <span class="pe-switch-label">开启后所有匿名评论默认进入待审核状态</span>
            </div>
          </div>
          <div class="pe-form-item">
            <label>禁用地区解析</label>
            <div>
              <label class="pe-switch"><input type="checkbox" id="set-disable-region" /><span class="pe-switch-slider"></span></label>
              <span class="pe-switch-label">关闭评论中的地区信息展示</span>
            </div>
          </div>
          <div class="pe-form-item">
            <label>禁用 UA 解析</label>
            <div>
              <label class="pe-switch"><input type="checkbox" id="set-disable-useragent" /><span class="pe-switch-slider"></span></label>
              <span class="pe-switch-label">关闭评论中的浏览器/系统信息展示</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Comment Policy -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>默认评论状态</h4>
          <div class="pe-form-item">
            <label>匿名评论默认状态</label>
            <select id="set-comment-status">
              <option value="approved">直接通过 (approved)</option>
              <option value="waiting">等待审核 (waiting)</option>
            </select>
            <p class="pe-desc">未登录用户发表评论的默认状态。此设置优先于环境变量 COMMENT_AUDIT。</p>
          </div>
          <div class="pe-form-item">
            <label>登录用户评论默认状态</label>
            <select id="set-user-comment-status">
              <option value="approved">直接通过 (approved)</option>
              <option value="waiting">等待审核 (waiting)</option>
            </select>
            <p class="pe-desc">已登录用户发表评论的默认状态。</p>
          </div>
        </div>
      </div>

      <!-- Tab 4: Email Notification -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>SMTP 配置</h4>
          <div class="pe-form-item">
            <label>SMTP 服务</label>
            <select id="set-smtp-service">
              <option value="">原生 SMTP</option>
              <option value="resend">Resend (HTTP API)</option>
              <option value="sendgrid">SendGrid (HTTP API)</option>
            </select>
            <p class="pe-desc">Resend / SendGrid 不需要填写主机端口，只需填写 API Key。</p>
          </div>
          <div class="pe-form-item">
            <label>SMTP 服务器地址</label>
            <input type="text" id="set-smtp-host" placeholder="smtp.example.com" />
          </div>
          <div class="pe-form-item">
            <label>SMTP 端口</label>
            <input type="number" id="set-smtp-port" placeholder="465" />
          </div>
          <div class="pe-form-item">
            <label>SMTP 用户名</label>
            <input type="text" id="set-smtp-user" placeholder="user@example.com" />
          </div>
          <div class="pe-form-item">
            <label>SMTP 密码 / API Key</label>
            <input type="password" id="set-smtp-pass" placeholder="password or api key" />
          </div>
          <div class="pe-form-item">
            <label>使用 SSL</label>
            <select id="set-smtp-secure">
              <option value="1" selected>是 (SSL/TLS, 端口465)</option>
              <option value="0">否 (端口587)</option>
            </select>
          </div>
          <div class="pe-form-item">
            <label>发件人名称</label>
            <input type="text" id="set-sender-name" placeholder="Waline" />
          </div>
          <div class="pe-form-item">
            <label>发件人邮箱</label>
            <input type="text" id="set-sender-email" placeholder="noreply@example.com" />
          </div>
        </div>
        <div class="setting-card">
          <h4>测试邮件</h4>
          <div class="pe-form-item">
            <label>测试收件邮箱</label>
            <input type="text" id="set-test-mail-to" placeholder="admin@example.com" />
            <p class="pe-desc">使用当前保存的 SMTP 配置发送一封测试邮件。</p>
          </div>
          <div class="pe-form-item">
            <button class="pe-btn pe-btn-default" id="test-mail-btn"><i class="layui-icon layui-icon-release"></i> 发送测试邮件</button>
            <span id="test-mail-result" style="margin-left:10px;font-size:13px;color:var(--pe-text-muted)"></span>
          </div>
        </div>
        <div class="setting-card">
          <h4>邮件模板</h4>
          <div class="pe-form-item">
            <label>评论回复邮件标题</label>
            <input type="text" id="set-mail-subject" placeholder="您在 {{site.name}} 的评论有了新的回复" />
          </div>
          <div class="pe-form-item">
            <label>评论回复邮件内容</label>
            <textarea id="set-mail-template" rows="4" placeholder="<p>您好，{{parent.nick}}：</p><p>{{comment.nick}} 回复了您的评论...</p>"></textarea>
            <p class="pe-desc">可用变量：{{site.name}} {{site.url}} {{comment.nick}} {{comment.mail}} {{comment.content}} {{comment.url}} {{parent.nick}} {{parent.content}}</p>
          </div>
          <div class="pe-form-item">
            <label>新评论通知邮件标题</label>
            <input type="text" id="set-mail-subject-admin" placeholder="{{site.name}} 上有新评论" />
          </div>
          <div class="pe-form-item">
            <label>新评论通知邮件内容</label>
            <textarea id="set-mail-template-admin" rows="4" placeholder="<p>新评论来自 {{comment.nick}}...</p>"></textarea>
          </div>
        </div>
      </div>

      <!-- Tab 5: PushPlus -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>PushPlus 微信推送</h4>
          <div class="pe-form-item">
            <label>用户令牌 (token)</label>
            <input type="text" id="set-push-plus-key" placeholder="从 pushplus.plus 获取的 token" />
            <p class="pe-desc">必填。没有 token 将不会推送。</p>
          </div>
          <div class="pe-form-item">
            <label>群组编码 (topic)</label>
            <input type="text" id="set-push-plus-topic" placeholder="可选" />
          </div>
          <div class="pe-form-item">
            <label>发送模板</label>
            <input type="text" id="set-push-plus-template" placeholder="html" />
          </div>
          <div class="pe-form-item">
            <label>发送渠道</label>
            <input type="text" id="set-push-plus-channel" placeholder="wechat" />
          </div>
          <div class="pe-form-item">
            <label>Webhook 编码</label>
            <input type="text" id="set-push-plus-webhook" placeholder="仅在 channel 为 webhook 时填写" />
          </div>
          <div class="pe-form-item">
            <label>回调地址</label>
            <input type="text" id="set-push-plus-callbackurl" placeholder="可选" />
          </div>
        </div>
      </div>

      <!-- Tab 6: Image Upload -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>图片存储设置</h4>
          <div class="pe-form-item">
            <label>存储类型</label>
            <select id="set-image-upload-type" onchange="toggleImageConfig(this.value)">
              <option value="kv">数据库 KV（默认，无需额外配置）</option>
              <option value="qiniu">七牛云</option>
              <option value="upyun">又拍云</option>
            </select>
            <p class="pe-desc">选择上传图片的存储后端。KV 存储在评论数据库中；七牛/又拍云需填写以下对应配置。仅登录用户可上传图片。</p>
          </div>
        </div>
        <div class="setting-card" id="img-qiniu-config" style="display:none;">
          <h4>七牛云配置</h4>
          <div class="pe-form-item">
            <label>Access Key</label>
            <input type="text" id="set-qiniu-access-key" placeholder="七牛云 Access Key" />
          </div>
          <div class="pe-form-item">
            <label>Secret Key</label>
            <input type="password" id="set-qiniu-secret-key" placeholder="七牛云 Secret Key" />
          </div>
          <div class="pe-form-item">
            <label>Bucket 名称</label>
            <input type="text" id="set-qiniu-bucket" placeholder="存储空间名称" />
          </div>
          <div class="pe-form-item">
            <label>访问域名</label>
            <input type="url" id="set-qiniu-domain" placeholder="https://cdn.example.com" />
            <p class="pe-desc">七牛云绑定的 CDN 加速域名，需以 https:// 开头。</p>
          </div>
        </div>
        <div class="setting-card" id="img-upyun-config" style="display:none;">
          <h4>又拍云配置</h4>
          <div class="pe-form-item">
            <label>操作员账号</label>
            <input type="text" id="set-upyun-operator" placeholder="又拍云操作员用户名" />
          </div>
          <div class="pe-form-item">
            <label>操作员密码</label>
            <input type="password" id="set-upyun-password" placeholder="又拍云操作员密码" />
          </div>
          <div class="pe-form-item">
            <label>服务名（Bucket）</label>
            <input type="text" id="set-upyun-bucket" placeholder="又拍云服务名" />
          </div>
          <div class="pe-form-item">
            <label>访问域名</label>
            <input type="url" id="set-upyun-domain" placeholder="https://cdn.example.com" />
            <p class="pe-desc">又拍云绑定的自定义域名，需以 https:// 开头。</p>
          </div>
        </div>
      </div>

      <!-- Tab 7: Security -->
      <div class="layui-tab-item">
        <div class="setting-card">
          <h4>极验行为验证 4.0</h4>
          <div class="pe-form-item">
            <label>Captcha ID（公开键）</label>
            <input type="text" id="set-geetest-captcha-id" placeholder="从极验控制台获取的 captcha_id" />
            <p class="pe-desc">在博客前端评论提交前触发极验滑块验证。填入后需同时在博客 config.toml 的 <code style="background:var(--pe-bg-input);padding:1px 5px;border-radius:3px;">params.waline.geetestCaptchaId</code> 填写相同值。</p>
          </div>
          <div class="pe-form-item">
            <label>Captcha Key（后端密钥，不会暴露给前端）</label>
            <input type="password" id="set-geetest-captcha-key" placeholder="从极验控制台获取的 captcha_key" />
            <p class="pe-desc">仅用于服务端验证签名，请妥善保管。</p>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Save button -->
  <div class="pe-actions">
    <button class="pe-btn pe-btn-primary" id="save-btn"><i class="layui-icon layui-icon-ok"></i> 保存设置</button>
    <button class="pe-btn" id="rerender-btn" style="margin-left:12px;background:var(--pe-warning);color:#fff;"><i class="layui-icon layui-icon-refresh"></i> 重新渲染评论</button>
    <span id="rerender-result" style="margin-left:12px;font-size:13px;"></span>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/layui@2.13.5/dist/layui.js"></script>
<script>
(function(){
  var API = location.origin;
  var token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');

  // Layui element for tabs
  layui.use('element', function(){});

  function toast(msg, ok) {
    var el = document.createElement('div');
    el.className = 'pe-toast ' + (ok ? 'pe-toast-ok' : 'pe-toast-err');
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

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') { el.value = val || ''; }
    else if (el.type === 'checkbox') { el.checked = (val === 'true' || val === true); }
    else { el.value = val || ''; }
  }

  function markSecret(id, configured) {
    var el = document.getElementById(id);
    if (!el || configured !== 'true') return;
    el.value = '';
    el.placeholder = '已配置，留空则保持不变';
    el.dataset.secretConfigured = 'true';
    if (el.parentElement.querySelector('[data-clear-secret="' + id + '"]')) return;
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'layui-btn layui-btn-primary layui-btn-xs';
    clearBtn.setAttribute('data-clear-secret', id);
    clearBtn.style.marginTop = '6px';
    clearBtn.textContent = '清除已保存值';
    clearBtn.onclick = function() {
      el.value = '';
      el.dataset.clearSecret = 'true';
      el.placeholder = '保存后将清除此值';
      clearBtn.disabled = true;
    };
    el.parentElement.appendChild(clearBtn);
  }

  // Fetch npm versions
  function fetchVersions() {
    var btn = document.getElementById('refresh-versions');
    var sel = document.getElementById('version-select');
    btn.disabled = true;
    fetch('https://data.jsdelivr.com/v1/packages/npm/@waline/client')
      .then(function(r){ return r.json(); })
      .then(function(data) {
        sel.innerHTML = '<option value="">选择版本...</option><option value="latest">latest' +
          (data.tags && data.tags.latest ? ' (' + data.tags.latest + ')' : '') + '</option>';
        if (data.versions) {
          data.versions.slice(0, 30).forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.version; opt.textContent = v.version;
            sel.appendChild(opt);
          });
        }
        toast('版本列表已刷新', true);
      })
      .catch(function(e){ toast('获取版本失败: ' + e.message, false); })
      .finally(function(){ btn.disabled = false; });
  }

  document.getElementById('refresh-versions').addEventListener('click', fetchVersions);
  document.getElementById('version-select').addEventListener('change', function() {
    if (this.value) document.getElementById('set-version').value = this.value;
  });

  // Load settings
  api('/settings').then(function(sr) {
    var s = sr.data || {};
    setVal('set-version', s.waline_client_version);
    setVal('set-worker-display', s.worker_display);
    setVal('set-site-name', s.site_name);
    setVal('set-site-url', s.site_url);
    setVal('set-author-email', s.author_email);
    setVal('set-ipqps', s.ipqps);
    setVal('set-comment-audit', s.comment_audit);
    setVal('set-disable-region', s.disable_region);
    setVal('set-disable-useragent', s.disable_useragent);
    setVal('set-comment-status', s.comment_default_status);
    setVal('set-user-comment-status', s.user_comment_default_status);
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
    setVal('set-push-plus-key', s.push_plus_key);
    setVal('set-push-plus-topic', s.push_plus_topic);
    setVal('set-push-plus-template', s.push_plus_template);
    setVal('set-push-plus-channel', s.push_plus_channel);
    setVal('set-push-plus-webhook', s.push_plus_webhook);
    setVal('set-push-plus-callbackurl', s.push_plus_callbackurl);
    // Image upload
    setVal('set-image-upload-type', s.image_upload_type);
    toggleImageConfig(s.image_upload_type || 'kv');
    setVal('set-qiniu-access-key', s.qiniu_access_key);
    setVal('set-qiniu-secret-key', s.qiniu_secret_key);
    setVal('set-qiniu-bucket', s.qiniu_bucket);
    setVal('set-qiniu-domain', s.qiniu_domain);
    setVal('set-upyun-operator', s.upyun_operator);
    setVal('set-upyun-password', s.upyun_password);
    setVal('set-upyun-bucket', s.upyun_bucket);
    setVal('set-upyun-domain', s.upyun_domain);
    // Geetest
    setVal('set-geetest-captcha-id', s.geetest_captcha_id);
    setVal('set-geetest-captcha-key', s.geetest_captcha_key);
    markSecret('set-smtp-pass', s.smtp_pass_configured);
    markSecret('set-push-plus-key', s.push_plus_key_configured);
    markSecret('set-push-plus-webhook', s.push_plus_webhook_configured);
    markSecret('set-qiniu-access-key', s.qiniu_access_key_configured);
    markSecret('set-qiniu-secret-key', s.qiniu_secret_key_configured);
    markSecret('set-upyun-password', s.upyun_password_configured);
    markSecret('set-geetest-captcha-key', s.geetest_captcha_key_configured);
  }).catch(function(){ toast('加载设置失败', false); });

  fetchVersions();

  // Save
  document.getElementById('save-btn').addEventListener('click', function() {
    var btn = this;
    btn.disabled = true;
    var settings = {
      waline_client_version: document.getElementById('set-version').value.trim() || 'v3',
      worker_display: document.getElementById('set-worker-display').value,
      site_name: document.getElementById('set-site-name').value.trim(),
      site_url: document.getElementById('set-site-url').value.trim(),
      author_email: document.getElementById('set-author-email').value.trim(),
      ipqps: document.getElementById('set-ipqps').value.trim(),
      comment_audit: document.getElementById('set-comment-audit').checked ? 'true' : 'false',
      disable_region: document.getElementById('set-disable-region').checked ? 'true' : 'false',
      disable_useragent: document.getElementById('set-disable-useragent').checked ? 'true' : 'false',
      comment_default_status: document.getElementById('set-comment-status').value,
      user_comment_default_status: document.getElementById('set-user-comment-status').value,
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
      push_plus_key: document.getElementById('set-push-plus-key').value.trim(),
      push_plus_topic: document.getElementById('set-push-plus-topic').value.trim(),
      push_plus_template: document.getElementById('set-push-plus-template').value.trim(),
      push_plus_channel: document.getElementById('set-push-plus-channel').value.trim(),
      push_plus_webhook: document.getElementById('set-push-plus-webhook').value.trim(),
      push_plus_callbackurl: document.getElementById('set-push-plus-callbackurl').value.trim(),
      // Image upload
      image_upload_type: document.getElementById('set-image-upload-type').value,
      qiniu_access_key: document.getElementById('set-qiniu-access-key').value.trim(),
      qiniu_secret_key: document.getElementById('set-qiniu-secret-key').value.trim(),
      qiniu_bucket: document.getElementById('set-qiniu-bucket').value.trim(),
      qiniu_domain: document.getElementById('set-qiniu-domain').value.trim(),
      upyun_operator: document.getElementById('set-upyun-operator').value.trim(),
      upyun_password: document.getElementById('set-upyun-password').value.trim(),
      upyun_bucket: document.getElementById('set-upyun-bucket').value.trim(),
      upyun_domain: document.getElementById('set-upyun-domain').value.trim(),
      // Geetest
      geetest_captcha_id: document.getElementById('set-geetest-captcha-id').value.trim(),
      geetest_captcha_key: document.getElementById('set-geetest-captcha-key').value.trim(),
    };
    [
      ['smtp_pass', 'set-smtp-pass'], ['push_plus_key', 'set-push-plus-key'],
      ['push_plus_webhook', 'set-push-plus-webhook'], ['qiniu_access_key', 'set-qiniu-access-key'],
      ['qiniu_secret_key', 'set-qiniu-secret-key'], ['upyun_password', 'set-upyun-password'],
      ['geetest_captcha_key', 'set-geetest-captcha-key']
    ].forEach(function(pair) {
      var key = pair[0], el = document.getElementById(pair[1]);
      if (el.dataset.clearSecret === 'true') settings[key] = null;
      else if (!el.value) delete settings[key];
    });
    api('/settings', { method: 'PUT', body: JSON.stringify(settings) }).then(function(r) {
      toast(r.errno ? (r.errmsg || '保存失败') : '设置已保存', !r.errno);
      if (!r.errno) {
        ['set-smtp-pass', 'set-push-plus-key', 'set-push-plus-webhook', 'set-qiniu-access-key', 'set-qiniu-secret-key', 'set-upyun-password', 'set-geetest-captcha-key'].forEach(function(id) {
          var el = document.getElementById(id);
          if (!el) return;
          if (el.dataset.clearSecret === 'true') {
            delete el.dataset.clearSecret;
            delete el.dataset.secretConfigured;
            el.placeholder = '';
            var clearBtn = el.parentElement.querySelector('[data-clear-secret="' + id + '"]');
            if (clearBtn) clearBtn.remove();
          } else if (el.value) {
            el.value = '';
            el.placeholder = '已配置，留空则保持不变';
          }
        });
      }
    }).catch(function(){ toast('保存失败', false); }).finally(function(){ btn.disabled = false; });
  });

  // Test mail
  document.getElementById('test-mail-btn').addEventListener('click', function() {
    var btn = this;
    var result = document.getElementById('test-mail-result');
    var to = document.getElementById('set-test-mail-to').value.trim();
    if (!to) { result.textContent = '请填写测试收件邮箱'; result.style.color = 'var(--pe-danger)'; return; }
    btn.disabled = true;
    result.textContent = '发送中...'; result.style.color = 'var(--pe-text-muted)';
    api('/settings/test-mail', { method: 'POST', body: JSON.stringify({ to: to }) }).then(function(r) {
      result.textContent = r.errmsg || (r.errno ? '发送失败' : '发送成功');
      result.style.color = r.errno ? 'var(--pe-danger)' : 'var(--pe-success)';
      if (!r.errno) toast('测试邮件已发送', true);
    }).catch(function(e) {
      result.textContent = '请求失败: ' + (e.message || '');
      result.style.color = 'var(--pe-danger)';
    }).finally(function(){ btn.disabled = false; });
  });

  // Re-render all comments
  document.getElementById('rerender-btn').addEventListener('click', function() {
    var btn = this;
    var result = document.getElementById('rerender-result');
    if (!confirm('将重新渲染所有评论的 HTML（修复表情等显示问题），是否继续？')) return;
    btn.disabled = true;
    result.textContent = '处理中...'; result.style.color = 'var(--pe-text-muted)';
    api('/comment/re-render', { method: 'POST' }).then(function(r) {
      result.textContent = r.errmsg || (r.errno ? '渲染失败' : '完成');
      result.style.color = r.errno ? 'var(--pe-danger)' : 'var(--pe-success)';
      if (!r.errno) toast(r.errmsg || '重新渲染完成', true);
    }).catch(function(e) {
      result.textContent = '请求失败: ' + (e.message || '');
      result.style.color = 'var(--pe-danger)';
    }).finally(function(){ btn.disabled = false; });
  });

  // Toggle image config panels
  window.toggleImageConfig = function(type) {
    var q = document.getElementById('img-qiniu-config');
    var u = document.getElementById('img-upyun-config');
    if (q) q.style.display = type === 'qiniu' ? '' : 'none';
    if (u) u.style.display = type === 'upyun' ? '' : 'none';
  };

})();
</script>
</body>
</html>`;
}
