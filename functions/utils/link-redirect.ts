/**
 * 评论者网站链接 -> 站内跳转地址（外链确认中间页）。
 *
 * 背景：博客正文里的外链由前端 external-link-guard.js 统一改写到 /goto.html?url=...，
 * 但 Waline 是异步渲染的，guard 跑完时评论 DOM 还没生成，所以评论区一直是裸外链。
 * 与其在前端补 MutationObserver 去猜渲染时机，不如在评论输出的唯一出口做改写：
 * 前台、开放接口、RSS 三处一致，且不需要前端配合。
 *
 * 开关：KV setting `link_redirect` 或环境变量 `LINK_REDIRECT`。
 * 模板里用 `{url}` 代表原始网址的编码结果；模板不含 `{url}` 时按前缀拼接。
 * 留空 = 关闭，输出与未开启时完全一致。
 */
export function applyLinkRedirect(link: string, template?: string): string {
  if (!link || !template) return link;
  // 只改写 http(s)：javascript: / data: 等伪协议不该被包进跳转页，原样返回等于不生效
  if (!/^https?:\/\//i.test(link)) return link;
  const encoded = encodeURIComponent(link);
  return template.indexOf('{url}') >= 0 ? template.split('{url}').join(encoded) : template + encoded;
}
