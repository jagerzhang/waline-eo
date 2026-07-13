import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import {
  getAllSettings,
  deleteSetting,
  getSetting as kvGetSetting,
  getSettings as kvGetSettings,
  setSettings,
} from '../db/kv-store.js';
import { sendMail } from '../utils/mail.js';

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
  // Basic settings (migrated from env)
  'site_name',
  'site_url',
  'author_email',
  'ipqps',
  'comment_audit',
  'akismet_key',
  'disable_region',
  'disable_useragent',
  // Content moderation
  'forbidden_words',
  // SMTP
  'smtp_service',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_secure',
  'sender_name',
  'sender_email',
  'mail_subject',
  'mail_template',
  'mail_subject_admin',
  'mail_template_admin',
  // PushPlus
  'push_plus_key',
  'push_plus_topic',
  'push_plus_template',
  'push_plus_channel',
  'push_plus_webhook',
  'push_plus_callbackurl',
  // Image upload
  'image_upload_type',
  'qiniu_access_key',
  'qiniu_secret_key',
  'qiniu_bucket',
  'qiniu_domain',
  'upyun_operator',
  'upyun_password',
  'upyun_bucket',
  'upyun_domain',
]);

const SENSITIVE_KEYS = new Set([
  'smtp_pass', 'push_plus_key', 'push_plus_webhook',
  'qiniu_access_key', 'qiniu_secret_key', 'upyun_password', 'geetest_captcha_key',
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
    if (SENSITIVE_KEYS.has(key)) {
      settings[key] = '';
      settings[`${key}_configured`] = value ? 'true' : 'false';
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
    if (SENSITIVE_KEYS.has(key) && value === null) {
      await deleteSetting(key);
      continue;
    }
    if (SENSITIVE_KEYS.has(key) && String(value) === '') continue;
    toSave[key] = String(value);
  }

  if (Object.keys(toSave).length > 0) {
    await setSettings(toSave);
  }

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * POST /api/settings/test-mail - Send a test email with current SMTP config
 */
settingsRoutes.post('/test-mail', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const body = await c.req.json();
  const to = (body.to || '').trim();
  if (!to) {
    return c.json({ errno: 1, errmsg: '请填写测试收件邮箱' }, 400);
  }

  const settingKeys = [
    'smtp_service', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
    'sender_name', 'sender_email',
  ];
  const kvSettings = await kvGetSettings(settingKeys);
  const cfg = (key: string) => kvSettings[key] || (c.env as any)[key.toUpperCase()] || '';

  const mailConfig = {
    smtpService: cfg('smtp_service'),
    smtpHost: cfg('smtp_host'),
    smtpPort: cfg('smtp_port'),
    smtpSecure: cfg('smtp_secure'),
    smtpUser: cfg('smtp_user'),
    smtpPass: cfg('smtp_pass'),
    senderName: cfg('sender_name'),
    senderEmail: cfg('sender_email'),
  };

  if (!cfg('smtp_user') || !cfg('smtp_pass')) {
    return c.json({ errno: 1, errmsg: 'SMTP 用户名或密码未配置，请先保存邮件设置' }, 400);
  }

  try {
    await sendMail(mailConfig, {
      to,
      subject: 'Waline SMTP 测试邮件',
      html: '<p>这是一封来自 <b>Waline On EdgeOne</b> 的 SMTP 测试邮件。</p><p>如果您收到此邮件，说明当前邮件配置正确，可以正常收发评论通知。</p>',
    });
    return c.json({ errno: 0, errmsg: '测试邮件已发送，请查收' });
  } catch (e: any) {
    return c.json({ errno: 1, errmsg: '发送失败：' + (e.message || String(e)) });
  }
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
