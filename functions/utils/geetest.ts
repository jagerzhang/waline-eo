/**
 * Geetest CAPTCHA v4 validation
 * Docs: https://docs.geetest.com/captcha/apirefer/api/server
 */

export interface GeetestParams {
  captchaId: string;
  captchaKey: string;
  lotNumber: string;
  passToken: string;
  genTime: string;
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateGeetest(params: GeetestParams): Promise<boolean> {
  try {
    const signToken = await hmacSha256(params.captchaKey, params.lotNumber);

    const body = new URLSearchParams();
    body.append('lot_number', params.lotNumber);
    body.append('captcha_id', params.captchaId);
    body.append('pass_token', params.passToken);
    body.append('gen_time', params.genTime);
    body.append('sign_token', signToken);

    const resp = await fetch('https://gcaptcha4.geetest.com/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) return false;
    const data = (await resp.json()) as any;
    return data.status === 'success' && data.result === 'success';
  } catch {
    return false;
  }
}
