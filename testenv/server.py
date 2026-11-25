#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LayCAT ローカル検証環境（testenv）サーバー

    py testenv/server.py                 # 8771 / 8772 / 8773 で起動
    py testenv/server.py --ports 8771,8772

ポートが違う＝ブラウザ上は別サイト扱いなので、ブラウザ内保存（IndexedDB / localStorage）が
ポートごとに完全に分かれる。1 台の PC で「別 PC の別ユーザー」を再現するために複数ポートで待ち受ける。

提供するもの
  - リポジトリの静的配信（HTML には testenv/harness.js を差し込み、Firebase 読込先などを偽物へ差し替え）
  - 偽 NAS        /__nas/<path>      … testenv/data/nas/ の実フォルダ（全ユーザー共有）
  - 偽 R2 Worker  /api/r2/...        … worker/laycat-r2-api.js と同じ URL・同じ ACL 判定（testenv/data/r2/）
  - 偽 Firestore  /__fs/<op>         … testenv/data/firestore.json（全ユーザー共有）
  - 制御 API      /__testenv/...     … 障害注入・書き込みログ・リセット・スナップショット

安全
  - 本番（Firestore / R2 / ユーザーの NAS）には一切接続しない。書き込みは testenv/data/ の中だけ。
  - 127.0.0.1 のみで待ち受ける（LAN には公開しない）。
  - HTML には CSP ヘッダーを付け、ブラウザ側でも本番 API への通信を遮断する。
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import random
import re
import shutil
import string
import sys
import threading
import time
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(HERE, 'data')
NAS_DIR = os.path.join(DATA, 'nas')
R2_DIR = os.path.join(DATA, 'r2')
R2_META = os.path.join(DATA, 'r2_meta.json')
FS_FILE = os.path.join(DATA, 'firestore.json')
LOG_FILE = os.path.join(DATA, 'writes.jsonl')
SNAP_DIR = os.path.join(DATA, '_snapshots')
SEED_DIR = os.path.join(HERE, 'seed')

LOCK = threading.RLock()

STATE = {
    'faults': [],      # 障害注入ルール
    'log': [],         # 直近のイベント（書き込み＋設定で読み込みも）
    'seq': 0,
    'logReads': False,
    'ports': [],
    'faultSeq': 0,
}
FS: dict = {}        # 偽 Firestore：docPath -> data
R2M: dict = {}       # 偽 R2 メタデータ：key -> {ct, size, uploaded}

MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
    '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream', '.wasm': 'application/wasm',
    '.exr': 'image/x-exr', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

# HTML 配信時の差し替え（ファイル自体は変更しない）
PATCHES = [
    # Firebase SDK → 偽 Firebase（testenv/fakefirebase/）
    ('firebase', re.compile(r'https://www\.gstatic\.com/firebasejs/[0-9.]+/'), '/testenv/fakefirebase/'),
    # 認証ゲート：本番ドメイン以外では認証オフになる判定に testenv を足して、本物のログイン判定を通す
    ('authgate', re.compile(r"location\.hostname===(['\"])ogshaw03\.github\.io\1"),
     r"(location.hostname===\1ogshaw03.github.io\1||window.__LAYCAT_TESTENV===true)"),
    # R2 既定エンドポイント（本番 Worker）→ このサーバー
    ('r2default', re.compile(r"_default:(['\"])https://laycat-r2-api\.ogusho1101\.workers\.dev\1"),
     '_default:location.origin'),
]

CSP = "; ".join([
    "default-src 'self' blob: data:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://esm.sh https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' blob: data: https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
])


# ---------------------------------------------------------------- utils
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def email_key(email: str) -> str:
    return re.sub(r'[.@#$/\[\]]', '_', str(email or '').lower())


def rand_id(n: int = 20) -> str:
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(n))


def atomic_write(path: str, data: bytes) -> None:
    tmp = path + '.__tmp_' + rand_id(6)
    with open(tmp, 'wb') as f:
        f.write(data)
    for i in range(10):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05 * (i + 1))
    os.replace(tmp, path)


def load_json(path: str, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path: str, obj) -> None:
    atomic_write(path, json.dumps(obj, ensure_ascii=False, indent=1).encode('utf-8'))


def seed_config() -> dict:
    return load_json(os.path.join(SEED_DIR, 'testenv.json'), {'users': []})


def ensure_data() -> None:
    with LOCK:
        os.makedirs(NAS_DIR, exist_ok=True)
        os.makedirs(R2_DIR, exist_ok=True)
        os.makedirs(SNAP_DIR, exist_ok=True)
        if not os.path.exists(FS_FILE):
            shutil.copyfile(os.path.join(SEED_DIR, 'firestore.json'), FS_FILE)
        seed_nas = os.path.join(SEED_DIR, 'nas')
        if os.path.isdir(seed_nas) and not os.listdir(NAS_DIR):
            shutil.copytree(seed_nas, NAS_DIR, dirs_exist_ok=True)
        FS.clear()
        FS.update(load_json(FS_FILE, {}))
        R2M.clear()
        R2M.update(load_json(R2_META, {}))


def reset_data() -> None:
    with LOCK:
        for p in (NAS_DIR, R2_DIR):
            shutil.rmtree(p, ignore_errors=True)
        for p in (FS_FILE, R2_META, LOG_FILE):
            try:
                os.remove(p)
            except FileNotFoundError:
                pass
        STATE['log'].clear()
        ensure_data()


SNAP_NAME = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


