// Offline check for upsertUserForImport(): an import must never drop or demote
// the account that performs the import.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const store = new Map();
globalThis.WALINE_KV = {
  async get(k) { const v = store.get(k); return v === undefined ? null : v; },
  async put(k, v) { store.set(k, String(v)); },
  async delete(k) { store.delete(k); },
  async list(o = {}) {
    const p = o.prefix || '';
    const l = o.limit || 1000;
    let keys = [...store.keys()].sort().filter((x) => x.startsWith(p));
    if (o.cursor) {
      const i = keys.indexOf(o.cursor);
      keys = i >= 0 ? keys.slice(i + 1) : [];
    }
    const page = keys.slice(0, l);
    return {
      keys: page.map((name) => ({ name })),
      cursor: keys.length > l ? page[page.length - 1] : undefined,
      list_complete: keys.length <= l,
    };
  },
};

const B = path.resolve(process.cwd(), '.tmp-build/db/kv-store.js');
const { createUser, upsertUserForImport, getUserById, getUserByEmail } =
  await import(pathToFileURL(B).href);

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '->', detail); }
};

// ---------------------------------------------------------------------------
console.log('\n[case 1] existing admin + import row with SAME email, DIFFERENT objectId');
const admin = await createUser({
  email: 'im@zhang.ge', display_name: 'Jager', password: 'HASH_CURRENT', type: 'administrator',
});
console.log('   admin id =', admin.id);

const merged = await upsertUserForImport({
  id: 99,
  email: 'im@zhang.ge',
  display_name: 'Jager From Old Site',
  password: 'HASH_FROM_IMPORT',
  type: 'guest',
  url: 'https://zhang.ge/',
});
console.log('   merged =', JSON.stringify({
  id: merged.id, email: merged.email, type: merged.type,
  password: merged.password, display_name: merged.display_name, url: merged.url,
}));

check('keeps existing objectId', merged.id === admin.id, 'got ' + merged.id);
check('does NOT demote administrator', merged.type === 'administrator', 'got ' + merged.type);
check('keeps current password', merged.password === 'HASH_CURRENT', 'got ' + merged.password);
check('adopts non-blank display_name', merged.display_name === 'Jager From Old Site', merged.display_name);
check('adopts non-blank url', merged.url === 'https://zhang.ge/', merged.url);
check('resolvable by id', !!(await getUserById(admin.id)));
check('resolvable by email', (await getUserByEmail('im@zhang.ge'))?.id === admin.id);

// ---------------------------------------------------------------------------
console.log('\n[case 2] import row with brand new email -> creates a new user, keeps admin');
const fresh = await upsertUserForImport({
  id: 500, email: 'someone@example.com', display_name: 'Someone', type: 'guest',
});
check('new user created with original objectId', fresh.id === 500, 'got ' + fresh.id);
check('new user resolvable by email',
  (await getUserByEmail('someone@example.com'))?.id === 500);
check('admin untouched', (await getUserById(admin.id))?.type === 'administrator');

// ---------------------------------------------------------------------------
console.log('\n[case 3] import row matching by objectId but a different email');
const u3 = await upsertUserForImport({
  id: admin.id, email: 'new-address@zhang.ge', display_name: 'Jager',
});
check('matched by objectId, no duplicate created', u3.id === admin.id, 'got ' + u3.id);
check('still administrator', u3.type === 'administrator', u3.type);
check('email updated', u3.email === 'new-address@zhang.ge', u3.email);
check('old email index removed', (await getUserByEmail('im@zhang.ge')) === null);
check('new email index works', (await getUserByEmail('new-address@zhang.ge'))?.id === admin.id);
check('password still intact', (await getUserById(admin.id)).password === 'HASH_CURRENT');

// ---------------------------------------------------------------------------
console.log('\n[case 4] import row carries a HIGHER role -> promoted');
const g = await createUser({ email: 'g@x.com', type: 'guest' });
const g2 = await upsertUserForImport({ id: g.id, email: 'g@x.com', type: 'administrator' });
check('guest promoted to administrator', g2.type === 'administrator', g2.type);

// ---------------------------------------------------------------------------
console.log('\n[case 5] blank fields in import must not wipe existing values');
const before = await upsertUserForImport({
  id: admin.id, email: 'new-address@zhang.ge', display_name: '', url: '', avatar: '',
});
check('display_name preserved', before.display_name === 'Jager', before.display_name);
check('url preserved', before.url === 'https://zhang.ge/', before.url);

// ---------------------------------------------------------------------------
console.log('\n[case 6] raw export row using objectId instead of id');
const u6 = await upsertUserForImport({
  objectId: admin.id, email: 'new-address@zhang.ge', display_name: 'Jager',
});
check('objectId fallback works', u6.id === admin.id, 'got ' + u6.id);

console.log('\n==== pass:', pass, 'fail:', fail, '====');
process.exit(fail ? 1 : 0);
