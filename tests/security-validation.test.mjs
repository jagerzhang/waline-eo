import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

async function loadTsModule(entryPath, dependencyPaths = []) {
  const dir = mkdtempSync(path.join(process.cwd(), '.waline-security-test-'));
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}', 'utf8');
  for (const relativePath of [entryPath, ...dependencyPaths]) {
    const sourcePath = path.resolve(process.cwd(), relativePath);
    const source = readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const outputPath = path.join(dir, relativePath.replace(/\.ts$/, '.js'));
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output, 'utf8');
  }
  const entryOutput = path.join(dir, entryPath.replace(/\.ts$/, '.js'));
  try {
    return await import(pathToFileURL(entryOutput).href + `?t=${Date.now()}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('Geetest v4 validation sends every required field and accepts the documented result-only success shape', { concurrency: false }, async () => {
  const { validateGeetest } = await loadTsModule(
    'functions/utils/geetest.ts',
    ['functions/utils/crypto-source.ts'],
  );
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = new URLSearchParams(init.body);
    return new Response(JSON.stringify({ result: 'success', reason: '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const passed = await validateGeetest({
      captchaId: 'captcha-id',
      captchaKey: 'captcha-key',
      lotNumber: 'lot-number',
      captchaOutput: 'captcha-output',
      passToken: 'pass-token',
      genTime: '1700000000',
    }, 100);
    assert.equal(passed, true);
    assert.equal(requestBody.get('captcha_id'), 'captcha-id');
    assert.equal(requestBody.get('lot_number'), 'lot-number');
    assert.equal(requestBody.get('captcha_output'), 'captcha-output');
    assert.equal(requestBody.get('pass_token'), 'pass-token');
    assert.equal(requestBody.get('gen_time'), '1700000000');
    assert.match(requestBody.get('sign_token'), /^[a-f0-9]{64}$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Geetest validation fails closed on rejected responses and timeouts', { concurrency: false }, async () => {
  const { validateGeetest } = await loadTsModule(
    'functions/utils/geetest.ts',
    ['functions/utils/crypto-source.ts'],
  );
  const params = {
    captchaId: 'captcha-id', captchaKey: 'captcha-key', lotNumber: 'lot-number',
    captchaOutput: 'captcha-output', passToken: 'pass-token', genTime: '1700000000',
  };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 'fail' }), { status: 200 });
    assert.equal(await validateGeetest(params, 100), false);

    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    assert.equal(await validateGeetest(params, 5), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('email verification codes and stored state use the same secure six-digit contract', async () => {
  const { generateNumericVerificationCode, parseVerificationState, timingSafeStringEqual } = await loadTsModule(
    'functions/utils/verification-code.ts',
  );
  for (let i = 0; i < 100; i++) {
    assert.match(generateNumericVerificationCode(), /^\d{6}$/);
  }
  assert.deepEqual(parseVerificationState('verify:012345:1700000000000'), {
    token: '012345',
    expiresAt: 1700000000000,
  });
  assert.equal(parseVerificationState('verify:1234:1700000000000'), null);
  assert.equal(timingSafeStringEqual('012345', '012345'), true);
  assert.equal(timingSafeStringEqual('012345', '012346'), false);
});

test('CORS accepts the blog site stored in KV and rejects unrelated origins', async () => {
  const { isAllowedOrigin, resolveAllowedOrigins } = await loadTsModule('functions/utils/cors-origin.ts');
  assert.deepEqual(resolveAllowedOrigins({}, 'https://kok.plus/path'), ['kok.plus']);
  assert.equal(isAllowedOrigin('https://kok.plus', {}, 'https://kok.plus'), true);
  assert.equal(isAllowedOrigin('https://www.kok.plus', {}, 'https://kok.plus'), true);
  assert.equal(isAllowedOrigin('https://evil.example', {}, 'https://kok.plus'), false);
});

test('registration, verification and reset routes share the secure service-origin contract', () => {
  const userSource = readFileSync(path.resolve('functions/router/user.ts'), 'utf8');
  const verificationSource = readFileSync(path.resolve('functions/router/verification.ts'), 'utf8');
  assert.match(userSource, /generateNumericVerificationCode\(6\)/);
  assert.doesNotMatch(userSource, /Math\.random\(\).*verification|Array\.from\(\{ length: 6 \}.*Math\.random/s);
  assert.equal((userSource.match(/new URL\(c\.req\.url\)\.origin/g) || []).length >= 2, true);
  assert.match(verificationSource, /parseVerificationState\(typeStr\)/);
  assert.match(verificationSource, /attempts >= 10/);
  assert.match(verificationSource, /timingSafeStringEqual/);
});

test('comment image uploads validate file signatures, use cryptographic keys and bound external waits', () => {
  const imageSource = readFileSync(path.resolve('functions/router/image.ts'), 'utf8');
  assert.match(imageSource, /detectImageType\(file\)/);
  assert.match(imageSource, /crypto\.getRandomValues/);
  assert.doesNotMatch(imageSource, /Math\.random/);
  assert.match(imageSource, /fetchWithTimeout/);
  assert.match(imageSource, /normalizePublicDomain/);
});

test('comment mutations validate identifiers and implement like/unlike symmetrically', () => {
  const commentSource = readFileSync(path.resolve('functions/router/comment.ts'), 'utf8');
  assert.match(commentSource, /body\.like \? 1 : -1/);
  assert.match(commentSource, /Invalid comment id/);
  assert.match(commentSource, /\['approved', 'waiting', 'spam'\]\.includes\(body\.status\)/);
  assert.match(commentSource, /comment\.length > 65536/);
});
