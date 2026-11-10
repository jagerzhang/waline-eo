import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

// 事故背景：等级计数键缺失时，历史实现会扫描全部 approved 评论（约 14675 条逐条 KV get），
// 在 EdgeOne Edge Function 上耗尽 CPU/时间预算并返回 545。本测试用 mock KV 断言在线请求
// 绝不触发全表扫描，只允许查计数键，且 LEVELS=false 可一键关闭等级。

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, '.tmp-build');
const kvEntry = path.join(buildDir, 'db', 'kv-store.js');
const commentEntry = path.join(buildDir, 'router', 'comment.js');

// 依赖 npm run build:tmp 的整体编译产物（相对依赖可解析）。独立跑本文件时按需自动编译一次。
if (!existsSync(kvEntry)) {
  execFileSync('npm', ['run', 'build:tmp'], { cwd: root, stdio: 'inherit' });
}

function createKvMock() {
  const getCalls = [];
  const listCalls = [];
  const putCalls = [];
  const kv = {
    // 所有键一律返回「缺失」：计数键缺失 + KV 无 levels 设置
    async get(key) {
      getCalls.push(key);
      return null;
    },
    async put(key, value) {
      putCalls.push([key, value]);
    },
    async delete() {},
    async list(opts) {
      listCalls.push(opts);
      return { keys: [], list_complete: true, cursor: '' };
    },
  };
  return { kv, getCalls, listCalls, putCalls };
}

// kv-store.ts 把 WALINE_KV 当作全局标识符使用；ESM 模块内裸读会查 globalThis，故先设置再 import。
globalThis.WALINE_KV = createKvMock().kv;
const kvStore = await import(pathToFileURL(kvEntry).href);
const commentRouter = await import(pathToFileURL(commentEntry).href);

test('getMailCommentCounts: 计数键缺失返回 0，KV.get 次数极少且只查计数键（无 approved 全表扫描）', { concurrency: false }, async () => {
  const mock = createKvMock();
  globalThis.WALINE_KV = mock.kv;

  const counts = await kvStore.getMailCommentCounts(['Nobody@Example.com']);

  assert.equal(counts.get('nobody@example.com'), 0);
  assert.ok(mock.getCalls.length >= 1, '必须真的查询了计数键');
  assert.ok(
    mock.getCalls.length <= 5,
    `KV.get 总次数应 <= 5，实际 ${mock.getCalls.length}: ${JSON.stringify(mock.getCalls.slice(0, 10))}`,
  );
  assert.ok(
    mock.getCalls.every((k) => k.startsWith('count:comments:mail:')),
    `只允许查计数键，禁止按 comment id 全表读取，实际: ${JSON.stringify(mock.getCalls.slice(0, 10))}`,
  );
  assert.equal(mock.listCalls.length, 0, '不得调用 KV.list（全表扫描会分页列举）');
  assert.equal(mock.putCalls.length, 0, '不得把降级的 0 固化回 KV');
  console.log(`[no-full-scan] getMailCommentCounts: KV.get=${mock.getCalls.length} (<=5), KV.list=${mock.listCalls.length}, KV.put=${mock.putCalls.length}`);
});

test('getUserCommentCounts: 无计数键的 user_id 返回 0 且同样不做全表扫描', { concurrency: false }, async () => {
  const mock = createKvMock();
  globalThis.WALINE_KV = mock.kv;

  const counts = await kvStore.getUserCommentCounts([987654]);

  assert.equal(counts.get(987654), 0);
  assert.ok(
    mock.getCalls.length <= 5,
    `KV.get 总次数应 <= 5，实际 ${mock.getCalls.length}: ${JSON.stringify(mock.getCalls.slice(0, 10))}`,
  );
  assert.ok(
    mock.getCalls.every((k) => k.startsWith('count:comments:user:')),
    `只允许查计数键，实际: ${JSON.stringify(mock.getCalls.slice(0, 10))}`,
  );
  assert.equal(mock.listCalls.length, 0, '不得调用 KV.list（全表扫描会分页列举）');
});

test('多 mail 时 KV.get 次数线性（每个 mail 仅一次），不会出现成百上千次按 comment id 读取', { concurrency: false }, async () => {
  const mock = createKvMock();
  globalThis.WALINE_KV = mock.kv;

  const mails = Array.from({ length: 20 }, (_, i) => `user${i}@example.com`);
  const counts = await kvStore.getMailCommentCounts(mails);

  for (const mail of mails) assert.equal(counts.get(mail), 0);
  assert.equal(mock.getCalls.length, mails.length, '应等于 mail 数量（线性），而非全表评论数量');
  assert.ok(
    mock.getCalls.every((k) => k.startsWith('count:comments:mail:')),
    '所有读取都应是计数键',
  );
});

test('getLevelsConfig: KV 无 levels 设置时 LEVELS=false 返回 false；无 env 用默认等级；自定义串按逗号解析', { concurrency: false }, async () => {
  const mock = createKvMock();
  globalThis.WALINE_KV = mock.kv;

  // KV.get('setting:levels') 返回 null，回退到 env.LEVELS
  assert.equal(await commentRouter.getLevelsConfig({ LEVELS: 'false' }), false, 'LEVELS=false 应关闭等级');
  assert.equal(await commentRouter.getLevelsConfig({ LEVELS: '0' }), false, 'LEVELS=0 也应关闭等级');
  assert.deepEqual(await commentRouter.getLevelsConfig({}), [0, 10, 20, 50, 100, 200], '无配置时用默认等级');
  assert.deepEqual(await commentRouter.getLevelsConfig({ LEVELS: '5,20,100' }), [5, 20, 100], '自定义等级按逗号解析');
});
