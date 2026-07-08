export interface LegacyKVListResult {
  complete?: boolean;
  cursor?: string;
  keys?: Array<string | { key?: string; name?: string }>;
}

export interface LegacyKVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, options: { type: 'text' }): Promise<string | null>;
  get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  put?(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete?(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<LegacyKVListResult>;
}

export const LEGACY_KV_LIST_LIMIT_MAX = 256;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeListLimit(limit: number | undefined): number | undefined {
  if (limit === undefined || !Number.isFinite(limit)) return undefined;

  const normalized = Math.floor(limit);
  if (normalized <= 0) return undefined;
  return Math.min(normalized, LEGACY_KV_LIST_LIMIT_MAX);
}

function isUndefinedCursorError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('cursor')
    && message.includes('undefined')
    && message.includes('string');
}

function isLegacyKV(value: unknown): value is LegacyKVNamespace {
  return !!value
    && typeof (value as { get?: unknown }).get === 'function'
    && typeof (value as { list?: unknown }).list === 'function';
}

export function getLegacyKV(env?: unknown): LegacyKVNamespace | null {
  const envKV = (env as { WALINE_KV?: unknown } | undefined)?.WALINE_KV;
  if (isLegacyKV(envKV)) return envKV;

  const globalKV = (globalThis as unknown as { WALINE_KV?: unknown }).WALINE_KV;
  if (isLegacyKV(globalKV)) return globalKV;

  return null;
}

export function legacyListKeyName(key: string | { key?: string; name?: string }): string {
  return typeof key === 'string' ? key : key.name || key.key || '';
}

export async function legacyListPage(
  kv: LegacyKVNamespace,
  options?: { prefix?: string; limit?: number; cursor?: string },
): Promise<LegacyKVListResult> {
  const cleanOptions: { prefix?: string; limit?: number; cursor?: string } = {};
  if (options?.prefix !== undefined) cleanOptions.prefix = options.prefix;
  const limit = normalizeListLimit(options?.limit);
  if (limit !== undefined) cleanOptions.limit = limit;
  if (typeof options?.cursor === 'string' && options.cursor !== '') cleanOptions.cursor = options.cursor;

  try {
    return await kv.list(cleanOptions);
  } catch (error) {
    if (cleanOptions.cursor === undefined && isUndefinedCursorError(error)) {
      return kv.list({ ...cleanOptions, cursor: '' });
    }
    throw error;
  }
}

export async function legacyGetText(key: string): Promise<string | null> {
  const kv = getLegacyKV();
  if (!kv) return null;

  try {
    const value = await kv.get(key);
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : String(value);
  } catch {
    return null;
  }
}
