import { md5 } from './hash.js';

const avatarCache = new Map<string, string>();

/**
 * Gravatar avatar URL generation.
 * Falls back to default avatar if MD5 hashing is unavailable.
 */
export async function getAvatar(email: string): Promise<string> {
  if (!email) return '';
  const normalized = email.trim().toLowerCase();
  const cached = avatarCache.get(normalized);
  if (cached !== undefined) return cached;

  try {
    const hash = await md5(normalized);
    const avatar = `https://cravatar.cn/avatar/${hash}?d=mp`;
    avatarCache.set(normalized, avatar);
    return avatar;
  } catch {
    const fallback = 'https://cravatar.cn/avatar/?d=mp';
    avatarCache.set(normalized, fallback);
    return fallback;
  }
}
