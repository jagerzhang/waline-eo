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
  'geetest_captcha_id',
  'geetest_captcha_key',
]);

/**
 * GET /api/settings - Get all settings (admin only)
 */
settingsRoutes.get('/', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const allSettings = await getAllSettings();

  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(allSettings)) {
    settings[key] = value;
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
    await setSettings(toSave);
  }

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * Helper: Get a single setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  return kvGetSetting(key);
}

/**
 * Helper: Get multiple settings at once
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  return kvGetSettings(keys);
}
