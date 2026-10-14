/*
 * LayCAT R2 プロキシ Worker（マルチテナント対応版 / v2.0.0）
 * ---------------------------------------------------------------
 * ブラウザから直接 R2 を触らせず、Firebase Auth の ID トークンを
 * 検証してから R2 (env.R2) を叩くゲートウェイ。
 *
 * === v2.0.0 変更点（マルチテナント化・2026-10-14） ===
 *   - R2 キー構造: projects/<pid>/...  →  tenants/<tid>/projects/<pid>/...
 *   - URL パス: /api/r2/projects/<pid>/...  →  /api/r2/tenants/<tid>/projects/<pid>/...
 *   - 認可追加: テナントメンバーシップ（Firestore tenants/<tid>/members/<emailKey>）
 *   - tid 種別: 法人テナント ID / 'operator'（運営） / 'personal__<emailKey>'（個人）
 *   - /api/r2/mine: 返却形式 [{tid, pid, name, role, ...}] に変更
 *   - laycatMemberships エントリに tid を追加記録
 *
 * ルート:
 *   OPTIONS *                                          → CORS プリフライト
 *   GET     /api/r2/tenants/<tid>/projects/<pid>/<path>  → R2 GET
 *   PUT     /api/r2/tenants/<tid>/projects/<pid>/<path>  → R2 PUT（body そのまま）
 *   DELETE  /api/r2/tenants/<tid>/projects/<pid>/<path>  → R2 DELETE
 *   GET     /api/r2/list/tenants/<tid>/projects/<pid>/   → R2 LIST（prefix）
 *   DELETE  /api/r2/purge/tenants/<tid>/projects/<pid>/  → R2 LIST→DELETE 全消し
 *   GET     /api/r2/mine                               → 参加可能プロジェクト一覧
 *   POST    /api/r2/rebuild-memberships                → 運営専用：Firestore 再構築
 *
 * 認可（3段階）:
 *   段階1：LayCAT グローバル許可（laynaAccess） — 変更なし
 *   段階2：テナント許可
 *     (a) tid = 'personal__<emailKey>' かつ emailKey が自分のもの → 許可
 *     (b) tid = 'operator' かつ自分が operatorEmails → 許可
 *     (c) Firestore tenants/<tid>/members/<myEmailKey> が存在 → 許可
 *   段階3：プロジェクト ACL（_access.json） — 変更なし
 *     - owner / members に自分が含まれる → 許可（クロステナント ゲスト用）
 *     - operatorEmails → 常時許可（運営エスカレーション）
 *   段階1〜3 のいずれかで許可されれば OK。
 *
 * tid の形式検証：
 *   - 'operator'（固定）
 *   - 'personal__<emailKey>'（emailKey は laycatUsers と同じ正規化）
 *   - その他は Firestore tenants/<tid> が存在する必要あり（自動検証はしない。無効 tid でもメンバー不在で 403 になる）
 *   - URL 入力制限: /^[a-zA-Z0-9_-]+$/
 *
 * ファイルサイズ上限（PUT 時に content-length で検査、超過は 413）:
 *   - JSON 系（*.json）：MAX_JSON_BYTES（既定 10MB）
 *   - それ以外（動画・画像・etc）：MAX_MEDIA_BYTES（既定 500MB）
 *   - 絶対上限：MAX_ANY_BYTES（既定 2GB。安全網）
 *
 * 環境変数:
 *   [vars]  FIREBASE_PROJECT_ID    Firebase の projectId
 *   [vars]  ALLOW_ORIGIN           カンマ区切り許可オリジン
 *   [vars]  MAX_JSON_BYTES         JSON ファイルの最大サイズ（省略時 10MB）
 *   [vars]  MAX_MEDIA_BYTES        メディアファイルの最大サイズ（省略時 500MB）
 *   [vars]  MAX_ANY_BYTES          全ファイル共通の絶対上限（省略時 2GB）
 *   secret  FIREBASE_SERVICE_ACCOUNT  Firestore を読み書きするための SA JSON（1行）
 *   binding R2                     R2 バケット
 */

const TENANT_PREFIX = 'tenants/';
const ACCESS_JSON_NAME = '_access.json';
const DEFAULT_MAX_JSON = 10 * 1024 * 1024;      // 10 MB
const DEFAULT_MAX_MEDIA = 500 * 1024 * 1024;    // 500 MB
const DEFAULT_MAX_ANY = 2 * 1024 * 1024 * 1024; // 2 GB

const OPERATOR_TID = 'operator';
const PERSONAL_TID_PREFIX = 'personal__';
const TID_FORMAT = /^[a-zA-Z0-9_-]+$/;
const PID_FORMAT = /^[a-zA-Z0-9_-]+$/;

function sizeLimitFor(env, key) {
  const isJson = /\.json$/i.test(key);
  const maxJson = parseInt(env.MAX_JSON_BYTES || '0', 10) || DEFAULT_MAX_JSON;
  const maxMedia = parseInt(env.MAX_MEDIA_BYTES || '0', 10) || DEFAULT_MAX_MEDIA;
  const maxAny = parseInt(env.MAX_ANY_BYTES || '0', 10) || DEFAULT_MAX_ANY;
  const cat = isJson ? maxJson : maxMedia;
  return Math.min(cat, maxAny);
}

