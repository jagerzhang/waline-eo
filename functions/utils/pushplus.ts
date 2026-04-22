/**
 * PushPlus notification utility
 * Docs: https://www.pushplus.plus/doc/
 */

export interface PushPlusConfig {
  token?: string;
  topic?: string;
  template?: string;
  channel?: string;
  webhook?: string;
  callbackUrl?: string;
}

export async function sendPushPlus(config: PushPlusConfig, title: string, content: string): Promise<void> {
  if (!config.token) {
    throw new Error('PushPlus token is required');
  }

  const body: Record<string, any> = {
    token: config.token,
    title,
    content,
  };

  if (config.topic) body.topic = config.topic;
  if (config.template) body.template = config.template;
  if (config.channel) body.channel = config.channel;
  if (config.webhook) body.webhook = config.webhook;
  if (config.callbackUrl) body.callbackUrl = config.callbackUrl;

  const resp = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (data.code !== 200) {
    throw new Error(`PushPlus error: ${data.msg || JSON.stringify(data)}`);
  }
}
