/**
 * Compare deriveBits vs deriveKey+exportKey for PBKDF2
 */

global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

import { webcrypto } from 'node:crypto';

const crypto = webcrypto;
const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

const password = 'test123';
const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

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

async function deriveBits(password, salt, iterations = ITERATIONS) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    KEY_LENGTH * 8,
  );
}

async function main() {
  const key = await deriveKey(password, salt);
  const keyRaw = await crypto.subtle.exportKey('raw', key);
  const bits = await deriveBits(password, salt);

  const keyArr = new Uint8Array(keyRaw);
  const bitsArr = new Uint8Array(bits);

  console.log('deriveKey raw length:', keyArr.length);
  console.log('deriveBits length:', bitsArr.length);
  console.log('Equal?', keyArr.every((v, i) => v === bitsArr[i]));
}

main().catch(console.error);
