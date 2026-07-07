import { getStore, type BlobInput, type BlobResponseType, type SetOptions } from '@edgeone/pages-blob';

export interface StoragePutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: unknown;
  onlyIfNew?: boolean;
}

export interface StorageListResult {
  complete: boolean;
  cursor: string;
  keys: Array<{ key: string; name: string }>;
}

const STORE_NAME = 'waline';
const TTL_PREFIX = '__waline_ttl__/';

const store = getStore(STORE_NAME);

function ttlKey(key: string): string {
  return `${TTL_PREFIX}${encodeURIComponent(key)}`;
}

function normalizeInput(value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream): BlobInput {
  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return copy.buffer;
  }
  return value as BlobInput;
}

function resolveExpiresAt(options?: StoragePutOptions): number | null {
  const now = Date.now();
  if (typeof options?.expirationTtl === 'number' && options.expirationTtl > 0) {
    return now + options.expirationTtl * 1000;
  }
  if (typeof options?.expiration === 'number' && options.expiration > 0) {
    return options.expiration * 1000;
  }
  return null;
}

async function isExpired(key: string): Promise<boolean> {
  const raw = await store.get(ttlKey(key), { consistency: 'strong' });
  if (!raw) return false;

  const expiresAt = parseInt(raw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) return false;

  await Promise.allSettled([
    store.delete(key),
    store.delete(ttlKey(key)),
  ]);
  return true;
}

async function setExpiry(key: string, expiresAt: number | null): Promise<void> {
  if (expiresAt) {
    await store.set(ttlKey(key), String(expiresAt), { cacheControl: 'max-age=0' });
  } else {
    await store.delete(ttlKey(key));
  }
}

class BlobStorage {
  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
    options?: StoragePutOptions,
  ): Promise<void> {
    const expiresAt = resolveExpiresAt(options);
    const setOptions: SetOptions = {
      cacheControl: 'max-age=0',
      onlyIfNew: options?.onlyIfNew,
    };

    if (expiresAt) {
      await setExpiry(key, expiresAt);
      try {
        await store.set(key, normalizeInput(value), setOptions);
      } catch (error) {
        await store.delete(ttlKey(key)).catch(() => {});
        throw error;
      }
      return;
    }

    await store.set(key, normalizeInput(value), setOptions);
    await setExpiry(key, null);
  }

  async get(key: string): Promise<string | null>;
  async get(key: string, options: { type?: 'text' }): Promise<string | null>;
  async get<T = unknown>(key: string, options: { type: 'json' }): Promise<T | null>;
  async get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  async get(key: string, options: { type: 'blob' }): Promise<Blob | null>;
  async get(key: string, options: { type: 'stream' }): Promise<ReadableStream | null>;
  async get(
    key: string,
    options?: { type?: BlobResponseType },
  ): Promise<string | ArrayBuffer | ReadableStream | Blob | unknown | null> {
    if (await isExpired(key)) return null;
    const type = options?.type || 'text';
    return store.get(key, { type, consistency: 'strong' } as any);
  }

  async delete(key: string): Promise<void> {
    const results = await Promise.allSettled([
      store.delete(key),
      store.delete(ttlKey(key)),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      throw failed.reason;
    }
  }

  async list(config?: { prefix?: string; limit?: number; cursor?: string }): Promise<StorageListResult> {
    const options: {
      prefix?: string;
      limit?: number;
      cursor?: string;
      paginate: false;
      consistency: 'strong';
    } = {
      paginate: false,
      consistency: 'strong',
    };
    if (config?.prefix !== undefined) options.prefix = config.prefix;
    if (config?.limit !== undefined) options.limit = config.limit;
    if (config?.cursor !== undefined && config.cursor !== '') options.cursor = config.cursor;

    const result = await store.list(options);
    const keys = result.blobs
      .map((blob) => blob.key)
      .filter((key) => !key.startsWith(TTL_PREFIX))
      .map((key) => ({ key, name: key }));

    return {
      complete: !result.cursor,
      cursor: result.cursor || '',
      keys,
    };
  }
}

export const blobStorage = new BlobStorage();
