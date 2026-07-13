import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getSetting } from './settings.js';
import { textBufferSource } from '../utils/crypto-source.js';

export const imageRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function randomSuffix(byteLength = 8): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function detectImageType(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (...codes: number[]) => codes.every((code, index) => bytes[index] === code);
  if (ascii(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) return 'image/gif';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && ['avif', 'avis'].includes(String.fromCharCode(...bytes.slice(8, 12)))) return 'image/avif';
  return null;
}

function normalizePublicDomain(value: string | null, label: string): string {
  const domain = String(value || '').replace(/\/$/, '');
  try {
    const url = new URL(domain);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${label}访问域名必须是有效的 HTTP(S) 地址`);
  }
  return domain;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/image - Upload image (login required)
 * multipart/form-data with `file` field
 */
imageRoutes.post('/', async (c) => {
  const userInfo = c.get('userInfo');
  if (!userInfo) {
    return c.json({ errno: 1, errmsg: '请先登录后再上传图片' }, 401);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ errno: 1, errmsg: '请求格式错误，需要 multipart/form-data' }, 400);
  }

  const file = formData.get('file') as File | null;
  if (!file || typeof file === 'string') {
    return c.json({ errno: 1, errmsg: '未找到文件字段 file' }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ errno: 1, errmsg: '不支持的文件类型，仅支持 JPG/PNG/GIF/WebP/AVIF' }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ errno: 1, errmsg: '文件大小不能超过 5MB' }, 400);
  }
  if ((await detectImageType(file)) !== file.type) {
    return c.json({ errno: 1, errmsg: '图片内容与声明的文件类型不一致' }, 400);
  }

  const uploadType = (await getSetting('image_upload_type').catch(() => null)) || 'kv';

  try {
    let url: string;

    if (uploadType === 'qiniu') {
      url = await uploadToQiniu(file, c.env);
    } else if (uploadType === 'upyun') {
      url = await uploadToUpyun(file, c.env);
    } else {
      // Default: KV storage
      url = await uploadToKV(file, c.req.url);
    }

    return c.json({ errno: 0, errmsg: '', url });
  } catch (e: any) {
    console.error('[Image Upload Error]', e);
    return c.json({ errno: 1, errmsg: '上传失败：' + (e.message || String(e)) }, 500);
  }
});

/**
 * GET /api/image/:key - Retrieve image from KV storage
 */
imageRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');
  if (!key || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
    return c.json({ errno: 1, errmsg: 'Missing key' }, 400);
  }

  const raw = await WALINE_KV.get(`img:${key}`);
  if (!raw) {
    return c.json({ errno: 1, errmsg: 'Image not found' }, 404);
  }

  // raw is stored as "mime:base64data"
  const sepIdx = raw.indexOf(':');
  if (sepIdx === -1) {
    return c.json({ errno: 1, errmsg: 'Invalid image data' }, 500);
  }
  const mime = raw.substring(0, sepIdx);
  const b64 = raw.substring(sepIdx + 1);
  if (!ALLOWED_TYPES.includes(mime)) {
    return c.json({ errno: 1, errmsg: 'Unsupported image type' }, 415);
  }

  // Convert base64 to binary
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Response(bytes, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

// ---- Storage backends ----

async function uploadToKV(file: File, requestUrl: string): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Convert to base64
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const b64 = btoa(binary);

  // Key: timestamp + random 6 chars
  const ts = Date.now();
  const rand = randomSuffix();
  const key = `${ts}-${rand}`;

  // Store as "mime:base64"
  await WALINE_KV.put(`img:${key}`, `${file.type}:${b64}`);

  const origin = new URL(requestUrl).origin;
  return `${origin}/api/image/${key}`;
}

async function uploadToQiniu(file: File, env: Env): Promise<string> {
  const [accessKey, secretKey, bucket, domain] = await Promise.all([
    getSetting('qiniu_access_key').catch(() => null),
    getSetting('qiniu_secret_key').catch(() => null),
    getSetting('qiniu_bucket').catch(() => null),
    getSetting('qiniu_domain').catch(() => null),
  ]);

  if (!accessKey || !secretKey || !bucket) {
    throw new Error('七牛云配置不完整，请检查 Access Key、Secret Key 和 Bucket');
  }

  // Generate upload token
  const ts = Date.now();
  const rand = randomSuffix();
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const key = `waline/${ts}-${rand}.${ext}`;

  const putPolicy = JSON.stringify({ scope: `${bucket}:${key}`, deadline: Math.floor(Date.now() / 1000) + 3600 });
  const encodedPolicy = btoa(putPolicy).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', textBufferSource(secretKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, textBufferSource(encodedPolicy));
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const uploadToken = `${accessKey}:${encodedSig}:${encodedPolicy}`;

  const fd = new FormData();
  fd.append('token', uploadToken);
  fd.append('key', key);
  fd.append('file', file);

  const resp = await fetchWithTimeout('https://up.qiniup.com', { method: 'POST', body: fd });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`七牛上传失败 (${resp.status}): ${text}`);
  }

  const baseDomain = normalizePublicDomain(domain, '七牛云');
  return `${baseDomain}/${key}`;
}

async function uploadToUpyun(file: File, env: Env): Promise<string> {
  const [operator, password, bucket, domain] = await Promise.all([
    getSetting('upyun_operator').catch(() => null),
    getSetting('upyun_password').catch(() => null),
    getSetting('upyun_bucket').catch(() => null),
    getSetting('upyun_domain').catch(() => null),
  ]);

  if (!operator || !password || !bucket) {
    throw new Error('又拍云配置不完整，请检查操作员名、密码和 Bucket');
  }

  const ts = Date.now();
  const rand = randomSuffix();
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const key = `/waline/${ts}-${rand}.${ext}`;

  const auth = btoa(`${operator}:${password}`);

  const arrayBuffer = await file.arrayBuffer();
  const resp = await fetchWithTimeout(`https://v0.api.upyun.com/${bucket}${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': file.type,
    },
    body: arrayBuffer,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`又拍云上传失败 (${resp.status}): ${text}`);
  }

  const baseDomain = normalizePublicDomain(domain, '又拍云');
  return `${baseDomain}${key}`;
}
