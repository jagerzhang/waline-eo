import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

async function loadTsModule(relativePath) {
  const sourcePath = path.resolve(process.cwd(), relativePath);
  const source = readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const dir = mkdtempSync(path.join(process.cwd(), '.waline-test-'));
  const outPath = path.join(dir, `${path.basename(relativePath, '.ts')}.mjs`);
  writeFileSync(outPath, output);
  try {
    return await import(pathToFileURL(outPath).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('public comment cache keys are stable, compact, and versioned', async () => {
  const { buildPublicCommentListCacheKey } = await loadTsModule('functions/db/comment-cache.ts');

  const base = {
    path: '/posts/a-very-long-article-path/?with=query#hash',
    page: 1,
    pageSize: 10,
    sortBy: 'insertedAt_desc',
    version: 101,
  };

  const keyA = buildPublicCommentListCacheKey(base);
  const keyB = buildPublicCommentListCacheKey({ ...base });
  const keyC = buildPublicCommentListCacheKey({ ...base, version: 102 });

  assert.equal(keyA, keyB);
  assert.notEqual(keyA, keyC);
  assert.match(keyA, /^cache:comment:list:v1:[a-z0-9]+$/);
  assert.ok(keyA.length <= 80);
  assert.equal(keyA.includes(base.path), false);
});

test('auth signal detection disables anonymous response cache', async () => {
  const { hasCommentCacheAuthSignal } = await loadTsModule('functions/db/comment-cache.ts');

  assert.equal(hasCommentCacheAuthSignal({ authorization: '', cookie: '', token: '' }), false);
  assert.equal(hasCommentCacheAuthSignal({ authorization: 'Bearer x', cookie: '', token: '' }), true);
  assert.equal(hasCommentCacheAuthSignal({ authorization: '', cookie: 'TOKEN=x', token: '' }), true);
  assert.equal(hasCommentCacheAuthSignal({ authorization: '', cookie: '', token: 'x' }), true);
});

test('mapWithConcurrencyLimit preserves order and caps active work', async () => {
  const { mapWithConcurrencyLimit } = await loadTsModule('functions/utils/concurrency.ts');

  let active = 0;
  let maxActive = 0;
  const result = await mapWithConcurrencyLimit([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value * 10;
  });

  assert.deepEqual(result, [10, 20, 30, 40, 50]);
  assert.equal(maxActive, 2);
});
