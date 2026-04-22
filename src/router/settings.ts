import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import {
  getAllSettings,
  getSetting as kvGetSetting,
  getSettings as kvGetSettings,
  setSettings,
} from '../db/kv-store.js';

export const settingsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const ALLOWED_KEYS = new Set([
  'waline_client_version',
  'comment_default_status',
  'user_comment_default_status',
  'worker_display',
  'llm_mode',
  'llm_skip_admin',
  'llm_endpoint',
  'llm_api_key',
  'llm_model',
  'llm_prompt',
]);

/**
 * GET /api/settings - Get all settings (admin only)
 */
settingsRoutes.get('/', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const allSettings = await getAllSettings(c.env.KV);

  // Sensitive keys that must be masked in API responses
  const MASKED_KEYS = new Set(['llm_api_key']);

  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(allSettings)) {
    if (MASKED_KEYS.has(key) && value) {
      // Show only first 3 and last 4 chars: "sk-****xxxx"
      settings[key] = value.length > 7
        ? value.slice(0, 3) + '****' + value.slice(-4)
        : '****';
    } else {
      settings[key] = value;
    }
  }

  return c.json({ errno: 0, errmsg: '', data: settings });
});

/**
 * PUT /api/settings - Update settings (admin only)
 * Body: { key: value, ... }
 */
settingsRoutes.put('/', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const body = await c.req.json();
  const toSave: Record<string, string> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    toSave[key] = String(value);
  }

  if (Object.keys(toSave).length > 0) {
    await setSettings(c.env.KV, toSave);
  }

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * Helper: Get a single setting value
 */
export async function getSetting(kv: KVNamespace, key: string): Promise<string | null> {
  return kvGetSetting(kv, key);
}

/**
 * Helper: Get multiple settings at once
 */
export async function getSettings(kv: KVNamespace, keys: string[]): Promise<Record<string, string>> {
  return kvGetSettings(kv, keys);
}