// メールを Firestore ドキュメント ID として使うためのキー化（access-console と同じ変換規則）
function memberKeyFromEmail(email) {
  return String(email || '').toLowerCase().replace(/[.@#$/]/g, '_');
}

// ---------- URL パス抽出 ----------
// path から { tid, pid, kind, keySuffix } を抽出する。
//   kind: 'object' | 'list' | 'purge' | null
//   keySuffix: /tenants/<tid>/projects/<pid>/<path> の <path> 部分
function parseTenantPath(path) {
  // /api/r2/tenants/<tid>/projects/<pid>/<path>
  let m = path.match(/^\/api\/r2\/tenants\/([^/]+)\/projects\/([^/]+)\/(.+)$/);
  if (m) return { tid: m[1], pid: m[2], kind: 'object', keySuffix: m[3] };
  // /api/r2/list/tenants/<tid>/projects/<pid>/<path>?
  m = path.match(/^\/api\/r2\/list\/tenants\/([^/]+)\/projects\/([^/]+)\/(.*)$/);
  if (m) return { tid: m[1], pid: m[2], kind: 'list', keySuffix: m[3] };
  // /api/r2/purge/tenants/<tid>/projects/<pid>/
  m = path.match(/^\/api\/r2\/purge\/tenants\/([^/]+)\/projects\/([^/]+)\/$/);
  if (m) return { tid: m[1], pid: m[2], kind: 'purge', keySuffix: '' };
  return null;
}

function tenantPrefix(tid) { return TENANT_PREFIX + tid + '/'; }
function projectPrefix(tid, pid) { return tenantPrefix(tid) + 'projects/' + pid + '/'; }
function r2KeyFor(tid, pid, suffix) { return projectPrefix(tid, pid) + (suffix || ''); }

function isValidTid(tid) {
  if (!tid || typeof tid !== 'string') return false;
  if (tid.length > 200) return false;
  return TID_FORMAT.test(tid);
}
function isValidPid(pid) {
  if (!pid || typeof pid !== 'string') return false;
  if (pid.length > 200) return false;
  return PID_FORMAT.test(pid);
}

// ---------- プロジェクト ACL ----------
// tenants/<tid>/projects/<pid>/_access.json を読んで owner/members を判定。
const _aclCache = new Map(); // "<tid>|<pid>" -> { at, access }
function aclKey(tid, pid) { return tid + '|' + pid; }
async function loadProjectAccess(env, tid, pid) {
  const ck = aclKey(tid, pid);
  const cached = _aclCache.get(ck);
  if (cached && (Date.now() - cached.at) < 30 * 1000) return cached.access;
  const key = r2KeyFor(tid, pid, ACCESS_JSON_NAME);
  try {
    const obj = await env.R2.get(key);
    if (!obj) { _aclCache.set(ck, { at: Date.now(), access: null }); return null; }
    const txt = await obj.text();
    const parsed = JSON.parse(txt);
    _aclCache.set(ck, { at: Date.now(), access: parsed });
    return parsed;
  } catch (_) {
    _aclCache.set(ck, { at: Date.now(), access: null });
    return null;
  }
}
function invalidateProjectAccess(tid, pid) { _aclCache.delete(aclKey(tid, pid)); }

// ---------- 運営・laynaAccess 判定 ----------
let _accessCache = { at: 0, cfg: null, invited: null, json: null };

function _isOperator(email) {
  const lower = String(email || '').toLowerCase();
  if (!lower) return false;
  const emails = [
    ...((_accessCache.cfg && fsField(_accessCache.cfg, 'operatorEmails')) || []),
    ...((_accessCache.json && _accessCache.json.operatorEmails) || []),
  ];
  return emails.some(e => String(e || '').toLowerCase() === lower);
}
async function isStaffEmail(env, email) {
  if (!email) return false;
  const now = Date.now();
  if (!_accessCache.cfg || (now - _accessCache.at) > 60 * 1000) {
    _accessCache.cfg = await firestoreGetDoc(env, 'laynaAccess/config').catch(() => null);
    _accessCache.invited = await firestoreGetDoc(env, 'laynaAccess/invited').catch(() => null);
    _accessCache.json = await loadAccessJson(env);
    _accessCache.at = now;
  }
  return _isOperator(email);
}
const isAdminEmail = isStaffEmail;

// ---------- テナントメンバーシップ判定 ----------
// Firestore tenants/<tid>/members/<emailKey> の存在を確認（キャッシュ 60s）
const _tenantMemberCache = new Map(); // "<tid>|<emailKey>" -> { at, isMember }
async function isTenantMember(env, tid, email) {
  if (!tid || !email) return false;
  const emailKey = memberKeyFromEmail(email);
  const ck = tid + '|' + emailKey;
  const now = Date.now();
  const cached = _tenantMemberCache.get(ck);
  if (cached && (now - cached.at) < 60 * 1000) return cached.isMember;
  try {
    const doc = await firestoreGetDoc(env, `tenants/${tid}/members/${emailKey}`);
    const isMember = !!doc;
    _tenantMemberCache.set(ck, { at: now, isMember });
    return isMember;
  } catch (_) {
    _tenantMemberCache.set(ck, { at: now, isMember: false });
    return false;
  }
}

// personal__<emailKey> の判定：tid が自分の emailKey に一致するか
function isOwnPersonalTenant(tid, email) {
  if (!tid || !tid.startsWith(PERSONAL_TID_PREFIX)) return false;
  const tidKey = tid.slice(PERSONAL_TID_PREFIX.length);
  const myKey = memberKeyFromEmail(email);
  return tidKey === myKey;
}

// 判定結果：
//   { allowed: true, reason: 'owner'|'member'|'tenant-member'|'personal-self'|'operator' }
//   { allowed: false, reason: 'not-a-member' | 'no-access-json' | 'invalid-tid' | 'invalid-pid' }
async function checkTenantAndProjectAcl(env, tid, pid, email) {
  if (!isValidTid(tid)) return { allowed: false, reason: 'invalid-tid', access: null };
  if (!isValidPid(pid)) return { allowed: false, reason: 'invalid-pid', access: null };

  // (a) personal__<emailKey> 自分のもの
  if (isOwnPersonalTenant(tid, email)) {
    const access = await loadProjectAccess(env, tid, pid);
    return { allowed: true, reason: 'personal-self', access };
  }

  // (b) operator tid かつ自分が operator
  if (tid === OPERATOR_TID && await isStaffEmail(env, email)) {
    const access = await loadProjectAccess(env, tid, pid);
    return { allowed: true, reason: 'operator-tid', access };
  }

  // (c) 法人テナントメンバー
  if (!tid.startsWith(PERSONAL_TID_PREFIX) && tid !== OPERATOR_TID) {
    if (await isTenantMember(env, tid, email)) {
      const access = await loadProjectAccess(env, tid, pid);
      return { allowed: true, reason: 'tenant-member', access };
    }
  }

  // (d) _access.json ベース（クロステナント ゲスト対応）
  const access = await loadProjectAccess(env, tid, pid);
  if (!access) return { allowed: false, reason: 'no-access-json', access: null };
  const lower = String(email || '').toLowerCase();
  if (String(access.owner || '').toLowerCase() === lower) return { allowed: true, reason: 'owner', access };
  const members = Array.isArray(access.members) ? access.members : [];
  if (members.map(m => String(m || '').toLowerCase()).includes(lower)) return { allowed: true, reason: 'member', access };

  // (e) 運営エスカレーション（owner 不在時の緊急対応）
  if (await isStaffEmail(env, email)) return { allowed: true, reason: 'operator-escalation', access };

  return { allowed: false, reason: 'not-a-member', access };
}

// ブートストラップ：_access.json が無い新規プロジェクトの初回 PUT のみ許可（owner=自分で body 指定）
async function isBootstrapWrite(env, req, keySuffix, email) {
  if (keySuffix !== ACCESS_JSON_NAME) return { ok: false, reason: 'not-access-json' };
  if (req.method !== 'PUT') return { ok: false, reason: 'not-put' };
  try {
    const clone = req.clone();
    const body = await clone.json();
    const bodyOwner = String((body && body.owner) || '').toLowerCase();
    if (bodyOwner !== String(email || '').toLowerCase()) {
      return { ok: false, reason: 'owner-mismatch' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'invalid-body' };
  }
}

// ---------- 公開鍵キャッシュ ----------
let _keysCache = { at: 0, keys: null };
async function getGooglePublicKeys() {
  const now = Date.now();
  if (_keysCache.keys && (now - _keysCache.at) < 60 * 60 * 1000) return _keysCache.keys;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('failed to fetch google public keys');
  const j = await r.json();
  _keysCache = { at: now, keys: j };
  return j;
}

// ---------- 小物 ----------
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function b64urlDecodeText(s) {
  const u8 = b64urlDecode(s);
  return new TextDecoder().decode(u8);
}
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '');
  return b64urlDecode(b64.replace(/\+/g, '-').replace(/\//g, '_'));
}

let _jwksCache = { at: 0, keys: null };
async function getFirebaseJWKS() {
  const now = Date.now();
  if (_jwksCache.keys && (now - _jwksCache.at) < 60 * 60 * 1000) return _jwksCache.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('failed to fetch jwks');
  const j = await r.json();
  _jwksCache = { at: now, keys: j.keys || [] };
  return _jwksCache.keys;
}

async function verifyIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = JSON.parse(b64urlDecodeText(parts[0]));
  const payload = JSON.parse(b64urlDecodeText(parts[1]));
  const sig = b64urlDecode(parts[2]);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token expired');
  if (payload.iat && payload.iat > now + 300) throw new Error('token iat in future');
  if (payload.aud !== projectId) throw new Error('aud mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('iss mismatch');
  if (!payload.sub) throw new Error('no sub');

  const jwks = await getFirebaseJWKS();
  const jwk = jwks.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid not found');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signedBytes = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signedBytes);
  if (!ok) throw new Error('signature invalid');
  return payload;
}

// ---------- Firestore access check ----------
let _saTokenCache = { at: 0, token: null };
async function getSaAccessToken(env) {
  const now = Date.now();
  if (_saTokenCache.token && (now - _saTokenCache.at) < 50 * 60 * 1000) return _saTokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat, exp: iat + 3600,
  };
  const enc = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = enc(header) + '.' + enc(claim);
  const pkPem = sa.private_key;
  const pkDer = pemToArrayBuffer(pkPem);
  const key = await crypto.subtle.importKey('pkcs8', pkDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign)));
  let sigB64 = btoa(String.fromCharCode(...sig)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = toSign + '.' + sigB64;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
  });
  if (!r.ok) throw new Error('sa token exchange failed: ' + r.status);
  const j = await r.json();
  _saTokenCache = { at: now, token: j.access_token };
  return j.access_token;
}

