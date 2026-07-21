/*
 * LayCAT R2 プロキシ Worker
 * ---------------------------------------------------------------
 * ブラウザから直接 R2 を触らせず、Firebase Auth の ID トークンを
 * 検証してから R2 (env.R2) を叩くゲートウェイ。
 *
 * ルート:
 *   OPTIONS *                                → CORS プリフライト
 *   GET     /api/r2/projects/<pid>/<path>    → R2 GET
 *   PUT     /api/r2/projects/<pid>/<path>    → R2 PUT（body そのまま）
 *   DELETE  /api/r2/projects/<pid>/<path>    → R2 DELETE
 *   GET     /api/r2/list/projects/<pid>/     → R2 LIST（prefix）
 *   DELETE  /api/r2/purge/projects/<pid>/    → R2 LIST→DELETE 全消し
 *
 * 認可（2段階）:
 *   段階1：LayCAT グローバル許可（laynaAccess）
 *   - Authorization: Bearer <Firebase ID token>
 *   - トークンの aud/iss/exp/署名を検証（Firebase 公開鍵）
 *   - email が Firestore `laynaAccess/config.allowedEmails`
 *     または allowedDomains か、`laynaAccess/invited` に含まれるかを確認
 *   段階2：プロジェクト単位 ACL（_access.json）
 *   - projects/<pid>/_access.json を読み、{owner, members: [emails]} で判定
 *   - owner または members に自分のメールが含まれていれば OK
 *   - laynaAccess の adminEmails なら常時許可（admin エスカレーション：owner 不在時の緊急対応）
 *   - _access.json が無い場合はブートストラップ（初回 PUT のみ許可、body に自分を owner として指定必須）
 *   - key の先頭が `projects/<pid>/` に一致することを検証
 *
 * ファイルサイズ上限（PUT 時に content-length で検査、超過は 413）:
 *   - JSON 系（*.json）：MAX_JSON_BYTES（既定 10MB）
 *   - それ以外（動画・画像・etc）：MAX_MEDIA_BYTES（既定 500MB）
 *   - 絶対上限：MAX_ANY_BYTES（既定 2GB。安全網）
 *
 * 監査ログ:
 *   全リクエスト（OPTIONS 除く）で method/path/email/status/duration を console.log
 *   Cloudflare ダッシュボード → Workers → laycat-r2-api → Logs で追跡可能。
 *
 * 環境変数（wrangler.toml or secret）:
 *   [vars]  FIREBASE_PROJECT_ID    Firebase の projectId
 *   [vars]  ALLOW_ORIGIN           カンマ区切り許可オリジン
 *   [vars]  MAX_JSON_BYTES         JSON ファイルの最大サイズ（省略時 10MB）
 *   [vars]  MAX_MEDIA_BYTES        メディアファイルの最大サイズ（省略時 500MB）
 *   [vars]  MAX_ANY_BYTES          全ファイル共通の絶対上限（省略時 2GB）
 *   secret  FIREBASE_SERVICE_ACCOUNT  Firestore を読むための SA JSON（1行）
 *   binding R2                     R2 バケット
 */

const KEY_PREFIX = 'projects/';
const ACCESS_JSON_NAME = '_access.json';
const DEFAULT_MAX_JSON = 10 * 1024 * 1024;      // 10 MB
const DEFAULT_MAX_MEDIA = 500 * 1024 * 1024;    // 500 MB
const DEFAULT_MAX_ANY = 2 * 1024 * 1024 * 1024; // 2 GB

function sizeLimitFor(env, key) {
  const isJson = /\.json$/i.test(key);
  const maxJson = parseInt(env.MAX_JSON_BYTES || '0', 10) || DEFAULT_MAX_JSON;
  const maxMedia = parseInt(env.MAX_MEDIA_BYTES || '0', 10) || DEFAULT_MAX_MEDIA;
  const maxAny = parseInt(env.MAX_ANY_BYTES || '0', 10) || DEFAULT_MAX_ANY;
  const cat = isJson ? maxJson : maxMedia;
  return Math.min(cat, maxAny);
}

