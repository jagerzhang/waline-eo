// Offline check for applyLinkRedirect(): the comment author's site URL must be
// wrapped into the configured redirect page, and nothing else may change.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const B = path.resolve(process.cwd(), '.tmp-build/utils/link-redirect.js');
const { applyLinkRedirect } = await import(pathToFileURL(B).href);

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '->', detail); }
};

const TPL = 'https://zhang.ge/goto.html?url={url}';
const REL = '/goto.html?url={url}';

console.log('\n[case 1] 开关关闭（模板为空）时必须原样返回');
check('空模板', applyLinkRedirect('https://a.com', '') === 'https://a.com', applyLinkRedirect('https://a.com', ''));
check('undefined 模板', applyLinkRedirect('https://a.com', undefined) === 'https://a.com', applyLinkRedirect('https://a.com', undefined));
check('空 link', applyLinkRedirect('', TPL) === '', applyLinkRedirect('', TPL));

console.log('\n[case 2] {url} 占位符替换');
check('基础替换', applyLinkRedirect('https://atzzz.com', TPL) === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fatzzz.com',
  applyLinkRedirect('https://atzzz.com', TPL));
check('带路径与查询串', applyLinkRedirect('http://www.jieseba.top/?p=1&a=b', TPL)
  === 'https://zhang.ge/goto.html?url=http%3A%2F%2Fwww.jieseba.top%2F%3Fp%3D1%26a%3Db',
  applyLinkRedirect('http://www.jieseba.top/?p=1&a=b', TPL));
check('中文域名', applyLinkRedirect('https://张戈.中国/', TPL).indexOf('%') > 0, applyLinkRedirect('https://张戈.中国/', TPL));

console.log('\n[case 3] 模板无占位符时按前缀拼接');
check('前缀拼接', applyLinkRedirect('https://a.com/', 'https://zhang.ge/goto.html?url=')
  === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fa.com%2F',
  applyLinkRedirect('https://a.com/', 'https://zhang.ge/goto.html?url='));

console.log('\n[case 4] 伪协议与异常输入不得被包进跳转页');
check('javascript:', applyLinkRedirect('javascript:alert(1)', TPL) === 'javascript:alert(1)', applyLinkRedirect('javascript:alert(1)', TPL));
check('data:', applyLinkRedirect('data:text/html,<b>x</b>', TPL) === 'data:text/html,<b>x</b>', applyLinkRedirect('data:text/html,<b>x</b>', TPL));
check('站内相对路径', applyLinkRedirect('/about.html', TPL) === '/about.html', applyLinkRedirect('/about.html', TPL));

console.log('\n[case 5] 幂等：已改写过的值再改一次不应二次编码出错');
const once = applyLinkRedirect('https://a.com', TPL);
const twice = applyLinkRedirect(once, TPL);
check('二次改写仍是合法跳转地址', twice === 'https://zhang.ge/goto.html?url=https%3A%2F%2Fzhang.ge%2Fgoto.html%3Furl%3Dhttps%253A%252F%252Fa.com', twice);

console.log('\n[case 6] 相对路径模板：输出必须保持相对，由浏览器按当前域名解析');
const rel = applyLinkRedirect('https://atzzz.com', REL);
check('相对路径基础', rel === '/goto.html?url=https%3A%2F%2Fatzzz.com', rel);
check('输出不含协议与域名', /^\/[^/]/.test(rel) && rel.indexOf('://') < 0, rel);
check('相对前缀（无占位符）', applyLinkRedirect('https://a.com/', '/goto.html?url=')
  === '/goto.html?url=https%3A%2F%2Fa.com%2F',
  applyLinkRedirect('https://a.com/', '/goto.html?url='));
check('协议相对 // 开头原样保留',
  applyLinkRedirect('https://a.com', '//zhang.ge/goto.html?url={url}')
    === '//zhang.ge/goto.html?url=https%3A%2F%2Fa.com',
  applyLinkRedirect('https://a.com', '//zhang.ge/goto.html?url={url}'));
check('相对模板同样拒绝伪协议', applyLinkRedirect('javascript:alert(1)', REL) === 'javascript:alert(1)',
  applyLinkRedirect('javascript:alert(1)', REL));

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
if (fail > 0) process.exit(1);