def snapshot_save(name: str) -> None:
    with LOCK:
        dst = os.path.join(SNAP_DIR, name)
        shutil.rmtree(dst, ignore_errors=True)
        os.makedirs(dst)
        shutil.copytree(NAS_DIR, os.path.join(dst, 'nas'))
        shutil.copytree(R2_DIR, os.path.join(dst, 'r2'))
        save_json(os.path.join(dst, 'firestore.json'), FS)
        save_json(os.path.join(dst, 'r2_meta.json'), R2M)


def snapshot_restore(name: str) -> bool:
    with LOCK:
        src = os.path.join(SNAP_DIR, name)
        if not os.path.isdir(src):
            return False
        for p in (NAS_DIR, R2_DIR):
            shutil.rmtree(p, ignore_errors=True)
        shutil.copytree(os.path.join(src, 'nas'), NAS_DIR)
        shutil.copytree(os.path.join(src, 'r2'), R2_DIR)
        shutil.copyfile(os.path.join(src, 'firestore.json'), FS_FILE)
        shutil.copyfile(os.path.join(src, 'r2_meta.json'), R2_META)
        ensure_data()
        return True


# ---------------------------------------------------------------- log / faults
def log_event(entry: dict) -> None:
    with LOCK:
        STATE['seq'] += 1
        entry['seq'] = STATE['seq']
        entry.setdefault('t', now_iso())
        STATE['log'].append(entry)
        if len(STATE['log']) > 5000:
            del STATE['log'][:1000]
        try:
            with open(LOG_FILE, 'a', encoding='utf-8') as f:
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        except OSError:
            pass
    mark = ' [FAULT:' + str(entry['fault']) + ']' if entry.get('fault') else ''
    print('[%s] :%s %-24s %-4s %-7s %s %s%s' % (
        entry['t'][11:23], entry.get('port', ''), entry.get('user') or '-', entry['area'], entry['op'],
        entry['path'], entry.get('status', ''), mark), flush=True)


def match_faults(area: str, method: str, path: str, user: str, op: str = ''):
    """戻り値 (処理前の遅延ms, 処理後〜返答前の遅延ms, 失敗情報)。
    delayPhase='after' は「読み書き自体は即時に済ませ、返答だけ遅らせる」
    （読み込みなら古い内容を掴んだまま遅れて届く＝遅い NAS の転送を再現）。"""
    delay = 0
    after = 0
    fail = None
    with LOCK:
        for r in STATE['faults']:
            if r.get('area') not in (None, '', 'any', area):
                continue
            ms = r.get('methods') or r.get('method')
            if ms:
                if isinstance(ms, str):
                    ms = [ms]
                if method.upper() not in [m.upper() for m in ms]:
                    continue
            if r.get('user') and str(r['user']).lower() not in (user or '').lower():
                continue
            rop = r.get('op')
            if rop:
                if isinstance(rop, str):
                    rop = [rop]
                if op not in rop:
                    continue
            pat = r.get('path')
            if pat:
                try:
                    if not re.search(pat, path):
                        continue
                except re.error:
                    continue
            if r.get('times') is not None and int(r['times']) <= 0:
                continue
            hit = False
            d = int(r.get('delayMs') or 0)
            jit = int(r.get('jitterMs') or 0)
            if d or jit:
                dv = d + (random.randint(0, jit) if jit else 0)
                if r.get('delayPhase') == 'after':
                    after = max(after, dv)
                else:
                    delay = max(delay, dv)
                hit = True
            rate = float(r.get('failRate') or 0)
            if rate > 0 and fail is None and random.random() < rate:
                fail = {'status': int(r.get('status') or 500),
                        'error': r.get('error') or 'InvalidStateError',
                        'rule': r.get('id')}
                hit = True
            if hit:
                r['hits'] = int(r.get('hits') or 0) + 1
                if r.get('times') is not None:
                    r['times'] = int(r['times']) - 1
    return delay, after, fail


# ---------------------------------------------------------------- fake firestore
def fs_is_sentinel(v) -> bool:
    return isinstance(v, dict) and '__fsop' in v


def fs_materialize(v):
    """センチネルを含まない普通の値に変換（set 非マージ用・新規フィールド用）"""
    if fs_is_sentinel(v):
        op = v['__fsop']
        if op == 'serverTimestamp':
            return now_iso()
        if op == 'arrayUnion':
            out = []
            for x in v.get('values', []):
                if x not in out:
                    out.append(x)
            return out
        if op == 'arrayRemove':
            return []
        if op == 'increment':
            return v.get('n', 0)
        return None  # deleteField は呼び出し側で除去
    if isinstance(v, dict):
        return {k: fs_materialize(x) for k, x in v.items()
                if not (fs_is_sentinel(x) and x['__fsop'] == 'deleteField')}
    if isinstance(v, list):
        return [fs_materialize(x) for x in v]
    return v


def fs_apply_leaf(container: dict, key: str, v) -> None:
    if fs_is_sentinel(v):
        op = v['__fsop']
        cur = container.get(key)
        if op == 'deleteField':
            container.pop(key, None)
            return
        if op == 'arrayUnion':
            arr = list(cur) if isinstance(cur, list) else []
            for x in v.get('values', []):
                if x not in arr:
                    arr.append(x)
            container[key] = arr
            return
        if op == 'arrayRemove':
            arr = list(cur) if isinstance(cur, list) else []
            container[key] = [x for x in arr if x not in v.get('values', [])]
            return
        if op == 'increment':
            base = cur if isinstance(cur, (int, float)) and not isinstance(cur, bool) else 0
            container[key] = base + v.get('n', 0)
            return
    container[key] = fs_materialize(v)