// ---------- プロジェクト ACL ----------
// projects/<pid>/_access.json を読んで、そのプロジェクトの owner/members を判定する。
// _access.json が無い場合は「未初期化プロジェクト」として、ブートストラップ許可の判定に使う。
const _aclCache = new Map(); // pid -> { at, access }
async function loadProjectAccess(env, pid) {
  const cached = _aclCache.get(pid);
  if (cached && (Date.now() - cached.at) < 30 * 1000) return cached.access;
  const key = KEY_PREFIX + pid + '/' + ACCESS_JSON_NAME;
  try {
    const obj = await env.R2.get(key);
    if (!obj) { _aclCache.set(pid, { at: Date.now(), access: null }); return null; }
    const txt = await obj.text();
    const parsed = JSON.parse(txt);
    _aclCache.set(pid, { at: Date.now(), access: parsed });
    return parsed;
  } catch (_) {
    _aclCache.set(pid, { at: Date.now(), access: null });
    return null;
  }
}
function invalidateProjectAccess(pid) { _aclCache.delete(pid); }

// admin 判定：Firestore/access.json の adminEmails 合算（isAllowed と同じソース）
async function isAdminEmail(env, email) {
  if (!email) return false;
  const now = Date.now();
  // _accessCache は isAllowed 側で使っているグローバル。60秒キャッシュされている。
  if (!_accessCache.cfg || (now - _accessCache.at) > 60 * 1000) {
    _accessCache.cfg = await firestoreGetDoc(env, 'laynaAccess/config').catch(() => null);
    _accessCache.invited = await firestoreGetDoc(env, 'laynaAccess/invited').catch(() => null);
    _accessCache.json = await loadAccessJson(env);
    _accessCache.at = now;
  }
  const admins = [
    ...((_accessCache.cfg && fsField(_accessCache.cfg, 'adminEmails')) || []),
    ...((_accessCache.json && _accessCache.json.adminEmails) || []),
  ];
  const lower = email.toLowerCase();
  return admins.map(x => (x || '').toLowerCase()).includes(lower);
}

// 判定結果：
//   { allowed: true, reason: 'owner'|'member'|'admin' }
//   { allowed: false, reason: 'not-a-member' }
//   { allowed: false, reason: 'no-access-json' } … 未初期化。ブートストラップ許可の判断は呼び出し側で
async function checkProjectAcl(env, pid, email) {
  const access = await loadProjectAccess(env, pid);
  if (!access) return { allowed: false, reason: 'no-access-json' };
  const lower = String(email || '').toLowerCase();
  if (!lower) return { allowed: false, reason: 'no-email' };
  if (String(access.owner || '').toLowerCase() === lower) return { allowed: true, reason: 'owner' };
  const members = Array.isArray(access.members) ? access.members : [];
  if (members.map(m => String(m || '').toLowerCase()).includes(lower)) return { allowed: true, reason: 'member' };
  // admin エスカレーション：laynaAccess の adminEmails なら常時許可（owner 不在時の緊急対応用）
  if (await isAdminEmail(env, email)) return { allowed: true, reason: 'admin' };
  return { allowed: false, reason: 'not-a-member' };
}

