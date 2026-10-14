/**
 * LayCAT R2 プロキシ Worker — 顧客自前版（lightweight edition）
 *
 * 【目的】
 *   顧客（テナント）が自前で Cloudflare アカウント＋ R2 バケットを用意して
 *   LayCAT のストレージを独立運用するための軽量 Worker。運営版（laycat-r2-api.js）
 *   から Firestore／Service Account／laynaAccess グローバル許可の依存を全て外した
 *   「Firebase 認証 ＋ _access.json ACL のみ」の最小構成。
 *
 * 【運営版との違い】
 *   - Firestore アクセス一切なし（SA JSON secret 不要）
 *   - laynaAccess グローバル許可の判定なし（_access.json のメンバーリストのみ）
 *   - テナントメンバーシップ同期なし（Firestore laycatMemberships を書かない）
 *   - URL ルートに tenants/<tid>/ プレフィックス無し（この R2 は 1 テナント専用の前提）
 *     - 顧客側は: /api/r2/projects/<pid>/<path>
 *     - 運営側は: /api/r2/tenants/<tid>/projects/<pid>/<path>
 *   - R2 key も projects/<pid>/<path>（tenants/<tid>/ 無し）
 *
 * 【認可】
 *   1. Firebase ID トークン（LayCAT 本体の laycat-54ee4 プロジェクト）を検証
 *   2. 対象プロジェクトの _access.json を R2 から読み、owner/members に自分が
 *      いれば allow、いなければ 403
 *   3. _access.json 未存在のプロジェクトは「ブートストラップ書き込み」として、
 *      PUT /_access.json の場合のみ本人が owner で書き始められる（最初のオーナー登録）
 *
 * 【セットアップ】
 *   wrangler.customer.toml.example を参照。R2 バケット作成＋ wrangler deploy のみ。
 *   secret 登録は不要。LayCAT 側の tenants/<tid>.r2Endpoint にこの Worker の URL を
 *   設定すれば、以降そのテナントの全プロジェクトがこの Worker 経由になる。
 *
 * 【URL 一覧】
 *   GET     /api/r2/mine                            → 参加可能プロジェクト一覧
 *   GET     /api/r2/projects/<pid>/<path>           → R2 GET
 *   PUT     /api/r2/projects/<pid>/<path>           → R2 PUT
 *   DELETE  /api/r2/projects/<pid>/<path>           → R2 DELETE
 *   GET     /api/r2/list/projects/<pid>/<prefix>    → R2 LIST（prefix 配下）
 *   DELETE  /api/r2/purge/projects/<pid>/           → R2 LIST→ DELETE 全消し
 *
 * 【バインディング／環境変数】
 *   [[r2_buckets]] binding = "R2"（顧客の R2 バケット）
 *   [vars]
 *     FIREBASE_PROJECT_ID   LayCAT 本体の Firebase projectId（通常 "laycat-54ee4"）
 *     ALLOW_ORIGIN          CORS 許可オリジン（カンマ区切り）
 */

const ACCESS_JSON_NAME = '_access.json';
const DEFAULT_MAX_JSON = 10 * 1024 * 1024;      // 10 MB
const DEFAULT_MAX_MEDIA = 500 * 1024 * 1024;    // 500 MB
const DEFAULT_MAX_ANY = 2 * 1024 * 1024 * 1024; // 2 GB

const PID_FORMAT = /^[a-zA-Z0-9_-]+$/;

function sizeLimitFor(env, key) {
  const isJson = /\.json$/i.test(key);
  const maxJson = parseInt(env.MAX_JSON_BYTES || '0', 10) || DEFAULT_MAX_JSON;
  const maxMedia = parseInt(env.MAX_MEDIA_BYTES || '0', 10) || DEFAULT_MAX_MEDIA;
  const maxAny = parseInt(env.MAX_ANY_BYTES || '0', 10) || DEFAULT_MAX_ANY;
  const cat = isJson ? maxJson : maxMedia;
  return Math.min(cat, maxAny);
}

function isValidPid(pid) {
  if (!pid || typeof pid !== 'string') return false;
  if (pid.length > 200) return false;
  return PID_FORMAT.test(pid);
}

