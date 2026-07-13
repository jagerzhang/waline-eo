import type { Env } from '../env.js';

export function normalizeAllowedOrigin(value: string): string {
  return value.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

export function resolveAllowedOrigins(env: Env, kvSiteUrl = ''): string[] {
  const domains = [env.SECURE_DOMAINS || '', kvSiteUrl, env.SITE_URL || ''].filter(Boolean).join(',');
  return [...new Set(domains
    .split(',')
    .map((domain) => normalizeAllowedOrigin(domain.trim()))
    .filter(Boolean))];
}

export function isAllowedOrigin(origin: string, env: Env, kvSiteUrl = ''): boolean {
  if (!origin) return true;
  const allowed = resolveAllowedOrigins(env, kvSiteUrl);
  if (!allowed.length) return false;

  let host = '';
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
