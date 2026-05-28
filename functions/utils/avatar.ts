import { md5 } from './hash.js';

/**
 * Gravatar avatar URL generation
 * Falls back to default avatar if MD5 hashing is unavailable
 */
export async function getAvatar(email: string): Promise<string> {
  if (!email) return '';
  try {
    const hash = await md5(email.trim().toLowerCase());
    return `https://cravatar.cn/avatar/${hash}?d=mp`;
  } catch {
    // MD5 may not be supported in all edge runtimes — use default avatar
    return 'https://cravatar.cn/avatar/?d=mp';
  }
}
