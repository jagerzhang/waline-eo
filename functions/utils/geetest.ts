/**
 * Geetest CAPTCHA v4 validation
 * Docs: https://docs.geetest.com/captcha/apirefer/api/server
 */

import { textBufferSource } from './crypto-source.js';

export interface GeetestParams {
  captchaId: string;
  captchaKey: string;
  lotNumber: string;
  captchaOutput: string;
  passToken: string;
  genTime: string;
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textBufferSource(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textBufferSource(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateGeetest(params: GeetestParams, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const signToken = await hmacSha256(params.captchaKey, params.lotNumber);

    const body = new URLSearchParams();
    body.append('lot_number', params.lotNumber);
    body.append('captcha_id', params.captchaId);
    body.append('captcha_output', params.captchaOutput);
    body.append('pass_token', params.passToken);
    body.append('gen_time', params.genTime);
    body.append('sign_token', signToken);

    const resp = await fetch('https://gcaptcha4.geetest.com/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!resp.ok) return false;
    const data = (await resp.json()) as any;
    return data.result === 'success' && (data.status === undefined || data.status === 'success');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
