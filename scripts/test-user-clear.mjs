// Offline check for clearUsers(): clearing must not delete the account that
// performs the operation, otherwise every later admin call returns 401.
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
      cursor: keys.length > l ? page[page.length - 1] : '',
      complete: keys.length <= l,
    };
  },
};

const B = path.resolve(process.cwd(), '.tmp-build/db/kv-store.js');
const { createUser, clearUsers, getUserById, getUserByEmail, getUserCount } =
  await import(pathToFileURL(B).href);

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '->', detail); }
};

const admin = await createUser({ email: 'im@zhang.ge', password: 'H1', type: 'administrator' });
const guestA = await createUser({ email: 'a@x.com', password: 'H2', type: 'guest' });
const guestB = await createUser({ email: 'b@x.com', password: 'H3', type: 'guest' });
console.log('created:', admin.id, guestA.id, guestB.id, '| count =', await getUserCount());

console.log('\n[case 1] clearUsers({ preserveAdmins: true })');
const r1 = await clearUsers({ preserveAdmins: true });
console.log('   result =', JSON.stringify(r1));
check('removed only the 2 guests', r1.removed === 2, r1.removed);
check('preserved the 1 admin', r1.preserved === 1, r1.preserved);
check('admin record still readable', (await getUserById(admin.id))?.type === 'administrator');
check('admin email index intact', (await getUserByEmail('im@zhang.ge'))?.id === admin.id);
check('admin password intact', (await getUserById(admin.id)).password === 'H1');
check('guest a gone', (await getUserById(guestA.id)) === null);
check('guest b gone', (await getUserById(guestB.id)) === null);
check('guest email index gone', (await getUserByEmail('a@x.com')) === null);
check('count reflects survivors', (await getUserCount()) === 1, await getUserCount());

console.log('\n[case 2] new user after a preserving clear does not collide');
const fresh = await createUser({ email: 'c@x.com', password: 'H4', type: 'guest' });
check('new id differs from admin id', fresh.id !== admin.id, fresh.id);

console.log('\n[case 3] clearUsers({}) / force -> removes everything');
const r3 = await clearUsers({});
console.log('   result =', JSON.stringify(r3));
check('removed the rest', r3.removed === 2, r3.removed);
check('nothing preserved', r3.preserved === 0, r3.preserved);
check('admin gone', (await getUserById(admin.id)) === null);
check('count is zero', (await getUserCount()) === 0, await getUserCount());

console.log('\n==== pass:', pass, 'fail:', fail, '====');
process.exit(fail ? 1 : 0);
