// testenv：偽 firebase-firestore
// データは testenv/server.py の /__fs/ に保存（全ユーザー共有＝本物の Firestore と同じく「みんなで 1 つ」）。
// LayCAT / pmboard が使う関数だけを実装：getFirestore / doc / collection / getDoc / getDocs / setDoc /
// updateDoc / deleteDoc / addDoc / query / where / orderBy / limit / onSnapshot / deleteField / serverTimestamp /
// arrayUnion / arrayRemove / increment
const T = window.__testenv;
const FS = { type: 'firestore', __testenv: true };

async function api(op, body) {
  const headers = { 'content-type': 'application/json' };
  if (T && T.user) headers['x-testenv-user'] = T.user.email;
  const r = await fetch('/__fs/' + op, { method: 'POST', headers, body: JSON.stringify(body) });
  let j = null;
  try { j = await r.json(); } catch (_) { j = {}; }
  if (!r.ok) {
    const e = new Error('[testenv firestore] ' + (j.message || j.error || r.status));
    e.code = j.error === 'not-found' ? 'not-found' : (j.error || 'unknown');
    e.name = 'FirebaseError';
    throw e;
  }
  return j;
}
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const split = s => String(s).split('/').filter(Boolean);
function autoId() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

export class DocumentReference {
  constructor(path) { this.type = 'document'; this.path = path; this.id = path.split('/').pop(); this.firestore = FS; }
  get parent() { return new CollectionReference(this.path.split('/').slice(0, -1).join('/')); }
  withConverter() { return this; }
}
export class CollectionReference {
  constructor(path) { this.type = 'collection'; this.path = path; this.id = path.split('/').pop(); this.firestore = FS; }
  get parent() { const p = this.path.split('/'); return p.length > 1 ? new DocumentReference(p.slice(0, -1).join('/')) : null; }
  withConverter() { return this; }
}
export class Query {
  constructor(coll, constraints) { this.type = 'query'; this._coll = coll; this._c = constraints || []; this.firestore = FS; }
  withConverter() { return this; }
}

function basePartsOf(base) {
  if (base instanceof CollectionReference || base instanceof DocumentReference) return split(base.path);
  return [];
}
export function getFirestore() { return FS; }
export function initializeFirestore() { return FS; }
export function doc(base, ...segs) {
  const parts = basePartsOf(base);
  if (base instanceof CollectionReference && segs.length === 0) segs = [autoId()];
  for (const s of segs) parts.push(...split(s));
  if (parts.length < 2 || parts.length % 2 !== 0) throw new Error('[testenv firestore] invalid document reference: ' + parts.join('/'));
  return new DocumentReference(parts.join('/'));
}
export function collection(base, ...segs) {
  const parts = basePartsOf(base);
  for (const s of segs) parts.push(...split(s));
  if (parts.length % 2 !== 1) throw new Error('[testenv firestore] invalid collection reference: ' + parts.join('/'));
  return new CollectionReference(parts.join('/'));
}

export class DocumentSnapshot {
  constructor(ref, exists, data) { this.ref = ref; this.id = ref.id; this._exists = !!exists; this._data = data; this.metadata = { fromCache: false, hasPendingWrites: false }; }
  exists() { return this._exists; }
  data() { return this._exists ? clone(this._data) : undefined; }
  get(field) {
    let cur = this._data;
    for (const p of String(field).split('.')) { if (!cur || typeof cur !== 'object') return undefined; cur = cur[p]; }
    return clone(cur);
  }
}
export class QueryDocumentSnapshot extends DocumentSnapshot {}
export class QuerySnapshot {
  constructor(query, docs) { this.query = query; this.docs = docs; this.size = docs.length; this.empty = docs.length === 0; this.metadata = { fromCache: false }; }
  forEach(cb, thisArg) { this.docs.forEach(cb, thisArg); }
  docChanges() { return this.docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })); }
}

export function where(field, op, value) { return { kind: 'where', field: String(field), op, value }; }
export function orderBy(field, dir) { return { kind: 'orderBy', field: String(field), dir: dir || 'asc' }; }
export function limit(n) { return { kind: 'limit', n }; }
export function documentId() { return '__name__'; }
export function query(base, ...constraints) {
  if (base instanceof Query) return new Query(base._coll, [...base._c, ...constraints]);
  return new Query(base, constraints);
}

export function deleteField() { return { __fsop: 'deleteField' }; }
export function serverTimestamp() { return { __fsop: 'serverTimestamp' }; }
export function arrayUnion(...values) { return { __fsop: 'arrayUnion', values: clone(values) }; }
export function arrayRemove(...values) { return { __fsop: 'arrayRemove', values: clone(values) }; }
export function increment(n) { return { __fsop: 'increment', n }; }

export async function getDoc(ref) {
  const j = await api('get', { path: ref.path });
  return new DocumentSnapshot(ref, j.exists, j.data);
}
export const getDocFromServer = getDoc;
export async function getDocs(q) {
  const coll = q instanceof Query ? q._coll : q;
  const cs = q instanceof Query ? q._c : [];
  const body = {
    coll: coll.path,
    wheres: cs.filter(c => c.kind === 'where').map(c => [c.field, c.op, clone(c.value)]),
    orderBy: cs.filter(c => c.kind === 'orderBy').map(c => [c.field, c.dir]),
  };
  const lim = cs.find(c => c.kind === 'limit');
  if (lim) body.limit = lim.n;
  const j = await api('query', body);
  const docs = j.docs.map(d => new QueryDocumentSnapshot(new DocumentReference(coll.path + '/' + d.id), true, d.data));
  return new QuerySnapshot(q, docs);
}
export const getDocsFromServer = getDocs;
export async function setDoc(ref, data, opts) {
  await api('set', { path: ref.path, data: clone(data), merge: !!(opts && (opts.merge || opts.mergeFields)) });
}
export async function updateDoc(ref, data, ...rest) {
  let obj = data;
  if (typeof data === 'string') { obj = { [data]: rest[0] }; for (let i = 1; i + 1 < rest.length; i += 2) obj[rest[i]] = rest[i + 1]; }
  await api('update', { path: ref.path, data: clone(obj) });
}
export async function deleteDoc(ref) { await api('delete', { path: ref.path }); }
export async function addDoc(coll, data) {
  const j = await api('add', { coll: coll.path, data: clone(data) });
  return new DocumentReference(j.path);
}

/* onSnapshot：本物はサーバープッシュだが、testenv では 2 秒ごとのポーリングで近似する */
export function onSnapshot(ref, a, b, c) {
  let next = a, error = b;
  if (a && typeof a === 'object' && !(typeof a === 'function')) {
    if (typeof a.next === 'function') { next = a.next.bind(a); error = a.error && a.error.bind(a); }
    else { next = b; error = c; } /* (ref, options, next, error) */
  }
  let stopped = false, last = null, timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const snap = ref instanceof DocumentReference ? await getDoc(ref) : await getDocs(ref);
      const sig = ref instanceof DocumentReference
        ? JSON.stringify([snap.exists(), snap._data])
        : JSON.stringify(snap.docs.map(d => [d.id, d._data]));
      if (sig !== last) { last = sig; if (typeof next === 'function') next(snap); }
    } catch (e) { if (typeof error === 'function') error(e); }
    if (!stopped) timer = setTimeout(tick, 2000);
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

export class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds || 0; }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
}
