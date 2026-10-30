/**
 * 评论者网站链接 -> 站内跳转地址（外链确认中间页）。
 *
 * 背景：博客正文里的外链由前端 external-link-guard.js 统一改写到 /goto.html?url=...，
 * 但 Waline 是异步渲染的，guard 跑完时评论 DOM 还没生成，所以评论区一直是裸外链。
 * 与其在前端补 MutationObserver 去猜渲染时机，不如在评论输出的唯一出口做改写。
 *
 * 开关：KV setting `link_redirect` 或环境变量 `LINK_REDIRECT`，模板里 `{url}` 代表编码后的原始网址。
 * 留空 = 关闭，输出与未开启时完全一致。
 *
 * ── 关于模板为什么必须落地成绝对地址 ──
 *
 * 直觉上填相对路径 `/goto.html?url={url}` 最省事：浏览器按访问者当前域名解析，
 * 多域名站点各自跳自己的。但 Waline 客户端（v3）会对 link 做 normalize：
 *
 *     isAbsolute = /^(?:https?:)?\/\//
 *     link => isAbsolute(link) ? link : `https://${link}`
 *
 * 相对路径不在 isAbsolute 的范围内，于是被拼成 `https:///goto.html?url=...`，
 * 浏览器把空 host 容错成 host=goto.html —— 表现就是跳去了一个不存在的 `goto.html` 域名。
 * 所以后端必须输出绝对地址；模板可以是相对写法，由本模块按请求域名补全。
 *
 * ── 关于域名从哪来 ──
 *
 * 边缘函数自己的 URL 是 api.zhangge.net，不是访问者看的页面域名，所以取
 * Origin -> Referer -> SITE_URL，且必须命中白名单才采信（避免被任意 Origin 带偏）。
 * 补全后的域名会进入评论列表缓存 key，否则 A 域缓存的绝对地址会被 B 域的请求命中。
 */

/** 取出 URL 的域名（小写、不含端口），解析失败返回空串 */
export function hostOf(value: string): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** 域名是否命中白名单：精确匹配或子域匹配（zhang.ge 命中 a.zhang.ge） */
export function matchDomain(host: string, whitelist: string[] = []): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return whitelist.some((domain) => {
    const d = String(domain || '').trim().toLowerCase();
    if (!d) return false;
    return h === d || h.endsWith(`.${d}`);
  });
}

/** 把逗号/空白分隔的配置串切成域名数组 */
export function parseDomainList(value: string): string[] {
  return String(value || '')
    .split(/[,\s]+/)
    .map((item) => item.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase())
    .filter(Boolean);
}

/**
 * 确定本次请求应该用哪个站点域名。
 * 依次尝试 Origin / Referer / 兜底 URL，只采信命中白名单的；白名单为空时兜底 URL 直接采信。
 */
export function resolveSiteHost(
  candidates: { origin?: string | null; referer?: string | null; fallback?: string | null },
  whitelist: string[] = [],
): string {
  const ordered = [candidates.origin, candidates.referer, candidates.fallback];
  for (const raw of ordered) {
    const host = hostOf(String(raw || ''));
    if (!host) continue;
    if (whitelist.length === 0 || matchDomain(host, whitelist)) return host;
  }
  return '';
}

/**
 * 把模板落到绝对地址。
 * - 已经是绝对地址（`https://...`）或协议相对（`//...`）→ 原样返回
 * - 站内的相对写法（`/goto.html?url={url}`）→ 按 host 补全成 `https://<host>/goto.html?url={url}`
 * - 拿不到 host（无法安全补全）→ 返回空串，调用方应放弃改写，
 *   否则输出相对路径会被客户端 normalize 成 https://goto.html 这种坏地址
 */
export function resolveRedirectTemplate(template: string, host?: string): string {
  if (!template) return '';
  if (/^(?:https?:)?\/\//i.test(template)) return template;
  if (!host) return '';
  const path = template.startsWith('/') ? template : `/${template}`;
  return `https://${host}${path}`;
}

export interface LinkRedirectOptions {
  /** 当前访问域名，用于把相对模板补全成绝对地址 */
  host?: string;
  /** 域名白名单，命中的链接原样输出（例如博主自己的站点） */
  whitelist?: string[];
}

/**
 * 改写评论者的网站链接。
 * 命中白名单、开关关闭、伪协议、无法补全域名时都原样返回。
 */
export function applyLinkRedirect(link: string, template?: string, options: LinkRedirectOptions = {}): string {
  if (!link || !template) return link;
  // 只改写 http(s)：javascript: / data: 等伪协议不该被包进跳转页，原样返回等于不生效
  if (!/^https?:\/\//i.test(link)) return link;

  // 白名单内的站点（博主自己、友情站点）直接放行，没必要绕确认页
  if (matchDomain(hostOf(link), options.whitelist || [])) return link;

  const base = resolveRedirectTemplate(template, options.host);
  if (!base) return link;

  const encoded = encodeURIComponent(link);
  return base.indexOf('{url}') >= 0 ? base.split('{url}').join(encoded) : base + encoded;
}
