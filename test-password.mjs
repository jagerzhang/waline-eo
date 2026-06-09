/**
 * Local test to verify PBKDF2 hash/verify consistency
 * Uses Node.js crypto.webcrypto which should match V8 runtime behavior
 */

import { webcrypto } from 'node:crypto';

// Polyfill global crypto for the test
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

async function deriveKey(password, salt, iterations = ITERATIONS) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: KEY_LENGTH * 8 },
    true,
    ['sign'],
  );
}

function uint8ToBase64(arr) {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hashBuffer = await crypto.subtle.exportKey('raw', key);
  const hashArray = new Uint8Array(hashBuffer);
  return `$pbkdf2$${ITERATIONS}$${uint8ToBase64(salt)}$${uint8ToBase64(hashArray)}`;
}

async function verifyPassword(password, stored) {
  if (!stored.startsWith('$pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 5) return false;
  const iterations = parseInt(parts[2]);
  const salt = base64ToUint8(parts[3]);
  const expectedHash = base64ToUint8(parts[4]);

  const key = await deriveKey(password, salt, iterations);
  const actualHash = new Uint8Array(await crypto.subtle.exportKey('raw', key));

  if (actualHash.length !== expectedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

async function main() {
  const password = 'test123456';

  console.log('Hashing password...');
  const hash = await hashPassword(password);
  console.log('Hash:', hash);

  console.log('Verifying with correct password...');
  const valid1 = await verifyPassword(password, hash);
  console.log('Result:', valid1);

  console.log('Verifying with wrong password...');
  const valid2 = await verifyPassword('wrongpassword', hash);
  console.log('Result:', valid2);

  // Also test with some edge-case passwords
  const testPasswords = ['a', '中文密码', 'emoji🔐test', 'A'.repeat(100)];
  for (const pw of testPasswords) {
    const h = await hashPassword(pw);
    const v = await verifyPassword(pw, h);
    console.log(`Password "${pw.slice(0, 20)}..." hash verify:`, v);
  }
}

main().catch(console.error);
