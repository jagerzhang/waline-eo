import { blobStorage } from './blob-storage.js';
import { getLegacyKV, legacyListKeyName, type LegacyKVNamespace } from './legacy-kv.js';

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export async function hasKvToBlobMigrationMarker(): Promise<boolean> {
  return (await blobStorage.get(MIGRATION_MARKER_KEY).catch(() => null)) !== null;
}

export async function migrateLegacyKvToBlob(
  env?: unknown,
  options?: { overwrite?: boolean },
): Promise<KvToBlobMigrationResult> {
  const kv = getLegacyKV(env);
  const result: KvToBlobMigrationResult = {
    available: !!kv,
    scanned: 0,
    copied: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    failed: 0,
    errors: [],
    markerWritten: false,
  };
  if (!kv) return result;

  const seen = new Set<string>();

  for (const prefix of MIGRATION_PREFIXES) {
    let cursor: string | undefined;
    do {
      const listOptions: { prefix: string; limit: number; cursor?: string } = { prefix, limit: 1000 };
      if (cursor) listOptions.cursor = cursor;

      const list = await kv.list(listOptions);
      const keys = list.keys || [];

      for (const item of keys) {
        const key = legacyListKeyName(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.scanned++;

        if (!isMigratableKey(key)) {
          result.skippedInvalid++;
          continue;
        }

        try {
          if (!options?.overwrite) {
            const existing = await blobStorage.get(key, { type: 'arrayBuffer' });
            if (existing !== null) {
              result.skippedExisting++;
              continue;
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
      }

      cursor = list.complete === false && list.cursor ? list.cursor : undefined;
    } while (cursor);
  }

  if (result.failed === 0) {
    await blobStorage.put(MIGRATION_MARKER_KEY, JSON.stringify({
      migratedAt: new Date().toISOString(),
      scanned: result.scanned,
      copied: result.copied,
      skippedExisting: result.skippedExisting,
      skippedInvalid: result.skippedInvalid,
    }));
    result.markerWritten = true;
  }

  return result;
}
