// Offline check for the comment author's site URL rewrite (goto.html jump page).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const B = path.resolve(process.cwd(), '.tmp-build/utils/link-redirect.js');
const {
  applyLinkRedirect,
  hostOf,
  matchDomain,
  parseDomainList,
  resolveSiteHost,
  resolveRedirectTemplate,
} = await import(pathToFileURL(B).href);

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '->', detail); }
};

const ABS = 'https://zhang.ge/goto.html?url={url}';
const REL = '/goto.html?url={url}';
const HOST = 'zhang.ge';
const WL = ['zhang.ge', 'zhangge.net'];

console.log('\n[case 1] 开关关闭（模板为空）时必须原样返回');
check('空模板', applyLinkRedirect('https://a.com', '') === 'https://a.com', applyLinkRedirect('https://a.com', ''));
check('undefined 模板', applyLinkRedirect('https://a.com', undefined) === 'https://a.com', applyLinkRedirect('https://a.com', undefined));
check('空 link', applyLinkRedirect('', ABS) === '', applyLinkRedirect('', ABS));

console.log('\n[case 2] 绝对地址模板 + {url} 占位符');
check('基础替换', applyLinkRedirect('https://atzzz.com', ABS, { host: HOST })
  === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fatzzz.com',
  applyLinkRedirect('https://atzzz.com', ABS, { host: HOST }));
check('带路径与查询串', applyLinkRedirect('http://www.jieseba.top/?p=1&a=b', ABS, { host: HOST })
  === 'https://zhang.ge/goto.html?url=http%3A%2F%2Fwww.jieseba.top%2F%3Fp%3D1%26a%3Db',
  applyLinkRedirect('http://www.jieseba.top/?p=1&a=b', ABS, { host: HOST }));
check('中文域名', applyLinkRedirect('https://张戈.中国/', ABS, { host: HOST }).indexOf('%') > 0,
  applyLinkRedirect('https://张戈.中国/', ABS, { host: HOST }));

