export interface VerificationState {
  token: string;
  expiresAt: number;
}

export function generateNumericVerificationCode(length = 6): string {
  if (!Number.isInteger(length) || length < 4 || length > 12) {
    throw new Error('verification code length must be an integer between 4 and 12');
  }
  let result = '';
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - result.length));
    for (const byte of bytes) {
      // 丢弃 250~255，避免 byte % 10 的模偏差。
      if (byte >= 250) continue;
      result += String(byte % 10);
      if (result.length === length) break;
    }
  }
  return result;
}

export function parseVerificationState(value: string): VerificationState | null {
  const match = String(value || '').match(/^verify:(\d{6}):(\d+)$/i);
  if (!match) return null;
  const expiresAt = Number(match[2]);
  if (!Number.isFinite(expiresAt)) return null;
  return { token: match[1], expiresAt };
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = String(a || '');
  const right = String(b || '');
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < maxLength; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}
