const PUBLIC_COMMENT_LIST_CACHE_TTL = 90;
const PUBLIC_COMMENT_LIST_CACHE_PREFIX = 'cache:comment:list:v1:';
const COMMENT_LIST_VERSION_PREFIX = 'meta:comments:url-version:';

export interface PublicCommentListCacheParams {
  path: string;
  page: number;
  pageSize: number;
  sortBy: string;
  version: number;
}

export interface CommentCacheAuthSignal {
  authorization?: string | null;
  cookie?: string | null;
  token?: string | null;
}

export function hasCommentCacheAuthSignal(signal: CommentCacheAuthSignal): boolean {
  return Boolean(
    (signal.authorization || '').trim()
    || /(?:^|;\s*)TOKEN=/.test(signal.cookie || '')
    || (signal.token || '').trim(),
  );
}

export function buildPublicCommentListCacheKey(params: PublicCommentListCacheParams): string {
  const source = JSON.stringify([
    params.path,
    params.page,
    params.pageSize,
    params.sortBy,
    params.version,
  ]);
  return `${PUBLIC_COMMENT_LIST_CACHE_PREFIX}${fnv1a(source)}${fnv1a(reverseString(source), 0x811c9dc5 ^ source.length)}`;
}

export async function getCommentListVersion(url: string): Promise<number> {
  if (!url) return 1;
  const raw = await WALINE_KV.get(commentListVersionKey(url));
  const version = raw ? parseInt(String(raw), 10) : 1;
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export async function bumpCommentListVersion(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const version = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  await WALINE_KV.put(commentListVersionKey(url), String(version));
}

export async function getPublicCommentListCache<T>(params: PublicCommentListCacheParams): Promise<T | null> {
  try {
    const raw = await WALINE_KV.get(buildPublicCommentListCacheKey(params));
    if (!raw || typeof raw !== 'string') return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setPublicCommentListCache<T>(
  params: PublicCommentListCacheParams,
  value: T,
): Promise<void> {
  try {
    await WALINE_KV.put(buildPublicCommentListCacheKey(params), JSON.stringify(value), {
      expirationTtl: PUBLIC_COMMENT_LIST_CACHE_TTL,
    });
  } catch (error) {
    console.warn(`[Waline KV] public comment cache write failed: ${errorMessage(error)}`);
  }
}

function commentListVersionKey(url: string): string {
  return `${COMMENT_LIST_VERSION_PREFIX}${encodeURIComponent(url)}`;
}

function fnv1a(value: string, seed = 0x811c9dc5): string {
  let hash = seed;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function reverseString(value: string): string {
  return Array.from(value).reverse().join('');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