// URL パスからプロジェクト ID を抽出（/api/r2/(list|purge)?/projects/<pid>/...）
function extractPidFromPath(path) {
  const m = path.match(/^\/api\/r2\/(?:list\/|purge\/)?projects\/([^/]+)\//);
  return m ? m[1] : null;
}

// ブートストラップ判定：_access.json が無いプロジェクトへの初回書き込みを許可するか
// - key が _access.json 自身であること
// - body に owner=<自分のメール> が含まれていること（他人を owner に指定できないように）
async function isBootstrapWrite(env, req, key, email) {
  if (!/\/_access\.json$/.test(key)) return { ok: false, reason: 'not-access-json' };
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

async function importCert(pem) {
  const der = pemToArrayBuffer(pem);
  // x509 pem をそのまま importKey で扱えるブラウザ/Worker は限定的なので、
  // Firebase 側は SPKI と JWK も返せるが x509 が来る。ここでは crypto.subtle が
  // 'spki' しか受け付けない環境向けに、cert 内の subjectPublicKeyInfo を切り出す。
  // Workers runtime は 'raw'/'pkcs8'/'spki'/'jwk' しかサポートしないため、
  // x509 は WebCrypto では直接読めない → 別実装として jwks エンドポイントを使う。
  throw new Error('use jwks path instead');
}

// Firebase は securetoken.google.com の JWKS も公開している
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
// laynaAccess/config, laynaAccess/invited を Service Account で読む
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

function fsField(doc, name) {
  const f = doc && doc.fields && doc.fields[name];
  if (!f) return null;
  if (f.arrayValue) return (f.arrayValue.values || []).map(v => v.stringValue || v.integerValue || null);
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  return null;
}

// _accessCache は VeryLow-cost で 60 秒だけ持つ（Worker インスタンス生存中のみ）
let _accessCache = { at: 0, cfg: null, invited: null, json: null };

// LayCAT 本体と同じく、GitHub Pages に置いた access.json をフォールバックとして参照する。
// 本体の判定は「access.json → Firestore で上書き」の順なので、Worker 側でも両方参照する。
async function loadAccessJson(env) {
  try {
    const origin = ((env.ALLOW_ORIGIN || '').split(',')[0] || '').trim().replace(/\/$/, '');
    if (!origin) return null;
    const r = await fetch(origin + '/lay_cat/access.json', { cf: { cacheTtl: 60 } });
    if (!r.ok) {
      // GitHub Pages のリポジトリ配下でない場合のフォールバック
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

  // Firestore 側の authRequired = false は明示的な認証オフ扱い
  const authRequired = cfg ? fsField(cfg, 'authRequired') : (json ? json.authRequired : true);
  if (authRequired === false) return true;

  // access.json と Firestore の許可リストを合算して評価（本体と同じ挙動）
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
  // laynaAccess/invited は emails マップ ({[key]: {email, ...}}) 形式で保存されているので Map 展開する
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
  return false;
}

// ---------- CORS ----------
function corsHeaders(env, req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = allowed.includes('*') || allowed.includes(origin) ? origin : (allowed[0] || '');
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
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
    // 監査ログ：全リクエスト（OPTIONS 除く）で終端の直前に呼ぶ
    // Cloudflare Workers Logs（ダッシュボード → Workers → Logs）で表示される
    const audit = (status, extra) => {
      try {
        const dur = Date.now() - start;
        const ex = extra ? ' ' + extra : '';
        console.log('[audit] ' + new Date().toISOString() + ' ' + req.method + ' ' + path + ' email=' + auditEmail + ' status=' + status + ' dur=' + dur + 'ms' + ex);
      } catch (_) {}
    };
    const respond = (resp, extra) => { audit(resp.status, extra); return resp; };

    if (req.method === 'OPTIONS') {
      // preflight は数が多いので audit 対象外（ノイズ抑制）
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }

    // 認証
    let payload;
    try {
      const auth = req.headers.get('authorization') || '';
      if (!auth.startsWith('Bearer ')) throw new Error('no bearer');
      payload = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return respond(json(env, req, { error: 'unauthorized', detail: String(e.message || e) }, 401), 'auth_fail=' + String(e.message || e).slice(0, 40));
    }
    auditEmail = (payload && payload.email) || '-';
    try {
      const ok = await isAllowed(payload.email, env);
      if (!ok) return respond(json(env, req, { error: 'forbidden' }, 403));
    } catch (e) {
      return respond(json(env, req, { error: 'access-check-failed', detail: String(e.message || e) }, 500), 'access_err=' + String(e.message || e).slice(0, 40));
    }

    // プロジェクト単位の ACL チェック（R2 プロジェクトへのアクセスは owner/members のみ許可）
    // /api/r2/... で pid を含む URL に対して事前判定する
    const pid = extractPidFromPath(path);
    let aclResult = null;
    let willBootstrap = false;
    if (pid) {
      aclResult = await checkProjectAcl(env, pid, payload.email);
      if (!aclResult.allowed) {
        if (aclResult.reason === 'no-access-json') {
          // 未初期化プロジェクト：_access.json の初回 PUT のみ許可（body に自分を owner として指定）
          // それ以外の操作（他ファイルの GET/PUT/DELETE）は 403 で拒否
          // これにより、任意の pid でプレフィックスを乗っ取ることを防ぐ
          const keyM = path.match(/^\/api\/r2\/(projects\/[^/]+\/.+)$/);
          const key = keyM ? keyM[1] : '';
          const boot = await isBootstrapWrite(env, req, key, payload.email);
          if (!boot.ok) {
            return respond(json(env, req, { error: 'project-not-initialized', detail: boot.reason }, 403), 'pid=' + pid + ' bootstrap_fail=' + boot.reason);
          }
          willBootstrap = true;
        } else {
          return respond(json(env, req, { error: 'not-a-project-member', pid }, 403), 'pid=' + pid + ' acl=' + aclResult.reason);
        }
      }
    }

    // /api/r2/mine — 自分がアクセスできる R2 プロジェクト一覧を返す
    // バケット全体の projects/*/_access.json を LIST → 各 _access.json を読み、
    // 自分が owner/member（or admin）に含まれるプロジェクトのメタを返す
    if (path === '/api/r2/mine' && req.method === 'GET') {
      const isAdminUser = await isAdminEmail(env, payload.email);
      const me = String(payload.email || '').toLowerCase();
      const results = [];
      const seen = new Set();
      let cursor = undefined;
      // limit 1000 で反復。プロジェクト数が数千を超えるまで問題にならない想定
      while (true) {
        const list = await env.R2.list({ prefix: KEY_PREFIX, cursor, limit: 1000 });
        // _access.json だけに絞る
        const accessKeys = list.objects.filter(o => /^projects\/[^/]+\/_access\.json$/.test(o.key));
        // 並列取得（負荷平準のため 10 並列まで）
        for (let i = 0; i < accessKeys.length; i += 10) {
          const batch = accessKeys.slice(i, i + 10);
          const parsed = await Promise.all(batch.map(async o => {
            const pid = o.key.match(/^projects\/([^/]+)\/_access\.json$/)[1];
            if (seen.has(pid)) return null;
            seen.add(pid);
            try {
              const obj = await env.R2.get(o.key);
              if (!obj) return null;
              const access = JSON.parse(await obj.text());
              const isOwner = String(access.owner || '').toLowerCase() === me;
              const isMember = (access.members || []).map(x => String(x || '').toLowerCase()).includes(me);
              if (!isOwner && !isMember && !isAdminUser) return null;
              return {
                pid,
                owner: access.owner || null,
                members: access.members || [],
                role: isOwner ? 'owner' : (isMember ? 'member' : 'admin'),
              };
            } catch (_) { return null; }
          }));
          for (const p of parsed) if (p) results.push(p);
        }
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      return respond(json(env, req, { projects: results }), 'count=' + results.length);
    }

    // /api/r2/list/projects/<pid>/
    let m = path.match(/^\/api\/r2\/list\/(projects\/[^/]+\/.*)$/);
    if (m && req.method === 'GET') {
      const prefix = m[1];
      const list = await env.R2.list({ prefix });
      return respond(json(env, req, {
        objects: list.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        truncated: list.truncated,
      }), 'count=' + list.objects.length);
    }

    // /api/r2/purge/projects/<pid>/
    m = path.match(/^\/api\/r2\/purge\/(projects\/[^/]+\/)$/);
    if (m && req.method === 'DELETE') {
      const prefix = m[1];
      let cursor = undefined, total = 0;
      while (true) {
        const list = await env.R2.list({ prefix, cursor });
        if (!list.objects.length) break;
        await Promise.all(list.objects.map(o => env.R2.delete(o.key)));
        total += list.objects.length;
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      if (pid) invalidateProjectAccess(pid); // プロジェクト消滅により ACL キャッシュも破棄
      return respond(json(env, req, { deleted: total }), 'purged=' + total + ' prefix=' + prefix);
    }

    // /api/r2/projects/<pid>/<path>
    m = path.match(/^\/api\/r2\/(projects\/[^/]+\/.+)$/);
    if (m) {
      const key = m[1];
      if (!key.startsWith(KEY_PREFIX)) return respond(json(env, req, { error: 'invalid-key' }, 400));

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
        // ファイルサイズ検査：content-length ヘッダで事前に判断
        const cl = parseInt(req.headers.get('content-length') || '0', 10);
        const limit = sizeLimitFor(env, key);
        if (cl > 0 && cl > limit) {
          return respond(json(env, req, { error: 'payload-too-large', limit, size: cl }, 413), 'key=' + key + ' size=' + cl + ' limit=' + limit);
        }
        const contentType = req.headers.get('x-laycat-content-type') || req.headers.get('content-type') || 'application/octet-stream';
        await env.R2.put(key, req.body, { httpMetadata: { contentType } });
        // _access.json への書き込みなら ACL キャッシュを無効化（次回チェックで最新を読む）
        if (/\/_access\.json$/.test(key) && pid) invalidateProjectAccess(pid);
        return respond(json(env, req, { ok: true, key, bootstrap: willBootstrap || undefined }), 'key=' + key + ' size=' + cl + (willBootstrap ? ' bootstrap=1' : ''));
      }
      if (req.method === 'DELETE') {
        await env.R2.delete(key);
        return respond(json(env, req, { ok: true, key }), 'key=' + key);
      }
      return respond(json(env, req, { error: 'method-not-allowed' }, 405));
    }

    return respond(json(env, req, { error: 'not-found' }, 404));
  },
};
