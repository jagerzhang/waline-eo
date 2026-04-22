import { md5 } from './hash.js';

/**
 * Gravatar avatar URL generation
 */
export async function getAvatar(email: string): Promise<string> {
  if (!email) return '';
  const hash = await md5(email.trim().toLowerCase());
  return `https://cravatar.cn/avatar/${hash}?d=mp`;
}