async function firestoreGetDoc(env, path) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore get failed: ' + r.status);
  return r.json();
}

function _jsToFields(data) {
  const fields = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (v == null) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number' && Number.isInteger(v)) fields[k] = { integerValue: String(v) };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else fields[k] = { stringValue: JSON.stringify(v) };
  }
  return fields;
}
async function firestoreCreateDoc(env, collection, data) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: _jsToFields(data) }),
  });
  if (!r.ok) throw new Error('firestore create failed: ' + r.status);
  return r.json();
}
async function firestoreSetDoc(env, docPath, data) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: _jsToFields(data) }),
  });
  if (!r.ok) throw new Error('firestore set failed: ' + r.status + ' ' + await r.text().catch(() => ''));
  return r.json();
}
async function firestoreDeleteDoc(env, docPath) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const r = await fetch(url, { method: 'DELETE', headers: { authorization: 'Bearer ' + token } });
  if (!r.ok && r.status !== 404) throw new Error('firestore delete failed: ' + r.status);
  return r.ok;
}
async function firestoreListIds(env, collectionPath) {
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=1000`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('firestore list failed: ' + r.status);
  const j = await r.json();
  const docs = j.documents || [];
  return docs.map(d => (d.name || '').split('/').pop()).filter(Boolean);
}

// ---------- メンバーシップ表（laycatMemberships/{emailKey}/projects/{pid}）----------
// R2 バケット全体を LIST しなくても「自分がアクセスできるプロジェクト」を取得できるインデックス。
// _access.json 書込／削除／purge 時に同期。
// v2.0.0 で tid フィールドを追加（従来の email, pid, role に加えて tid を記録）。
async function upsertMembership(env, email, tid, pid, role) {
  if (!email || !pid) return;
  const emailKey = memberKeyFromEmail(email);
  const docPath = `laycatMemberships/${emailKey}/projects/${pid}`;
  await firestoreSetDoc(env, docPath, {
    email: String(email).toLowerCase(),
    tid: String(tid || ''),
    pid,
    role: role || 'member',
    updatedAt: new Date().toISOString(),
  });
}
async function deleteMembership(env, email, pid) {
  if (!email || !pid) return;
  const emailKey = memberKeyFromEmail(email);
  const docPath = `laycatMemberships/${emailKey}/projects/${pid}`;
  await firestoreDeleteDoc(env, docPath).catch(() => null);
}
async function syncMembershipsForProject(env, tid, pid, oldAccess, newAccess) {
  const oldOwner = (oldAccess && oldAccess.owner || '').toLowerCase();
  const oldMembers = new Set(((oldAccess && oldAccess.members) || []).map(x => String(x || '').toLowerCase()).filter(Boolean));
  if (oldOwner) oldMembers.add(oldOwner);
  const newOwner = (newAccess && newAccess.owner || '').toLowerCase();
  const newMembers = new Set(((newAccess && newAccess.members) || []).map(x => String(x || '').toLowerCase()).filter(Boolean));
  if (newOwner) newMembers.add(newOwner);
  const promises = [];
  for (const email of newMembers) {
    const role = (email === newOwner) ? 'owner' : 'member';
    promises.push(upsertMembership(env, email, tid, pid, role).catch(e => console.log('[membership-upsert-fail] ' + email + '/' + pid + ': ' + e.message)));
  }
  for (const email of oldMembers) {
    if (!newMembers.has(email)) {
      promises.push(deleteMembership(env, email, pid).catch(e => console.log('[membership-delete-fail] ' + email + '/' + pid + ': ' + e.message)));
    }
  }
  await Promise.all(promises);
}
async function purgeProjectMemberships(env, pid, accessJson) {
  const members = new Set(((accessJson && accessJson.members) || []).map(x => String(x || '').toLowerCase()).filter(Boolean));
  const owner = String(accessJson && accessJson.owner || '').toLowerCase();
  if (owner) members.add(owner);
  await Promise.all([...members].map(e => deleteMembership(env, e, pid).catch(() => null)));
}
// 自分のメンバーシップ一覧を取得（{pid, tid, role} の配列）
async function listMyMemberships(env, email) {
  const emailKey = memberKeyFromEmail(email);
  const token = await getSaAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/laycatMemberships/${emailKey}/projects?pageSize=1000`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('firestore list failed: ' + r.status);
  const j = await r.json();
  const docs = j.documents || [];
  return docs.map(d => {
    const pid = (d.name || '').split('/').pop();
    const tid = fsField(d, 'tid') || '';
    const role = fsField(d, 'role') || 'member';
    return { pid, tid, role };
  }).filter(x => x.pid);
}