// ---------- URL パス抽出 ----------
// path から { pid, kind, keySuffix } を抽出する。
//   kind: 'object' | 'list' | 'purge' | null
function parsePath(path) {
  // /api/r2/projects/<pid>/<path>
  let m = path.match(/^\/api\/r2\/projects\/([^/]+)\/(.+)$/);
  if (m) return { pid: m[1], kind: 'object', keySuffix: m[2] };
  // /api/r2/list/projects/<pid>/<path>?
  m = path.match(/^\/api\/r2\/list\/projects\/([^/]+)\/(.*)$/);
  if (m) return { pid: m[1], kind: 'list', keySuffix: m[2] };
  // /api/r2/purge/projects/<pid>/
  m = path.match(/^\/api\/r2\/purge\/projects\/([^/]+)\/$/);
  if (m) return { pid: m[1], kind: 'purge', keySuffix: '' };
  return null;
}

function projectPrefix(pid) { return 'projects/' + pid + '/'; }
function r2KeyFor(pid, suffix) { return projectPrefix(pid) + (suffix || ''); }

// ---------- プロジェクト ACL（_access.json） ----------
const _aclCache = new Map(); // pid -> { at, access }
async function loadProjectAccess(env, pid) {
  const cached = _aclCache.get(pid);
  if (cached && (Date.now() - cached.at) < 30 * 1000) return cached.access;
  const key = r2KeyFor(pid, ACCESS_JSON_NAME);
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

// _access.json を見てこの email がアクセス可能か判定。
async function checkProjectAcl(env, pid, email) {
  if (!isValidPid(pid)) return { allowed: false, reason: 'invalid-pid', access: null };
  const access = await loadProjectAccess(env, pid);
  if (!access) return { allowed: false, reason: 'no-access-json', access: null };
  const lower = String(email || '').toLowerCase();
  if (String(access.owner || '').toLowerCase() === lower) return { allowed: true, reason: 'owner', access };
  const members = Array.isArray(access.members) ? access.members : [];
  if (members.map(m => String(m || '').toLowerCase()).includes(lower)) return { allowed: true, reason: 'member', access };
  return { allowed: false, reason: 'not-a-member', access };
}

// ブートストラップ：_access.json が無い新規プロジェクトの初回 PUT のみ許可（owner=自分で body 指定）
async function isBootstrapWrite(req, keySuffix, email) {
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

// ---------- Firebase JWT 検証（公開鍵のみ、SA 不要） ----------
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

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function b64urlDecodeText(s) {
  return new TextDecoder().decode(b64urlDecode(s));
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
    const audit = (status, extra) => {
      try {
        const dur = Date.now() - start;
        const ex = extra ? ' ' + extra : '';
        console.log('[audit] ' + new Date().toISOString() + ' ' + req.method + ' ' + path + ' email=' + auditEmail + ' status=' + status + ' dur=' + dur + 'ms' + ex);
      } catch (_) {}
    };
    const respond = (resp, extra) => { audit(resp.status, extra); return resp; };

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }

    // health check
    if (path === '/api/r2/health' && req.method === 'GET') {
      return respond(json(env, req, { ok: true, edition: 'customer', ts: new Date().toISOString() }));
    }

    // すべての API エンドポイントは Authorization: Bearer <firebase-id-token> 必須
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return respond(json(env, req, { error: 'unauthorized', detail: 'no bearer' }, 401), 'no_bearer');
    }
    let payload;
    try {
      payload = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return respond(json(env, req, { error: 'unauthorized', detail: String(e.message || e) }, 401), 'auth_fail=' + String(e.message || e).slice(0, 40));
    }
    auditEmail = (payload && payload.email) || '-';

    // /api/r2/mine — 参加可能プロジェクト一覧（この R2 バケットを全走査して _access.json を見る）
    if (path === '/api/r2/mine' && req.method === 'GET') {
      const me = String(payload.email || '').toLowerCase();
      const results = [];
      let cursor = undefined;
      // projects/* の _access.json を全列挙
      while (true) {
        const list = await env.R2.list({ prefix: 'projects/', cursor });
        for (const obj of list.objects) {
          if (!obj.key.endsWith('/' + ACCESS_JSON_NAME)) continue;
          // projects/<pid>/_access.json → pid 抽出
          const m = obj.key.match(/^projects\/([^/]+)\/_access\.json$/);
          if (!m) continue;
          const pid = m[1];
          try {
            const r2obj = await env.R2.get(obj.key);
            if (!r2obj) continue;
            const txt = await r2obj.text();
            const access = JSON.parse(txt);
            const isOwner = String(access.owner || '').toLowerCase() === me;
            const members = Array.isArray(access.members) ? access.members : [];
            const isMember = members.map(x => String(x || '').toLowerCase()).includes(me);
            if (isOwner || isMember) {
              results.push({
                pid,
                owner: access.owner || null,
                members,
                role: isOwner ? 'owner' : 'member',
              });
            }
          } catch (_) { /* broken _access.json はスキップ */ }
        }
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      return respond(json(env, req, { projects: results, source: 'customer' }), 'count=' + results.length);
    }

    // /api/r2/projects/<pid>/... のパース
    const parsed = parsePath(path);
    if (!parsed) {
      return respond(json(env, req, { error: 'not-found' }, 404));
    }
    const { pid, kind, keySuffix } = parsed;
    if (!isValidPid(pid)) return respond(json(env, req, { error: 'invalid-pid' }, 400));

    // プロジェクト ACL
    const aclResult = await checkProjectAcl(env, pid, payload.email);
    let willBootstrap = false;
    if (!aclResult.allowed) {
      if (aclResult.reason === 'no-access-json' && kind === 'object') {
        const boot = await isBootstrapWrite(req, keySuffix, payload.email);
        if (!boot.ok) {
          return respond(json(env, req, { error: 'project-not-initialized', detail: boot.reason }, 403), 'pid=' + pid + ' bootstrap_fail=' + boot.reason);
        }
        willBootstrap = true;
      } else {
        return respond(json(env, req, { error: 'not-a-project-member', pid }, 403), 'pid=' + pid + ' acl=' + aclResult.reason);
      }
    }

    // list
    if (kind === 'list' && req.method === 'GET') {
      const prefix = r2KeyFor(pid, keySuffix);
      const list = await env.R2.list({ prefix });
      return respond(json(env, req, {
        objects: list.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
        truncated: list.truncated,
      }), 'count=' + list.objects.length);
    }

    // purge
    if (kind === 'purge' && req.method === 'DELETE') {
      const prefix = projectPrefix(pid);
      let cursor = undefined, total = 0;
      while (true) {
        const list = await env.R2.list({ prefix, cursor });
        if (!list.objects.length) break;
        await Promise.all(list.objects.map(o => env.R2.delete(o.key)));
        total += list.objects.length;
        if (!list.truncated) break;
        cursor = list.cursor;
      }
      invalidateProjectAccess(pid);
      return respond(json(env, req, { deleted: total }), 'purged=' + total + ' prefix=' + prefix);
    }

    // object (GET / PUT / DELETE)
    if (kind === 'object') {
      const key = r2KeyFor(pid, keySuffix);

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
        if (isAccessJson) {
          const bodyText = await req.text();
          await env.R2.put(key, bodyText, { httpMetadata: { contentType } });
          invalidateProjectAccess(pid);
        } else {
          await env.R2.put(key, req.body, { httpMetadata: { contentType } });
        }
        return respond(json(env, req, { ok: true, key, bootstrap: willBootstrap || undefined }), 'key=' + key + ' size=' + cl + (willBootstrap ? ' bootstrap=1' : ''));
      }
      if (req.method === 'DELETE') {
        const isAccessJson = (keySuffix === ACCESS_JSON_NAME);
        await env.R2.delete(key);
        if (isAccessJson) invalidateProjectAccess(pid);
        return respond(json(env, req, { ok: true }), 'key=' + key);
      }
      return respond(json(env, req, { error: 'method-not-allowed' }, 405));
    }

    return respond(json(env, req, { error: 'not-found' }, 404));
  }
};
