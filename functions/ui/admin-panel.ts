/**
 * Admin Panel - loads @waline/admin from CDN (matching original Waline implementation)
 * Includes EdgeOne branding and menu injection based on worker_display setting
 * Menu injection uses client-side API check (server-side auth validation) so it
 * works on first login without page refresh
 */
import type { Env } from '../env.js';
import { getSetting } from '../router/settings.js';

export async function getAdminPage(env: Env, requestUrl: string): Promise<string> {
  const workerDisplay = await getSetting('worker_display').catch(() => null) || 'admin';
  const url = new URL(requestUrl);
  const serverURL = `${url.origin}/api/`;
  const [kvSiteName, kvSiteUrl] = await Promise.all([
    getSetting('site_name').catch(() => null),
    getSetting('site_url').catch(() => null),
  ]);
  const siteName = kvSiteName || env.SITE_NAME || '';
  const siteUrl = kvSiteUrl || env.SITE_URL || '';
  const recaptchaV3Key = env.RECAPTCHA_V3_KEY || '';
  const turnstileKey = env.TURNSTILE_KEY || '';
  const origin = url.origin;

  const showWorker = workerDisplay !== 'disabled';
  const showAlways = workerDisplay === 'always';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Waline Management System</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
${showWorker ? `  <style>.wk-badge{display:inline-block;margin-right:8px;padding:1px 8px;background:#f97316;color:#fff;font-size:11px;border-radius:10px;vertical-align:middle;font-weight:normal;letter-spacing:.5px;line-height:18px}</style>` : ''}
</head>
<body>
  <script>
    window.serverURL = ${JSON.stringify(serverURL)};
    window.SITE_NAME = ${JSON.stringify(siteName || undefined)};
    window.SITE_URL = ${JSON.stringify(siteUrl || undefined)};
    window.recaptchaV3Key = ${JSON.stringify(recaptchaV3Key || undefined)};
    window.turnstileKey = ${JSON.stringify(turnstileKey || undefined)};
  </script>
  <script src="//unpkg.com/@waline/admin"></script>
${showWorker ? `  <script>
  (function(){
    var ORIGIN = ${JSON.stringify(origin)};
    var ALWAYS = ${JSON.stringify(showAlways)};
    var menuDone = false, badgeDone = false;

    function addBadge() {
      if (badgeDone) return;
      var op = document.querySelector('.typecho-head-nav .operate');
      if (!op) return;
      badgeDone = true;
      var s = document.createElement('span');
      s.className = 'wk-badge';
      s.textContent = 'EdgeOne v1.0.0';
      op.insertBefore(s, op.firstChild);
    }

    function addMenu(tk) {
      if (menuDone) return;
      // Try multiple selectors for Waline admin nav
      var navSelectors = [
        '#typecho-nav-list .child',
        '.typecho-head-nav .nav-links',
        '.typecho-head-nav .inner',
        '#typecho-nav-list',
        '.head-nav .nav',
        '[class*="nav"] [class*="child"]',
      ];
      var nav = null;
      for (var i = 0; i < navSelectors.length; i++) {
        nav = document.querySelector(navSelectors[i]);
        if (nav) break;
      }
      if (!nav) return;
      menuDone = true;
      var li = document.createElement('li');
      li.className = 'last';
      var a = document.createElement('a');
      a.href = '/ui/worker-setting?token=' + encodeURIComponent(tk);
      a.textContent = 'EdgeOne 设置';
      li.appendChild(a);
      nav.appendChild(li);
    }

    function tryInject() {
      if (ALWAYS && !badgeDone) addBadge();
      if (menuDone && badgeDone) return;
      var tk = window.TOKEN || localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
      if (!tk && !ALWAYS) return;
      if (tk && !menuDone) {
        fetch(ORIGIN + '/api/token', {
          headers: { Authorization: 'Bearer ' + tk }
        }).then(function(r){ return r.json(); }).then(function(d){
          if (d.errno === 0 && d.data && d.data.type === 'administrator') {
            addMenu(tk);
            addBadge();
          }
        }).catch(function(){});
      }
    }

    function replaceLeanCloudNotice() {
      var replacement = '感谢使用 Waline On EdgeOne 版，欢迎访问<a href="https://kok.plus" target="_blank" rel="noopener noreferrer">作者博客</a>讨论';
      var keywords = ['Leancloud', '即将停止对外服务', '尽快迁移你的评论数据'];
      var els = document.querySelectorAll('.ant-notification-notice, .ant-message-notice, [class*="notification"], [class*="message"], [class*="toast"], [class*="alert"]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var text = el.textContent || '';
        for (var j = 0; j < keywords.length; j++) {
          if (text.indexOf(keywords[j]) !== -1) {
            el.innerHTML = '<div style="padding:12px 16px;font-size:14px;line-height:1.5">' + replacement + '</div>';
            return true;
          }
        }
      }
      // Fallback: search all text nodes
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while (node = walker.nextNode()) {
        var nt = node.textContent || '';
        for (var k = 0; k < keywords.length; k++) {
          if (nt.indexOf(keywords[k]) !== -1) {
            var p = node.parentElement;
            if (p && p !== document.body) {
              p.innerHTML = replacement;
              return true;
            }
          }
        }
      }
      return false;
    }

    var ob = new MutationObserver(function(){
      tryInject();
      replaceLeanCloudNotice();
    });
    ob.observe(document.body, { childList: true, subtree: true });
    var iv = setInterval(function(){
      tryInject();
      if (menuDone && badgeDone) clearInterval(iv);
    }, 1500);
    setTimeout(tryInject, 300);
    setTimeout(function(){ replaceLeanCloudNotice(); }, 2000);
    setTimeout(function(){ clearInterval(iv); }, 60000);
  })();
  </script>` : ''}
</body>
</html>`;
}
