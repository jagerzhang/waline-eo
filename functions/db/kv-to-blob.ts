import { blobStorage } from './blob-storage.js';
import {
  getLegacyKV,
  legacyListKeyName,
  legacyListPage,
  type LegacyKVNamespace,
} from './legacy-kv.js';

export interface KvToBlobMigrationResult {
  available: boolean;
  scanned: number;
  copied: number;
  skippedExisting: number;
  skippedInvalid: number;
  failed: number;
  errors: Array<{ key: string; message: string }>;
  markerWritten: boolean;
}

export interface KvToBlobMigrationBatchResult extends KvToBlobMigrationResult {
  complete: boolean;
  cursor: string;
  prefix: string;
  prefixIndex: number;
}

const MIGRATION_MARKER_KEY = 'meta:migration:kv_to_blob';
const MIGRATION_PREFIXES = [
  'comment:',
  'comments:',
  'count:',
  'counter:',
  'user:',
  'setting:',
  'index:',
  'meta:',
  'img:',
  'img-meta:',
];

const SKIP_KEYS = new Set([MIGRATION_MARKER_KEY]);
const COPY_CONCURRENCY = 8;
const BATCH_LIST_LIMIT = 32;

function emptyResult(available: boolean): KvToBlobMigrationResult {
  return {
    available,
    scanned: 0,
    copied: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    failed: 0,
    errors: [],
    markerWritten: false,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseBatchCursor(cursor?: string): { prefixIndex: number; kvCursor?: string } {
  if (!cursor) return { prefixIndex: 0 };

  try {
    const state = JSON.parse(cursor) as { prefixIndex?: unknown; cursor?: unknown };
    const prefixIndex = typeof state.prefixIndex === 'number' && Number.isFinite(state.prefixIndex)
      ? Math.max(0, Math.floor(state.prefixIndex))
      : 0;
    const kvCursor = typeof state.cursor === 'string' && state.cursor !== '' ? state.cursor : undefined;
    return { prefixIndex, kvCursor };
  } catch {
    return { prefixIndex: 0 };
  }
}

function encodeBatchCursor(prefixIndex: number, cursor?: string): string {
  return JSON.stringify(cursor ? { prefixIndex, cursor } : { prefixIndex });
}

function isMigratableKey(key: string): boolean {
  if (!key || SKIP_KEYS.has(key)) return false;
  if (key.startsWith('__waline_ttl__/')) return false;
  if (key.startsWith('ipqps:')) return false;
  if (key.startsWith('rl:global:')) return false;
  if (key.startsWith('reset:')) return false;
  if (key.startsWith('token:blacklist:')) return false;
  return MIGRATION_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function readLegacyValue(kv: LegacyKVNamespace, key: string): Promise<string | ArrayBuffer> {
  try {
    const bytes = await kv.get(key, { type: 'arrayBuffer' });
    if (bytes !== null && bytes !== undefined) return bytes;
  } catch {
    // Some KV runtimes only support text reads. Fall back below.
  }

  const text = await kv.get(key);
  return text ?? '';
}

async function runInChunks<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item) => worker(item)));
  }
}

async function writeMigrationMarker(result: KvToBlobMigrationResult): Promise<void> {
  await blobStorage.put(MIGRATION_MARKER_KEY, JSON.stringify({
    migratedAt: new Date().toISOString(),
    mode: 'batch',
    scanned: result.scanned,
    copied: result.copied,
    skippedExisting: result.skippedExisting,
    skippedInvalid: result.skippedInvalid,
  }));
  result.markerWritten = true;
}

export async function migrateLegacyKvToBlobBatch(
  env?: unknown,
  options?: { overwrite?: boolean; cursor?: string },
): Promise<KvToBlobMigrationBatchResult> {
  const kv = getLegacyKV(env);
  const result: KvToBlobMigrationBatchResult = {
    ...emptyResult(!!kv),
    complete: false,
    cursor: '',
    prefix: '',
    prefixIndex: 0,
  };
  if (!kv) {
    result.complete = true;
    return result;
  }

  let { prefixIndex, kvCursor } = parseBatchCursor(options?.cursor);
  if (prefixIndex >= MIGRATION_PREFIXES.length) {
    result.complete = true;
    return result;
  }

  while (prefixIndex < MIGRATION_PREFIXES.length) {
    const prefix = MIGRATION_PREFIXES[prefixIndex];
    const currentCursor = kvCursor;
    result.prefix = prefix;
    result.prefixIndex = prefixIndex;

    const listOptions: { prefix: string; limit: number; cursor?: string } = {
      prefix,
      limit: BATCH_LIST_LIMIT,
    };
    if (currentCursor) listOptions.cursor = currentCursor;

    const list = await legacyListPage(kv, listOptions);
    const keys = list.keys || [];

    await runInChunks(keys, COPY_CONCURRENCY, async (item) => {
      const key = legacyListKeyName(item);
      if (!key) return;
      result.scanned++;

      if (!isMigratableKey(key)) {
        result.skippedInvalid++;
        return;
      }

      try {
        if (!options?.overwrite) {
          const existing = await blobStorage.get(key, { type: 'arrayBuffer' });
          if (existing !== null) {
            result.skippedExisting++;
            return;
          }
        }

        const value = await readLegacyValue(kv, key);
        await blobStorage.put(key, value);
        result.copied++;
      } catch (error) {
        result.failed++;
        if (result.errors.length < 20) {
          result.errors.push({ key, message: errorMessage(error) });
        }
      }
    });

    if (result.failed > 0) {
      result.cursor = encodeBatchCursor(prefixIndex, currentCursor);
      return result;
    }

    if (list.complete === false && list.cursor) {
      result.cursor = encodeBatchCursor(prefixIndex, list.cursor);
      return result;
    }

    prefixIndex++;
    kvCursor = undefined;

    if (keys.length > 0) {
      result.complete = prefixIndex >= MIGRATION_PREFIXES.length;
      result.cursor = result.complete ? '' : encodeBatchCursor(prefixIndex);
      if (result.complete) await writeMigrationMarker(result);
      return result;
    }
  }

  result.complete = true;
  result.cursor = '';
  await writeMigrationMarker(result);
  return result;
}
