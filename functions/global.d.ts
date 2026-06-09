// ---------- KV Namespace type (EdgeOne Pages V8 runtime) ----------
interface ListResult {
  complete: boolean;
  cursor: string;
  keys: Array<ListKey>;
}
interface ListKey {
  key?: string;
  name?: string;
}
interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: unknown;
}
declare class KVNamespace {
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: KVPutOptions): Promise<void>;
  get(key: string): Promise<string | null>;
  get(key: string, object: { type: 'text' }): Promise<string | null>;
  get<T = unknown>(key: string, object: { type: 'json' }): Promise<T | null>;
  get(key: string, object: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  get(key: string, object: { type: 'stream' }): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
  list(config?: { prefix?: string; limit?: number; cursor?: string }): Promise<ListResult>;
}

// Global KV binding (configured in EdgeOne Pages console)
declare var WALINE_KV: KVNamespace;