def fs_deep_merge(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and not fs_is_sentinel(v) and isinstance(dst.get(k), dict):
            fs_deep_merge(dst[k], v)
        else:
            fs_apply_leaf(dst, k, v)


def fs_update_paths(dst: dict, src: dict) -> None:
    for k, v in src.items():
        parts = k.split('.')
        cur = dst
        for p in parts[:-1]:
            if not isinstance(cur.get(p), dict):
                cur[p] = {}
            cur = cur[p]
        fs_apply_leaf(cur, parts[-1], v)


def fs_get_field(data, path: str):
    cur = data
    for p in path.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return None, False
        cur = cur[p]
    return cur, True


def fs_where(data, field: str, op: str, value) -> bool:
    if field == '__name__':
        return False
    v, ok = fs_get_field(data, field)
    if op == '==':
        return ok and v == value
    if op == '!=':
        return ok and v != value
    if op == 'in':
        return ok and isinstance(value, list) and v in value
    if op == 'not-in':
        return ok and isinstance(value, list) and v not in value
    if op == 'array-contains':
        return ok and isinstance(v, list) and value in v
    if op == 'array-contains-any':
        return ok and isinstance(v, list) and isinstance(value, list) and any(x in v for x in value)
    if not ok or v is None:
        return False
    try:
        if op == '<':
            return v < value
        if op == '<=':
            return v <= value
        if op == '>':
            return v > value
        if op == '>=':
            return v >= value
    except TypeError:
        return False
    return False


def fs_valid_doc_path(p: str) -> bool:
    parts = [x for x in str(p or '').split('/') if x]
    return len(parts) >= 2 and len(parts) % 2 == 0


def fs_list_coll(coll: str):
    coll = coll.strip('/')
    depth = len(coll.split('/')) + 1
    out = []
    for path, data in FS.items():
        parts = path.split('/')
        if len(parts) == depth and path.startswith(coll + '/'):
            out.append((parts[-1], path, data))
    out.sort(key=lambda x: x[0])
    return out


# ---------------------------------------------------------------- fake R2 helpers
TENANT_PREFIX = 'tenants/'
PERSONAL = 'personal__'
OPERATOR_TID = 'operator'
ID_FMT = re.compile(r'^[a-zA-Z0-9_-]{1,200}$')


def r2_parse(path: str):
    m = re.match(r'^/api/r2/tenants/([^/]+)/projects/([^/]+)/(.+)$', path)
    if m:
        return {'tid': m[1], 'pid': m[2], 'kind': 'object', 'suffix': m[3]}
    m = re.match(r'^/api/r2/list/tenants/([^/]+)/projects/([^/]+)/(.*)$', path)
    if m:
        return {'tid': m[1], 'pid': m[2], 'kind': 'list', 'suffix': m[3]}
    m = re.match(r'^/api/r2/purge/tenants/([^/]+)/projects/([^/]+)/$', path)
    if m:
        return {'tid': m[1], 'pid': m[2], 'kind': 'purge', 'suffix': ''}
    return None


def r2_key(tid, pid, suffix=''):
    return TENANT_PREFIX + tid + '/projects/' + pid + '/' + (suffix or '')


def r2_abs(key: str) -> str:
    parts = [p for p in key.split('/') if p]
    for p in parts:
        if p in ('.', '..') or '\\' in p or ':' in p:
            raise ValueError('bad key')
    return os.path.join(R2_DIR, *parts)


def r2_get_bytes(key: str):
    ap = r2_abs(key)
    if not os.path.isfile(ap):
        return None
    with open(ap, 'rb') as f:
        return f.read()


def r2_cfg():
    return FS.get('laynaAccess/config') or {}


def r2_is_staff(email):
    return email in [str(x).lower() for x in (r2_cfg().get('operatorEmails') or [])]


def r2_is_tenant_member(tid, email):
    if ('tenants/%s/members/%s' % (tid, email_key(email))) in FS:
        return True
    t = FS.get('tenants/' + tid) or {}
    return str(t.get('ownerEmail') or '').lower() == email


def r2_is_allowed(email):
    cfg = r2_cfg()
    if cfg.get('authRequired') is False:
        return True
    lists = (cfg.get('adminEmails') or []) + (cfg.get('allowedEmails') or []) + (cfg.get('operatorEmails') or [])
    if email in [str(x).lower() for x in lists]:
        return True
    inv = (FS.get('laynaAccess/invited') or {}).get('emails') or {}
    if email in [str((v or {}).get('email') or '').lower() for v in inv.values()]:
        return True
    u = FS.get('laycatUsers/' + email_key(email)) or {}
    return bool(u.get('tenantId'))


def r2_access(tid, pid):
    b = r2_get_bytes(r2_key(tid, pid, '_access.json'))
    if b is None:
        return None
    try:
        return json.loads(b.decode('utf-8'))
    except Exception:
        return None


def r2_acl(tid, pid, email):
    if tid.startswith(PERSONAL) and tid[len(PERSONAL):] == re.sub(r'[.@#$/]', '_', email):
        return True, 'personal-self', r2_access(tid, pid)
    if tid == OPERATOR_TID and r2_is_staff(email):
        return True, 'operator-tid', r2_access(tid, pid)
    if not tid.startswith(PERSONAL) and tid != OPERATOR_TID and r2_is_tenant_member(tid, email):
        return True, 'tenant-member', r2_access(tid, pid)
    acc = r2_access(tid, pid)
    if not acc:
        return False, 'no-access-json', None
    if str(acc.get('owner') or '').lower() == email:
        return True, 'owner', acc
    if email in [str(x).lower() for x in (acc.get('members') or [])]:
        return True, 'member', acc
    return False, 'not-a-member', acc


def r2_list_prefix(prefix: str):
    out = []
    base = r2_abs(prefix.rstrip('/')) if prefix.strip('/') else R2_DIR
    root_dir = base if os.path.isdir(base) else os.path.dirname(base)
    if not os.path.isdir(root_dir):
        return out
    for dp, _dn, fns in os.walk(root_dir):
        for fn in fns:
            if '.__tmp_' in fn:
                continue
            ap = os.path.join(dp, fn)
            key = os.path.relpath(ap, R2_DIR).replace(os.sep, '/')
            if key.startswith(prefix):
                meta = R2M.get(key) or {}
                out.append({'key': key, 'size': os.path.getsize(ap),
                            'uploaded': meta.get('uploaded') or now_iso()})
    out.sort(key=lambda o: o['key'])
    return out


def r2_tenant_projects(tid):
    d = os.path.join(R2_DIR, 'tenants', tid, 'projects')
    if not os.path.isdir(d):
        return []
    return sorted(x for x in os.listdir(d) if os.path.isdir(os.path.join(d, x)))


# ---------------------------------------------------------------- handler
class HttpError(Exception):
    def __init__(self, status, error, message=''):
        super().__init__(message or error)
        self.status, self.error, self.message = status, error, message or error


def nas_abs(rel: str):
    parts = [p for p in rel.split('/') if p != '']
    for p in parts:
        if p in ('.', '..') or '\\' in p or ':' in p or any(c in p for c in '<>"|?*'):
            raise HttpError(400, 'TypeError', 'invalid name: ' + p)
    ap = os.path.join(NAS_DIR, *parts)
    if not os.path.abspath(ap).startswith(os.path.abspath(NAS_DIR)):
        raise HttpError(400, 'TypeError', 'path escapes nas root')
    return ap, '/'.join(parts)


class Handler(BaseHTTPRequestHandler):
    server_version = 'LayCAT-testenv/1'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):  # 標準のアクセスログは出さない（書き込みログだけ出す）
        pass

    # ---- plumbing
    def do_GET(self): self._dispatch('GET')
    def do_HEAD(self): self._dispatch('HEAD')
    def do_PUT(self): self._dispatch('PUT')
    def do_POST(self): self._dispatch('POST')
    def do_DELETE(self): self._dispatch('DELETE')
    def do_OPTIONS(self): self._dispatch('OPTIONS')

    @property
    def port(self):
        return self.server.server_address[1]

    def body(self) -> bytes:
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n > 0 else b''

    def body_json(self):
        b = self.body()
        if not b:
            return {}
        try:
            return json.loads(b.decode('utf-8'))
        except Exception:
            raise HttpError(400, 'bad-json')

    def send(self, status, data: bytes = b'', ctype='application/octet-stream', headers=None):
        after = getattr(self, '_after', 0)
        if after:
            self._after = 0
            time.sleep(after / 1000.0)
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD' and data:
            self.wfile.write(data)

    def send_json(self, status, obj, headers=None):
        self.send(status, json.dumps(obj, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8', headers)

    def _dispatch(self, method):
        self._r2user = None  # keep-alive で同じハンドラが使い回されるため毎回リセット
        self._after = 0
        try:
            u = urlsplit(self.path)
            path = unquote(u.path)
            q = parse_qs(u.query)
            if path.startswith('/__testenv/'):
                return self.h_ctl(method, path[len('/__testenv/'):], q)
            if path == '/__nas' or path.startswith('/__nas/'):
                return self.h_nas(method, path[len('/__nas'):].lstrip('/'), q)
            if path.startswith('/__fs/'):
                return self.h_fs(method, path[len('/__fs/'):])
            if path.startswith('/api/r2/'):
                return self.h_r2(method, path)
            if method in ('GET', 'HEAD'):
                return self.h_static(path)
            return self.send_json(405, {'error': 'method-not-allowed'})
        except HttpError as e:
            try:
                # 偽 NAS の「無い／種類違い」は本物の FileSystem API では通信エラーにならない。
                # 404 で返すとブラウザのコンソールが赤字で埋まり本物の不具合が見えなくなるので、
                # 200 ＋ X-Testenv-Error ヘッダーで返す（シム側で DOMException に変換）。
                if self.path.startswith('/__nas') and e.status in (404, 409):
                    return self.send_json(200, {'error': e.error, 'message': e.message}, {'X-Testenv-Error': e.error})
                self.send_json(e.status, {'error': e.error, 'message': e.message})
            except Exception:
                pass
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as e:
            traceback.print_exc()
            try:
                self.send_json(500, {'error': 'InternalError', 'message': str(e)})
            except Exception:
                pass

    def fault(self, area, method, path, mutating, op=''):
        if self.headers.get('X-Testenv-Bypass'):  # 検証スクリプトの直接読み取り：障害注入を受けない
            return 0
        delay, after, fail = match_faults(area, method, path, self.user(), op or method.lower())
        if delay:
            time.sleep(delay / 1000.0)
        self._after = after  # send() の直前に待つ
        delay += after
        if fail:
            if mutating or STATE['logReads']:
                log_event({'port': self.port, 'user': self.user(), 'area': area, 'op': op or method.lower(),
                           'path': path, 'status': fail['status'], 'fault': fail['rule'] or True})
            raise HttpError(fail['status'], fail['error'], '[testenv] injected fault (rule %s)' % fail['rule'])
        return delay

    def log_read(self, area, op, path, status=200, delay=0):
        if STATE['logReads'] and not self.headers.get('X-Testenv-Bypass'):
            e = {'port': self.port, 'user': self.user(), 'area': area, 'op': op, 'path': path, 'status': status}
            if delay:
                e['delayMs'] = delay
            log_event(e)

    # ---- static
    def h_static(self, path):
        rel = path.lstrip('/')
        if rel == '' or rel.endswith('/'):
            rel += 'index.html'
        parts = [p for p in rel.split('/') if p]
        if any(p in ('.', '..') or p.startswith('.git') for p in parts):
            raise HttpError(404, 'not-found')
        if parts[:2] == ['testenv', 'data']:
            raise HttpError(404, 'not-found')
        ap = os.path.join(ROOT, *parts)
        if not os.path.abspath(ap).startswith(os.path.abspath(ROOT)) or not os.path.isfile(ap):
            raise HttpError(404, 'not-found', path)
        # 静的ファイルにも障害注入できる（例：偽 Firebase の読み込みを遅らせて「CDN が遅い」を再現）
        self.fault('static', 'GET', '/'.join(parts), False, 'get')
        ext = os.path.splitext(ap)[1].lower()
        ctype = MIME.get(ext, 'application/octet-stream')
        if ext in ('.html', '.htm') and parts[0] != 'testenv':
            with open(ap, 'r', encoding='utf-8') as f:
                text = f.read()
            text, counts = self.patch_html(text, '/'.join(parts))
            info = ';'.join('%s=%d' % kv for kv in counts.items())
            return self.send(200, text.encode('utf-8'), ctype,
                             {'Content-Security-Policy': CSP, 'X-Testenv-Patched': info})
        size = os.path.getsize(ap)
        rng = self.headers.get('Range')
        m = re.match(r'bytes=(\d*)-(\d*)$', rng or '')
        if m and (m[1] or m[2]):
            start = int(m[1]) if m[1] else max(0, size - int(m[2]))
            end = int(m[2]) if (m[1] and m[2]) else size - 1
            end = min(end, size - 1)
            if start > end:
                return self.send(416, b'', ctype, {'Content-Range': 'bytes */%d' % size})
            with open(ap, 'rb') as f:
                f.seek(start)
                data = f.read(end - start + 1)
            return self.send(206, data, ctype, {'Content-Range': 'bytes %d-%d/%d' % (start, end, size),
                                                'Accept-Ranges': 'bytes'})
        with open(ap, 'rb') as f:
            data = f.read()
        return self.send(200, data, ctype, {'Accept-Ranges': 'bytes'})

    def patch_html(self, text, relpath):
        counts = {}
        for name, rx, rep in PATCHES:
            text, n = rx.subn(rep, text)
            counts[name] = n
        inject = ('<script>window.__TESTENV_PATCH=%s;</script><script src="/testenv/harness.js"></script>'
                  % json.dumps({'file': relpath, **counts}))
        m = re.search(r'<head[^>]*>', text, re.I)
        if m:
            text = text[:m.end()] + inject + text[m.end():]
        else:
            text = inject + text
        counts['harness'] = 1
        return text, counts

    # ---- control API
    def h_ctl(self, method, sub, q):
        if sub == 'info' and method == 'GET':
            with LOCK:
                return self.send_json(200, {
                    'ports': STATE['ports'], 'users': seed_config().get('users', []),
                    'logReads': STATE['logReads'], 'faults': STATE['faults'], 'seq': STATE['seq'],
                    'dataDir': DATA, 'snapshots': sorted(os.listdir(SNAP_DIR)) if os.path.isdir(SNAP_DIR) else [],
                })
        if sub == 'log' and method == 'GET':
            since = int((q.get('since') or ['0'])[0] or 0)
            with LOCK:
                rows = [e for e in STATE['log'] if e['seq'] > since]
            return self.send_json(200, {'seq': STATE['seq'], 'entries': rows})
        if sub == 'config' and method == 'POST':
            b = self.body_json()
            with LOCK:
                if 'logReads' in b:
                    STATE['logReads'] = bool(b['logReads'])
            return self.send_json(200, {'ok': True, 'logReads': STATE['logReads']})
        if sub == 'faults':
            if method == 'GET':
                return self.send_json(200, {'faults': STATE['faults']})
            if method == 'POST':  # {rules:[...]} 置き換え / {rule:{...}} 追加
                b = self.body_json()
                with LOCK:
                    rules = b['rules'] if 'rules' in b else STATE['faults'] + [b.get('rule') or {}]
                    for r in rules:
                        if not r.get('id'):
                            STATE['faultSeq'] += 1
                            r['id'] = 'f%d' % STATE['faultSeq']
                    STATE['faults'] = rules
                print('[testenv] faults =', json.dumps(STATE['faults'], ensure_ascii=False), flush=True)
                return self.send_json(200, {'ok': True, 'faults': STATE['faults']})
            if method == 'DELETE':
                rid = (q.get('id') or [None])[0]
                with LOCK:
                    STATE['faults'] = [r for r in STATE['faults'] if rid and r.get('id') != rid]
                print('[testenv] faults =', json.dumps(STATE['faults'], ensure_ascii=False), flush=True)
                return self.send_json(200, {'ok': True, 'faults': STATE['faults']})
        if sub == 'reset' and method == 'POST':
            reset_data()
            print('[testenv] data reset', flush=True)
            return self.send_json(200, {'ok': True})
        if sub == 'snapshot' and method == 'POST':
            b = self.body_json()
            name = str(b.get('name') or '')
            if not SNAP_NAME.match(name):
                raise HttpError(400, 'bad-name')
            if b.get('restore'):
                ok = snapshot_restore(name)
                print('[testenv] snapshot restored:', name, ok, flush=True)
                return self.send_json(200 if ok else 404, {'ok': ok})
            snapshot_save(name)
            print('[testenv] snapshot saved:', name, flush=True)
            return self.send_json(200, {'ok': True})
        if sub == 'fsdump' and method == 'GET':
            with LOCK:
                return self.send_json(200, FS)
        raise HttpError(404, 'not-found', sub)

    # ---- fake NAS（FileSystemDirectoryHandle 互換シムのバックエンド）
    def h_nas(self, method, rel, q):
        op = (q.get('op') or [''])[0]
        ap, relp = nas_abs(rel)
        if method == 'GET':
            delay = self.fault('nas', 'GET', relp, False, op or 'read')
            with LOCK:
                exists = os.path.exists(ap)
                if not exists:
                    raise HttpError(404, 'NotFoundError', 'A requested file or directory could not be found: ' + relp)
                if op == 'stat':
                    st = os.stat(ap)
                    kind = 'directory' if os.path.isdir(ap) else 'file'
                    res = {'kind': kind, 'size': st.st_size if kind == 'file' else 0,
                           'mtime': int(st.st_mtime * 1000)}
                    self.log_read('nas', 'stat', relp, 200, delay)
                    return self.send_json(200, res)
                if op == 'list':
                    if not os.path.isdir(ap):
                        raise HttpError(409, 'TypeMismatchError', 'not a directory: ' + relp)
                    ents = []
                    for name in sorted(os.listdir(ap)):
                        if '.__tmp_' in name:
                            continue
                        ents.append({'name': name, 'kind': 'directory' if os.path.isdir(os.path.join(ap, name)) else 'file'})
                    self.log_read('nas', 'list', relp, 200, delay)
                    return self.send_json(200, {'entries': ents})
                if os.path.isdir(ap):
                    raise HttpError(409, 'TypeMismatchError', 'is a directory: ' + relp)
                with open(ap, 'rb') as f:
                    data = f.read()
                mtime = int(os.stat(ap).st_mtime * 1000)
            self.log_read('nas', 'read', relp, 200, delay)
            ctype = MIME.get(os.path.splitext(ap)[1].lower(), 'application/octet-stream').split(';')[0]
            return self.send(200, data, ctype, {'X-Mtime': str(mtime)})
        if method == 'PUT':
            data = self.body()
            self.fault('nas', 'PUT', relp, True, 'write')
            with LOCK:
                if not os.path.isdir(os.path.dirname(ap)):
                    raise HttpError(404, 'NotFoundError', 'parent directory not found: ' + relp)
                if os.path.isdir(ap):
                    raise HttpError(409, 'TypeMismatchError', 'is a directory: ' + relp)
                existed = os.path.exists(ap)
                atomic_write(ap, data)
            log_event({'port': self.port, 'user': self.user(), 'area': 'nas', 'op': 'write' if existed else 'create',
                       'path': relp, 'bytes': len(data), 'status': 200})
            return self.send_json(200, {'ok': True})
        if method == 'POST' and op in ('mkdir', 'touch'):
            self.fault('nas', 'POST', relp, True, op)
            with LOCK:
                if not os.path.isdir(os.path.dirname(ap)):
                    raise HttpError(404, 'NotFoundError', 'parent directory not found: ' + relp)
                if op == 'mkdir':
                    if os.path.isfile(ap):
                        raise HttpError(409, 'TypeMismatchError', 'is a file: ' + relp)
                    if os.path.isdir(ap):
                        return self.send_json(200, {'ok': True, 'created': False})
                    os.mkdir(ap)
                else:
                    if os.path.isdir(ap):
                        raise HttpError(409, 'TypeMismatchError', 'is a directory: ' + relp)
                    if os.path.isfile(ap):
                        return self.send_json(200, {'ok': True, 'created': False})
                    atomic_write(ap, b'')
            log_event({'port': self.port, 'user': self.user(), 'area': 'nas', 'op': op, 'path': relp, 'status': 200})
            return self.send_json(200, {'ok': True, 'created': True})
        if method == 'DELETE':
            recursive = (q.get('recursive') or ['0'])[0] in ('1', 'true')
            self.fault('nas', 'DELETE', relp, True, 'delete')
            with LOCK:
                if not os.path.exists(ap):
                    raise HttpError(404, 'NotFoundError', 'A requested file or directory could not be found: ' + relp)
                if os.path.isdir(ap):
                    if os.listdir(ap) and not recursive:
                        raise HttpError(409, 'InvalidModificationError', 'directory not empty: ' + relp)
                    shutil.rmtree(ap)
                else:
                    os.remove(ap)
            log_event({'port': self.port, 'user': self.user(), 'area': 'nas', 'op': 'delete', 'path': relp, 'status': 200})
            return self.send_json(200, {'ok': True})
        raise HttpError(405, 'method-not-allowed')

    # ---- fake Firestore
    def h_fs(self, method, op):
        if method != 'POST':
            raise HttpError(405, 'method-not-allowed')
        b = self.body_json()
        if op == 'get':
            path = str(b.get('path') or '').strip('/')
            delay = self.fault('fs', 'GET', path, False, 'get')
            with LOCK:
                d = FS.get(path)
                res = {'exists': d is not None, 'data': copy.deepcopy(d)}
            self.log_read('fs', 'get', path, 200, delay)
            return self.send_json(200, res)
        if op == 'query':
            coll = str(b.get('coll') or '').strip('/')
            delay = self.fault('fs', 'GET', coll, False, 'query')
            with LOCK:
                rows = fs_list_coll(coll)
                for w in b.get('wheres') or []:
                    rows = [r for r in rows if fs_where(r[2], w[0], w[1], w[2])]
                for ob in reversed(b.get('orderBy') or []):
                    rows.sort(key=lambda r: (fs_get_field(r[2], ob[0])[0] is None, str(fs_get_field(r[2], ob[0])[0])),
                              reverse=(ob[1] == 'desc'))
                if b.get('limit'):
                    rows = rows[:int(b['limit'])]
                res = {'docs': [{'id': r[0], 'data': copy.deepcopy(r[2])} for r in rows]}
            self.log_read('fs', 'query', coll, 200, delay)
            return self.send_json(200, res)
        if op in ('set', 'update', 'delete', 'add'):
            if op == 'add':
                coll = str(b.get('coll') or '').strip('/')
                path = coll + '/' + rand_id()
            else:
                path = str(b.get('path') or '').strip('/')
            if not fs_valid_doc_path(path):
                raise HttpError(400, 'invalid-argument', 'invalid document path: ' + path)
            self.fault('fs', 'POST', path, True, op)
            data = b.get('data') or {}
            with LOCK:
                if op == 'delete':
                    FS.pop(path, None)
                    logop = 'delete'
                elif op == 'update':
                    if path not in FS:
                        raise HttpError(404, 'not-found', 'No document to update: ' + path)
                    fs_update_paths(FS[path], data)
                    logop = 'update'
                elif op == 'set' and b.get('merge'):
                    cur = FS.get(path)
                    if not isinstance(cur, dict):
                        cur = {}
                        FS[path] = cur
                    fs_deep_merge(cur, data)
                    logop = 'merge'
                else:
                    FS[path] = fs_materialize(data)
                    logop = 'set' if op == 'set' else 'add'
                save_json(FS_FILE, FS)
            log_event({'port': self.port, 'user': self.user(), 'area': 'fs', 'op': logop, 'path': path, 'status': 200})
            return self.send_json(200, {'ok': True, 'id': path.split('/')[-1], 'path': path})
        raise HttpError(404, 'not-found', op)

    # ---- fake R2 Worker（worker/laycat-r2-api.js の挙動を簡易再現）
    def h_r2(self, method, path):
        cors = {'Access-Control-Allow-Origin': self.headers.get('Origin') or '*',
                'Access-Control-Allow-Methods': 'GET,PUT,DELETE,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'authorization,content-type,x-laycat-content-type'}
        if method == 'OPTIONS':
            return self.send(204, b'', 'text/plain', cors)
        auth = self.headers.get('Authorization') or ''
        if not auth.startswith('Bearer testenv:'):
            return self.send_json(401, {'error': 'unauthorized', 'detail': 'testenv token required'}, cors)
        email = auth[len('Bearer testenv:'):].strip().lower()
        self._r2user = email
        with LOCK:
            allowed = r2_is_allowed(email)
        if not allowed:
            return self.send_json(403, {'error': 'forbidden'}, cors)

        if path == '/api/r2/mine' and method == 'GET':
            delay = self.fault('r2', 'GET', '/api/r2/mine', False, 'mine')
            with LOCK:
                results, seen = [], set()
                for o in r2_list_prefix(TENANT_PREFIX):
                    m = re.match(r'^tenants/([^/]+)/projects/([^/]+)/_access\.json$', o['key'])
                    if not m:
                        continue
                    acc = r2_access(m[1], m[2]) or {}
                    owner = str(acc.get('owner') or '').lower()
                    mem = [str(x).lower() for x in (acc.get('members') or [])]
                    if owner == email or email in mem:
                        seen.add(m[2])
                        results.append({'tid': m[1], 'pid': m[2], 'owner': acc.get('owner'),
                                        'members': acc.get('members') or [],
                                        'role': 'owner' if owner == email else 'member'})
                my_tid = (FS.get('laycatUsers/' + email_key(email)) or {}).get('tenantId')
                tids = [t for t in [my_tid, PERSONAL + re.sub(r'[.@#$/]', '_', email)] if t]
                for tid in tids:
                    for pid in r2_tenant_projects(tid):
                        if pid in seen:
                            continue
                        seen.add(pid)
                        acc = r2_access(tid, pid) or {}
                        results.append({'tid': tid, 'pid': pid, 'owner': acc.get('owner'),
                                        'members': acc.get('members') or [], 'role': 'tenant-member'})
            self.log_read('r2', 'mine', '/api/r2/mine', 200, delay)
            return self.send_json(200, {'projects': results, 'source': 'testenv'}, cors)

        p = r2_parse(path)
        if not p:
            return self.send_json(404, {'error': 'not-found'}, cors)
        tid, pid, kind, suffix = p['tid'], p['pid'], p['kind'], p['suffix']
        if not ID_FMT.match(tid):
            return self.send_json(400, {'error': 'invalid-tid'}, cors)
        if not ID_FMT.match(pid):
            return self.send_json(400, {'error': 'invalid-pid'}, cors)
        key = r2_key(tid, pid, suffix)
        body = self.body() if method == 'PUT' else b''
        with LOCK:
            ok, reason, acc = r2_acl(tid, pid, email)
        if not ok:
            boot = False
            if reason == 'no-access-json' and kind == 'object' and method == 'PUT' and suffix == '_access.json':
                try:
                    bo = str((json.loads(body.decode('utf-8')) or {}).get('owner') or '').lower()
                except Exception:
                    bo = ''
                if bo == email:
                    if tid.startswith(PERSONAL):
                        boot = tid[len(PERSONAL):] == re.sub(r'[.@#$/]', '_', email)
                    elif tid == OPERATOR_TID:
                        boot = r2_is_staff(email)
                    else:
                        boot = r2_is_tenant_member(tid, email)
            if not boot:
                if method != 'GET':
                    log_event({'port': self.port, 'user': email, 'area': 'r2', 'op': method.lower(),
                               'path': key, 'status': 403, 'denied': reason})
                return self.send_json(403, {'error': 'not-a-project-member', 'tid': tid, 'pid': pid, 'reason': reason}, cors)

        if kind == 'list' and method == 'GET':
            delay = self.fault('r2', 'GET', key, False, 'list')
            with LOCK:
                objs = r2_list_prefix(key)
            self.log_read('r2', 'list', key, 200, delay)
            return self.send_json(200, {'objects': objs, 'truncated': False}, cors)
        if kind == 'purge' and method == 'DELETE':
            self.fault('r2', 'DELETE', key, True, 'purge')
            with LOCK:
                objs = r2_list_prefix(key)
                for o in objs:
                    try:
                        os.remove(r2_abs(o['key']))
                    except FileNotFoundError:
                        pass
                    R2M.pop(o['key'], None)
                save_json(R2_META, R2M)
            log_event({'port': self.port, 'user': email, 'area': 'r2', 'op': 'purge', 'path': key,
                       'status': 200, 'count': len(objs)})
            return self.send_json(200, {'deleted': len(objs)}, cors)
        if kind == 'object':
            if method in ('GET', 'HEAD'):
                delay = self.fault('r2', 'GET', key, False, 'get')
                with LOCK:
                    data = r2_get_bytes(key)
                    meta = R2M.get(key) or {}
                if data is None:
                    self.log_read('r2', 'get', key, 404, delay)
                    return self.send_json(404, {'error': 'not-found'}, cors)
                self.log_read('r2', 'get', key, 200, delay)
                h = dict(cors)
                h['ETag'] = '"%x-%x"' % (len(data), int(float(meta.get('t') or 0) * 1000))
                return self.send(200, data, meta.get('ct') or 'application/octet-stream', h)
            if method == 'PUT':
                self.fault('r2', 'PUT', key, True, 'put')
                ct = self.headers.get('x-laycat-content-type') or self.headers.get('Content-Type') or 'application/octet-stream'
                limit = 10 * 1024 * 1024 if key.lower().endswith('.json') else 500 * 1024 * 1024
                if len(body) > limit:
                    return self.send_json(413, {'error': 'payload-too-large', 'limit': limit, 'size': len(body)}, cors)
                with LOCK:
                    ap = r2_abs(key)
                    os.makedirs(os.path.dirname(ap), exist_ok=True)
                    existed = os.path.exists(ap)
                    atomic_write(ap, body)
                    R2M[key] = {'ct': ct, 'size': len(body), 'uploaded': now_iso(), 't': time.time()}
                    save_json(R2_META, R2M)
                log_event({'port': self.port, 'user': email, 'area': 'r2', 'op': 'write' if existed else 'create',
                           'path': key, 'bytes': len(body), 'status': 200})
                return self.send_json(200, {'ok': True, 'key': key}, cors)
            if method == 'DELETE':
                self.fault('r2', 'DELETE', key, True, 'delete')
                with LOCK:
                    try:
                        os.remove(r2_abs(key))
                        existed = True
                    except FileNotFoundError:
                        existed = False
                    R2M.pop(key, None)
                    save_json(R2_META, R2M)
                log_event({'port': self.port, 'user': email, 'area': 'r2', 'op': 'delete', 'path': key,
                           'status': 200 if existed else 404})
                return self.send_json(200, {'ok': True}, cors)
        return self.send_json(405, {'error': 'method-not-allowed'}, cors)

    # 操作ユーザー：R2 は Authorization（testenv トークン）から、それ以外は X-Testenv-User ヘッダーから
    def user(self):
        u = getattr(self, '_r2user', None)
        if u:
            return u
        return (self.headers.get('X-Testenv-User') or '').strip().lower()


def serve(port: int):
    httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    httpd.daemon_threads = True
    httpd.serve_forever()


def main():
    ap = argparse.ArgumentParser(description='LayCAT testenv server')
    ap.add_argument('--ports', default='8771,8772,8773', help='カンマ区切り（ポートごとに別ユーザー＝別ブラウザ保存）')
    ap.add_argument('--reset', action='store_true', help='起動時に testenv/data を初期化する')
    ap.add_argument('--log-reads', action='store_true', help='読み込みもログに出す')
    a = ap.parse_args()
    ports = [int(x) for x in a.ports.split(',') if x.strip()]
    STATE['ports'] = ports
    STATE['logReads'] = a.log_reads
    if a.reset:
        reset_data()
    ensure_data()
    try:
        sys.stdout.reconfigure(encoding='utf-8')  # Windows コンソールで日本語を出す
    except Exception:
        pass
    threads = []
    for p in ports:
        t = threading.Thread(target=serve, args=(p,), daemon=True)
        t.start()
        threads.append(t)
    users = seed_config().get('users', [])
    print('LayCAT testenv: data=%s' % DATA, flush=True)
    for i, p in enumerate(ports):
        u = users[i]['id'] if i < len(users) else 'alice'
        print('  http://127.0.0.1:%d/laycat_dev.html?as=%s' % (p, u), flush=True)
    print('  console: http://127.0.0.1:%d/testenv/console.html' % ports[0], flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
