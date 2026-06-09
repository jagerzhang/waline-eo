/**
 * MD5 hash utility using Web Crypto API
 */
import { textBufferSource } from './crypto-source.js';

export async function md5(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('MD5', textBufferSource(text));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