console.log('\n[case 3] 相对写法模板：后端必须补全成绝对地址');
const rel = applyLinkRedirect('https://atzzz.com', REL, { host: HOST });
check('补全为绝对地址', rel === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fatzzz.com', rel);
check('输出必须带协议与域名', rel.startsWith('https://zhang.ge/'), rel);
const relNet = applyLinkRedirect('https://atzzz.com', REL, { host: 'zhangge.net' });
check('按访问域名补全（zhangge.net）', relNet === 'https://zhangge.net/goto.html?url=https%3A%2F%2Fatzzz.com', relNet);
check('非根路径模板', applyLinkRedirect('https://a.com', 'goto.html?url={url}', { host: HOST })
  === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fa.com',
  applyLinkRedirect('https://a.com', 'goto.html?url={url}', { host: HOST }));

console.log('\n[case 4] ★ 拿不到域名时不能输出相对路径');
// Waline 客户端会把非绝对地址的 link 补成 `https://<link>`，相对路径会变成 https://goto.html/...
const noHost = applyLinkRedirect('https://atzzz.com', REL, {});
check('无 host 时原样返回', noHost === 'https://atzzz.com', noHost);
check('无 host 时不含 goto', noHost.indexOf('goto') < 0, noHost);
check('resolveRedirectTemplate 无 host 返回空串', resolveRedirectTemplate(REL, '') === '', resolveRedirectTemplate(REL, ''));
check('resolveRedirectTemplate 绝对模板原样', resolveRedirectTemplate(ABS, '') === ABS, resolveRedirectTemplate(ABS, ''));
check('协议相对模板原样保留', resolveRedirectTemplate('//zhang.ge/goto.html?url={url}', HOST)
  === '//zhang.ge/goto.html?url={url}', resolveRedirectTemplate('//zhang.ge/goto.html?url={url}', HOST));

console.log('\n[case 5] ★ 白名单：本站域名不套跳转页');
check('白名单精确命中', applyLinkRedirect('https://zhang.ge/post.html', REL, { host: HOST, whitelist: WL })
  === 'https://zhang.ge/post.html',
  applyLinkRedirect('https://zhang.ge/post.html', REL, { host: HOST, whitelist: WL }));
check('白名单子域命中', applyLinkRedirect('https://www.zhangge.net/x', REL, { host: HOST, whitelist: WL })
  === 'https://www.zhangge.net/x',
  applyLinkRedirect('https://www.zhangge.net/x', REL, { host: HOST, whitelist: WL }));
check('白名单带端口', applyLinkRedirect('https://zhang.ge:8443/x', REL, { host: HOST, whitelist: WL })
  === 'https://zhang.ge:8443/x',
  applyLinkRedirect('https://zhang.ge:8443/x', REL, { host: HOST, whitelist: WL }));
check('非白名单仍改写', applyLinkRedirect('https://hipyt.cn/', REL, { host: HOST, whitelist: WL })
  === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fhipyt.cn%2F',
  applyLinkRedirect('https://hipyt.cn/', REL, { host: HOST, whitelist: WL }));
check('空白名单不误伤', applyLinkRedirect('https://zhang.ge/x', REL, { host: HOST, whitelist: [] })
  === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fzhang.ge%2Fx',
  applyLinkRedirect('https://zhang.ge/x', REL, { host: HOST, whitelist: [] }));

console.log('\n[case 6] 伪协议与异常输入不得被包进跳转页');
check('javascript:', applyLinkRedirect('javascript:alert(1)', ABS, { host: HOST }) === 'javascript:alert(1)',
  applyLinkRedirect('javascript:alert(1)', ABS, { host: HOST }));
check('data:', applyLinkRedirect('data:text/html,<b>x</b>', ABS, { host: HOST }) === 'data:text/html,<b>x</b>',
  applyLinkRedirect('data:text/html,<b>x</b>', ABS, { host: HOST }));
check('站内相对路径', applyLinkRedirect('/about.html', ABS, { host: HOST }) === '/about.html',
  applyLinkRedirect('/about.html', ABS, { host: HOST }));

console.log('\n[case 7] 工具函数');
check('hostOf 解析（去端口与路径）', hostOf('https://Zhang.Ge:443/a?b=1') === 'zhang.ge', hostOf('https://Zhang.Ge:443/a?b=1'));
check('hostOf 非法输入', hostOf('not a url') === '', JSON.stringify(hostOf('not a url')));
check('matchDomain 子域', matchDomain('a.b.zhang.ge', ['zhang.ge']) === true, matchDomain('a.b.zhang.ge', ['zhang.ge']));
check('matchDomain 越界', matchDomain('zhangge.net.cn', ['zhangge.net']) === false, matchDomain('zhangge.net.cn', ['zhangge.net']));
check('parseDomainList 去协议与路径', JSON.stringify(parseDomainList(' https://Zhang.ge/a , zhangge.net ')) === JSON.stringify(['zhang.ge', 'zhangge.net']),
  JSON.stringify(parseDomainList(' https://Zhang.ge/a , zhangge.net ')));
check('resolveSiteHost 取 Origin', resolveSiteHost({ origin: 'https://zhang.ge', referer: 'https://evil.com' }, WL) === 'zhang.ge',
  resolveSiteHost({ origin: 'https://zhang.ge', referer: 'https://evil.com' }, WL));
check('resolveSiteHost 拒绝未授权 Origin', resolveSiteHost({ origin: 'https://evil.com', referer: 'https://zhangge.net' }, WL) === 'zhangge.net',
  resolveSiteHost({ origin: 'https://evil.com', referer: 'https://zhangge.net' }, WL));
check('resolveSiteHost 兜底 SITE_URL', resolveSiteHost({ fallback: 'https://zhangge.net' }, WL) === 'zhangge.net',
  resolveSiteHost({ fallback: 'https://zhangge.net' }, WL));
check('resolveSiteHost 无白名单时采信兜底', resolveSiteHost({ fallback: 'https://a.com' }, []) === 'a.com',
  resolveSiteHost({ fallback: 'https://a.com' }, []));
check('resolveSiteHost 全空返回空串', resolveSiteHost({}) === '', JSON.stringify(resolveSiteHost({})));

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
if (fail > 0) process.exit(1);