// 自分のテナント ID を Firestore laycatUsers/<emailKey>.tenantId から取得（operator 系の決定は Worker 側ではしない）
async function getMyTenantId(env, email) {
  const emailKey = memberKeyFromEmail(email);
  const doc = await firestoreGetDoc(env, `laycatUsers/${emailKey}`).catch(() => null);
  if (!doc) return null;
  return fsField(doc, 'tenantId') || null;
}

// 自分のテナント配下の全プロジェクト ID を R2 LIST して取得
async function listTenantProjects(env, tid) {
  if (!tid || !isValidTid(tid)) return [];
  const prefix = tenantPrefix(tid) + 'projects/';
  const found = new Set();
  let cursor = undefined;
  while (true) {
    const list = await env.R2.list({ prefix, cursor, limit: 1000 });
    for (const o of list.objects) {
      const m = o.key.match(/^tenants\/[^/]+\/projects\/([^/]+)\//);
      if (m) found.add(m[1]);
    }
    if (!list.truncated) break;
    cursor = list.cursor;
  }
  return [...found];
}

function fsField(doc, name) {
  const f = doc && doc.fields && doc.fields[name];
  if (!f) return null;
  if (f.arrayValue) return (f.arrayValue.values || []).map(v => v.stringValue || v.integerValue || null);
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  return null;
}

async function loadAccessJson(env) {
  try {
    const origin = ((env.ALLOW_ORIGIN || '').split(',')[0] || '').trim().replace(/\/$/, '');
    if (!origin) return null;
    const r = await fetch(origin + '/lay_cat/access.json', { cf: { cacheTtl: 60 } });
    if (!r.ok) {
      const r2 = await fetch(origin + '/access.json', { cf: { cacheTtl: 60 } });
      if (!r2.ok) return null;
      return await r2.json();
    }
    return await r.json();
  } catch (_) { return null; }
}

async function isAllowed(email, env) {
  if (!email) return false;
  const now = Date.now();
  if (!_accessCache.cfg || (now - _accessCache.at) > 60 * 1000) {
    const cfg = await firestoreGetDoc(env, 'laynaAccess/config').catch(() => null);
    const invited = await firestoreGetDoc(env, 'laynaAccess/invited').catch(() => null);
    const json = await loadAccessJson(env);
    _accessCache = { at: now, cfg, invited, json };
  }
  const cfg = _accessCache.cfg;
  const invited = _accessCache.invited;
  const json = _accessCache.json;

  const authRequired = cfg ? fsField(cfg, 'authRequired') : (json ? json.authRequired : true);
  if (authRequired === false) return true;

  const admins = [
    ...((cfg && fsField(cfg, 'adminEmails')) || []),
    ...((json && json.adminEmails) || []),
  ];
  const allowed = [
    ...((cfg && fsField(cfg, 'allowedEmails')) || []),
    ...((json && json.allowedEmails) || []),
  ];
  const domains = [
    ...((cfg && fsField(cfg, 'allowedDomains')) || []),
    ...((json && json.allowedDomains) || []),
  ];
  const invitedListRaw = (invited && invited.fields && invited.fields.emails);
  const invitedList = [];
  if (invitedListRaw && invitedListRaw.mapValue && invitedListRaw.mapValue.fields) {
    for (const k of Object.keys(invitedListRaw.mapValue.fields)) {
      const f = invitedListRaw.mapValue.fields[k];
      if (f && f.mapValue && f.mapValue.fields && f.mapValue.fields.email) {
        const e = f.mapValue.fields.email.stringValue;
        if (e) invitedList.push(e);
      }
    }
  } else if (Array.isArray(invitedListRaw)) {
    invitedList.push(...invitedListRaw);
  }

  const lower = email.toLowerCase();
  if (admins.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  if (allowed.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  if (invitedList.map(x => (x || '').toLowerCase()).includes(lower)) return true;
  const dom = lower.split('@')[1];
  if (dom && domains.map(x => (x || '').toLowerCase()).includes(dom)) return true;

  // v2.0.1：マルチテナント対応。テナントに所属しているアカウントは自動許可。
  //   addTenantMember が laycatUsers/<emailKey>.tenantId を同期しているので、
  //   そのフィールドが入っていれば「どこかのテナントに所属するアカウント」と判定できる。
  //   これにより運営が laynaAccess の allowlist に手動追加しなくても、
  //   テナント管理者が招待したメンバーは自動的に SaaS を使えるようになる。
  //   個別プロジェクトのアクセス権は後続の checkTenantAndProjectAcl が別途判定するので、
  //   ここで通ってもテナント／プロジェクト境界は壊れない。
  if (await _isTenantAffiliated(env, email)) return true;
  return false;
}

// v2.0.1：laycatUsers/<emailKey>.tenantId が入っていれば true。
//   キャッシュは _tenantAffiliationCache（60 秒 TTL）。
const _tenantAffiliationCache = new Map(); // email_lower -> { at, ok }
async function _isTenantAffiliated(env, email) {
  const lower = String(email || '').toLowerCase();
  if (!lower) return false;
  const now = Date.now();
  const hit = _tenantAffiliationCache.get(lower);
  if (hit && (now - hit.at) < 60 * 1000) return hit.ok;
  let ok = false;
  try {
    const emailKey = memberKeyFromEmail(lower);
    const doc = await firestoreGetDoc(env, 'laycatUsers/' + emailKey).catch(() => null);
    const tid = doc ? fsField(doc, 'tenantId') : null;
    if (tid && String(tid).length > 0) ok = true;
  } catch (_) { ok = false; }
  _tenantAffiliationCache.set(lower, { at: now, ok });
  return ok;
}

// ---------- CORS ----------
function corsHeaders(env, req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = allowed.includes('*') || allowed.includes(origin) ? origin : (allowed[0] || '');
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET,PUT,DELETE,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-laycat-content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function json(env, req, obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json', ...corsHeaders(env, req) },
  });
}

// ---------- Router ----------
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const start = Date.now();
    let auditEmail = '-';
    const clientIp = req.headers.get('cf-connecting-ip') || '-';
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 200);
    const audit = (status, extra) => {
      try {
        const dur = Date.now() - start;
        const ex = extra ? ' ' + extra : '';
        console.log('[audit] ' + new Date().toISOString() + ' ' + req.method + ' ' + path + ' email=' + auditEmail + ' status=' + status + ' dur=' + dur + 'ms' + ex);
        const method = req.method;
        const shouldLog = (method === 'PUT' || method === 'DELETE' || method === 'POST' || status >= 400);
        if (shouldLog && ctx && typeof ctx.waitUntil === 'function') {
          const parsed = parseTenantPath(path);
          const tid = parsed ? parsed.tid : '-';
          const pid = parsed ? parsed.pid : '-';
          const key = parsed ? r2KeyFor(parsed.tid, parsed.pid, parsed.keySuffix) : path;
          const entry = {
            ts: new Date().toISOString(),
            method, path, key, tid, pid,
            email: auditEmail, ip: clientIp, ua: userAgent,
            status, dur, extra: extra || '',
          };
          ctx.waitUntil(firestoreCreateDoc(env, 'laynaAudit', entry).catch(e => {
            console.log('[audit-write-fail] ' + String(e && e.message || e));
          }));
        }
      } catch (_) {}
    };
    const respond = (resp, extra) => { audit(resp.status, extra); return resp; };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }

    // 認証（Firebase ID token）
    let payload;
    try {
      const auth = req.headers.get('authorization') || '';
      if (!auth.startsWith('Bearer ')) throw new Error('no bearer');
      payload = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return respond(json(env, req, { error: 'unauthorized', detail: String(e.message || e) }, 401), 'auth_fail=' + String(e.message || e).slice(0, 40));
    }
    auditEmail = (payload && payload.email) || '-';

    // laynaAccess グローバル許可
    try {
      const ok = await isAllowed(payload.email, env);
      if (!ok) return respond(json(env, req, { error: 'forbidden' }, 403));
    } catch (e) {
      return respond(json(env, req, { error: 'access-check-failed', detail: String(e.message || e) }, 500), 'access_err=' + String(e.message || e).slice(0, 40));
    }

    // /api/r2/mine — 参加可能プロジェクト一覧
    if (path === '/api/r2/mine' && req.method === 'GET') {
      const isAdminUser = await isStaffEmail(env, payload.email);
      const me = String(payload.email || '').toLowerCase();

      // (1) laycatMemberships から自分が明示メンバーのプロジェクト（クロステナント ゲスト含む）
      let memberships = [];
      try {
        memberships = await listMyMemberships(env, me);
      } catch (e) {
        return respond(json(env, req, { error: 'membership-list-failed', detail: String(e.message || e) }, 500), 'ms_list_fail');
      }

      // (2) 自分のテナント配下の全プロジェクト（memberships 以外でもテナントメンバーなら見える）
      // operator は 'operator' テナントを常に見られる。
      const myTid = await getMyTenantId(env, me).catch(() => null);
      const personalTid = PERSONAL_TID_PREFIX + memberKeyFromEmail(me);
      const tidsToScan = new Set();
      if (myTid && isValidTid(myTid)) tidsToScan.add(myTid);
      tidsToScan.add(personalTid);
      if (isAdminUser) tidsToScan.add(OPERATOR_TID);

      const tenantPids = new Map(); // pid -> tid（membership に無いが見える分）
      for (const scanTid of tidsToScan) {
        try {
          const pids = await listTenantProjects(env, scanTid);
          for (const pid of pids) {
            if (!tenantPids.has(pid)) tenantPids.set(pid, scanTid);
          }
        } catch (_) { /* 権限がない or 存在しないテナントはスキップ */ }
      }

      // (3) membership と tenantPids を合算して解決
      const seen = new Set();
      const results = [];
      for (const ms of memberships) {
        if (seen.has(ms.pid)) continue;
        seen.add(ms.pid);
        try {
          const access = await loadProjectAccess(env, ms.tid, ms.pid);
          if (!access) continue; // ゴースト（_access.json 消滅）はスキップ
          const isOwner = String(access.owner || '').toLowerCase() === me;
          const isMember = (access.members || []).map(x => String(x || '').toLowerCase()).includes(me);
          results.push({
            tid: ms.tid, pid: ms.pid,
            owner: access.owner || null,
            members: access.members || [],
            role: isOwner ? 'owner' : (isMember ? 'member' : (ms.role || 'member')),
          });
        } catch (_) { /* skip */ }
      }
      for (const [pid, tid] of tenantPids) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        try {
          const access = await loadProjectAccess(env, tid, pid);
          const owner = access ? (access.owner || null) : null;
          const members = access ? (access.members || []) : [];
          results.push({
            tid, pid, owner, members,
            role: 'tenant-member',
          });
        } catch (_) { /* skip */ }
      }
      return respond(json(env, req, { projects: results, source: 'tenant-aware' }), 'count=' + results.length);
    }

    // /api/r2/rebuild-memberships — 運営専用（既存 _access.json から Firestore 再構築）
    if (path === '/api/r2/rebuild-memberships' && req.method === 'POST') {
      const isStaff = await isStaffEmail(env, payload.email);
      if (!isStaff) return respond(json(env, req, { error: 'staff-only' }, 403), 'not_staff');
      let cursor = undefined, scanned = 0, ok = 0, fail = 0;
      // tenants/<tid>/projects/<pid>/_access.json を全走査
      while (true) {
        const list = await env.R2.list({ prefix: TENANT_PREFIX, cursor, limit: 1000 });
        const accessKeys = list.objects.filter(o => /^tenants\/[^/]+\/projects\/[^/]+\/_access\.json$/.test(o.key));
        scanned += accessKeys.length;
        for (let i = 0; i < accessKeys.length; i += 5) {
          const batch = accessKeys.slice(i, i + 5);
          await Promise.all(batch.map(async o => {
            const km = o.key.match(/^tenants\/([^/]+)\/projects\/([^/]+)\/_access\.json$/);
            if (!km) { fail++; return; }
            const tid = km[1], pid = km[2];
            try {
              const obj = await env.R2.get(o.key);
              if (!obj) { fail++; return; }
              const access = JSON.parse(await obj.text());
              await syncMembershipsForProject(env, tid, pid, null, access);
              ok++;
            } catch (e) {
              console.log('[rebuild-fail] tid=' + tid + ' pid=' + pid + ': ' + String(e.message || e));
              fail++;
            }
          }));
        }
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      return respond(json(env, req, { ok: true, scanned, synced: ok, failed: fail }), 'rebuild scanned=' + scanned + ' ok=' + ok + ' fail=' + fail);
    }

    // /api/r2/tenants/<tid>/projects/<pid>/... のパース
    const parsed = parseTenantPath(path);
    if (!parsed) {
      return respond(json(env, req, { error: 'not-found' }, 404));
    }
    const { tid, pid, kind, keySuffix } = parsed;
    if (!isValidTid(tid)) return respond(json(env, req, { error: 'invalid-tid' }, 400));
    if (!isValidPid(pid)) return respond(json(env, req, { error: 'invalid-pid' }, 400));

    // テナント＋プロジェクト ACL
    const aclResult = await checkTenantAndProjectAcl(env, tid, pid, payload.email);
    let willBootstrap = false;
    if (!aclResult.allowed) {
      if (aclResult.reason === 'no-access-json' && kind === 'object') {
        const boot = await isBootstrapWrite(env, req, keySuffix, payload.email);
        if (!boot.ok) {
          return respond(json(env, req, { error: 'project-not-initialized', detail: boot.reason }, 403), 'tid=' + tid + ' pid=' + pid + ' bootstrap_fail=' + boot.reason);
        }
        // ブートストラップは tid の種類別に追加検証
        if (tid.startsWith(PERSONAL_TID_PREFIX)) {
          if (!isOwnPersonalTenant(tid, payload.email)) {
            return respond(json(env, req, { error: 'personal-tid-mismatch' }, 403), 'tid=' + tid);
          }
        } else if (tid === OPERATOR_TID) {
          if (!(await isStaffEmail(env, payload.email))) {
            return respond(json(env, req, { error: 'operator-tid-needs-staff' }, 403), 'tid=' + tid);
          }
        } else {
          if (!(await isTenantMember(env, tid, payload.email))) {
            return respond(json(env, req, { error: 'not-a-tenant-member' }, 403), 'tid=' + tid);
          }
        }
        willBootstrap = true;
      } else {
        return respond(json(env, req, { error: 'not-a-project-member', tid, pid }, 403), 'tid=' + tid + ' pid=' + pid + ' acl=' + aclResult.reason);
      }
    }

    // list
    if (kind === 'list' && req.method === 'GET') {
      const prefix = r2KeyFor(tid, pid, keySuffix);
      const list = await env.R2.list({ prefix });
      return respond(json(env, req, {
        objects: list.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        truncated: list.truncated,
      }), 'count=' + list.objects.length);
    }

    // purge
    if (kind === 'purge' && req.method === 'DELETE') {
      const prefix = projectPrefix(tid, pid);
      const preAccess = aclResult && aclResult.access ? aclResult.access : null;
      let cursor = undefined, total = 0;
      while (true) {
        const list = await env.R2.list({ prefix, cursor });
        if (!list.objects.length) break;
        await Promise.all(list.objects.map(o => env.R2.delete(o.key)));
        total += list.objects.length;
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      invalidateProjectAccess(tid, pid);
      if (ctx && typeof ctx.waitUntil === 'function' && preAccess) {
        ctx.waitUntil(purgeProjectMemberships(env, pid, preAccess).catch(e => {
          console.log('[purge-membership-fail] tid=' + tid + ' pid=' + pid + ': ' + String(e.message || e));
        }));
      }
      return respond(json(env, req, { deleted: total }), 'purged=' + total + ' prefix=' + prefix);
    }

    // object (GET / PUT / DELETE)
    if (kind === 'object') {
      const key = r2KeyFor(tid, pid, keySuffix);

      if (req.method === 'GET') {
        const obj = await env.R2.get(key);
        if (!obj) return respond(json(env, req, { error: 'not-found' }, 404), 'key=' + key);
        const h = new Headers(corsHeaders(env, req));
        obj.writeHttpMetadata(h);
        if (!h.get('content-type')) h.set('content-type', 'application/octet-stream');
        h.set('etag', obj.httpEtag);
        audit(200, 'key=' + key + ' size=' + obj.size);
        return new Response(obj.body, { status: 200, headers: h });
      }
      if (req.method === 'PUT') {
        const cl = parseInt(req.headers.get('content-length') || '0', 10);
        const limit = sizeLimitFor(env, key);
        if (cl > 0 && cl > limit) {
          return respond(json(env, req, { error: 'payload-too-large', limit, size: cl }, 413), 'key=' + key + ' size=' + cl + ' limit=' + limit);
        }
        const contentType = req.headers.get('x-laycat-content-type') || req.headers.get('content-type') || 'application/octet-stream';
        const isAccessJson = (keySuffix === ACCESS_JSON_NAME);
        let bodyText = null;
        if (isAccessJson) {
          bodyText = await req.text();
          await env.R2.put(key, bodyText, { httpMetadata: { contentType } });
        } else {
          await env.R2.put(key, req.body, { httpMetadata: { contentType } });
        }
        if (isAccessJson) {
          invalidateProjectAccess(tid, pid);
          if (ctx && typeof ctx.waitUntil === 'function') {
            const oldAccess = aclResult && aclResult.access ? aclResult.access : null;
            let newAccess = null;
            try { newAccess = JSON.parse(bodyText); } catch (_) {}
            if (newAccess) {
              ctx.waitUntil(syncMembershipsForProject(env, tid, pid, oldAccess, newAccess).catch(e => {
                console.log('[membership-sync-fail] tid=' + tid + ' pid=' + pid + ': ' + String(e.message || e));
              }));
            }
          }
        }
        return respond(json(env, req, { ok: true, key, bootstrap: willBootstrap || undefined }), 'key=' + key + ' size=' + cl + (willBootstrap ? ' bootstrap=1' : ''));
      }
      if (req.method === 'DELETE') {
        const isAccessJson = (keySuffix === ACCESS_JSON_NAME);
        let oldAccess = null;
        if (isAccessJson) oldAccess = aclResult && aclResult.access ? aclResult.access : null;
        await env.R2.delete(key);
        if (isAccessJson) {
          invalidateProjectAccess(tid, pid);
          if (ctx && typeof ctx.waitUntil === 'function' && oldAccess) {
            ctx.waitUntil(purgeProjectMemberships(env, pid, oldAccess).catch(e => {
              console.log('[membership-purge-fail] tid=' + tid + ' pid=' + pid + ': ' + String(e.message || e));
            }));
          }
        }
        return respond(json(env, req, { ok: true, key }), 'key=' + key);
      }
      return respond(json(env, req, { error: 'method-not-allowed' }, 405));
    }

    return respond(json(env, req, { error: 'not-found' }, 404));
  },
};
