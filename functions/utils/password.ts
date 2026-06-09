/**
 * Password hashing using Web Crypto API (PBKDF2)
 * Workers-compatible alternative to phpass/bcrypt
 * Also supports verifying bcrypt hashes from LeanCloud migration
 */

import bcrypt from 'bcryptjs';
import { bufferSource, textBufferSource } from './crypto-source.js';

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hashBuffer = await crypto.subtle.exportKey('raw', key) as ArrayBuffer;
  const hashArray = new Uint8Array(hashBuffer);

  // Format: $pbkdf2$iterations$base64salt$base64hash
  return `$pbkdf2$${ITERATIONS}$${uint8ToBase64(salt)}$${uint8ToBase64(hashArray)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored || typeof stored !== 'string') {
    return false;
  }

  // Support bcrypt format from LeanCloud migration
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compareSync(password, stored);
  }

  // Support phpass format from migrated data
  if (stored.startsWith('$P$') || stored.startsWith('$H$')) {
    return false;
  }

  if (!stored.startsWith('$pbkdf2$')) {
    return false;
  }

  const parts = stored.split('$');
  // parts: ['', 'pbkdf2', iterations, salt, hash]
  if (parts.length !== 5) return false;

  const iterations = parseInt(parts[2]);
  const salt = base64ToUint8(parts[3]);
  const expectedHash = base64ToUint8(parts[4]);

  // Primary: deriveBits (simpler, more direct)
  try {
    const actualHashBuffer = await deriveBits(password, salt, iterations);
    const actualHash = new Uint8Array(actualHashBuffer);
    if (actualHash.length === expectedHash.length) {
      let diff = 0;
      for (let i = 0; i < actualHash.length; i++) {
        diff |= actualHash[i] ^ expectedHash[i];
      }
      if (diff === 0) return true;
    }
  } catch {
    // deriveBits not supported on this runtime, continue to fallback
  }

  // Fallback: deriveKey+exportKey for hashes created by older code
  try {
    const key = await deriveKey(password, salt, iterations);
    const fallbackHash = new Uint8Array(await crypto.subtle.exportKey('raw', key) as ArrayBuffer);
    if (fallbackHash.length !== expectedHash.length) return false;
    let diff2 = 0;
    for (let i = 0; i < fallbackHash.length; i++) {
      diff2 |= fallbackHash[i] ^ expectedHash[i];
    }
    return diff2 === 0;
  } catch {
    return false;
  }
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations = ITERATIONS,
): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textBufferSource(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bufferSource(salt), iterations, hash: 'SHA-256' },
    baseKey,
    KEY_LENGTH * 8,
  );
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textBufferSource(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bufferSource(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: KEY_LENGTH * 8 },
    true,
    ['sign'],
  );
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
