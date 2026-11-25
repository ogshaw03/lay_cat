/* LayCAT testenv harness
 * testenv/server.py が HTML の <head> 先頭に差し込む。LayCAT 本体より先に実行される。
 *
 *  1. 安全装置：本番の Firestore / R2 Worker / Google API への通信を遮断（CSP ヘッダーと二重）
 *  2. テストユーザー：?as=<id> で切り替え（ポートごとに保持）。偽 Firebase がこれをログイン中ユーザーとして返す
 *  3. 偽 NAS：showDirectoryPicker を差し替え、FileSystemDirectoryHandle 互換のシムで /__nas/ を読み書き
 *  4. IndexedDB に保存されたシムのハンドルを読み戻すときにメソッドを復元
 *  5. 画面左下の「TESTENV」バッジ
 *  6. 検証スクリプト用ヘルパー window.__testenv（障害注入・書き込みログ・待機など）
 */
(function () {
  'use strict';
  var host = location.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error('[testenv] harness.js は 127.0.0.1 / localhost 以外では動作しません');
    return;
  }

  var qs = new URLSearchParams(location.search);
  var LS_USER = '__testenv_user';
  var T = (window.__testenv = { version: 1, port: location.port, origin: location.origin, blocked: [], cspViolations: [] });
  window.__LAYCAT_TESTENV = true;

  /* ---------------- server info（同期で取得：本体スクリプトより先に確定させる） */
  var info = { users: [], ports: [] };
  try {
    var x = new XMLHttpRequest();
    x.open('GET', '/__testenv/info', false);
    x.send(null);
    if (x.status === 200) info = JSON.parse(x.responseText);
  } catch (e) { console.warn('[testenv] info 取得失敗', e); }
  T.info = info;

  /* ---------------- テストユーザー */
  function normUser(id) {
    if (!id) return null;
    id = String(id).trim();
    if (!id || id === 'none') return null;
    var hit = (info.users || []).find(function (u) { return u.id === id || String(u.email).toLowerCase() === id.toLowerCase(); });
    if (hit) return { id: hit.id, email: String(hit.email).toLowerCase(), displayName: hit.name || hit.id, photoURL: null };
    var email = id.indexOf('@') >= 0 ? id.toLowerCase() : id.toLowerCase() + '@laycat.test';
    var base = email.split('@')[0];
    return { id: base, email: email, displayName: base.charAt(0).toUpperCase() + base.slice(1), photoURL: null };
  }
  try {
    if (qs.has('as')) {
      var asv = qs.get('as');
      if (!asv || asv === 'none') localStorage.removeItem(LS_USER);
      else localStorage.setItem(LS_USER, asv);
    }
  } catch (_) {}
  var stored = null;
  try { stored = localStorage.getItem(LS_USER); } catch (_) {}
  T.user = normUser(stored);
  T.setUser = function (u) {
    try {
      if (u) localStorage.setItem(LS_USER, u.id || u.email);
      else localStorage.removeItem(LS_USER);
    } catch (_) {}
    T.user = u ? normUser(u.id || u.email) : null;
    renderBadge();
  };

  /* ---------------- R2 エンドポイント：このサーバー以外を指していたら消す（本番 Worker へ飛ばさない） */
  try {
    var ep = localStorage.getItem('laycat_r2_endpoint');
    if (ep) {
      var epo = null;
      try { epo = new URL(/^https?:\/\//i.test(ep) ? ep : 'https://' + ep).origin; } catch (_) {}
      if (epo !== location.origin) { localStorage.removeItem('laycat_r2_endpoint'); console.warn('[testenv] laycat_r2_endpoint を削除しました（本番を指していたため）:', ep); }
    }
  } catch (_) {}

  /* ---------------- 安全装置：外部通信の遮断（CSP と二重） */
  var ALLOW_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com'];
  function allowedUrl(u) {
    try {
      var url = new URL(u, location.href);
      if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
      if (url.origin === location.origin) return true;
      return ALLOW_HOSTS.indexOf(url.hostname) >= 0;
    } catch (_) { return false; }
  }
  function blockedLog(kind, u) {
    T.blocked.push({ t: new Date().toISOString(), kind: kind, url: String(u) });
    console.warn('[testenv] 外部通信を遮断しました（' + kind + '）:', String(u));
    renderBadge();
  }
  /* 起動順の記録（タイミング起因の不具合調査用）：__testenv.trace に [ms, 出来事] を積む */
  T.trace = [];
  T.mark = function (what) { T.trace.push([Math.round(performance.now()), what]); };
  T.mark('harness start');
  ['__laynaFB', '__laynaFBUser', '__pmFBReady', '__laynaAuthChanged', '__pmOnAuthChanged'].forEach(function (k) {
    var v = window[k];
    try {
      Object.defineProperty(window, k, {
        configurable: true, enumerable: true,
        get: function () { return v; },
        set: function (nv) { v = nv; T.mark('set window.' + k + (nv && nv.email ? ' (' + nv.email + ')' : nv === null ? ' (null)' : '')); },
      });
    } catch (_) {}
  });
  document.addEventListener('DOMContentLoaded', function () { T.mark('DOMContentLoaded'); });
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = (typeof input === 'string' || input instanceof URL) ? String(input) : (input && input.url);
    if (!allowedUrl(u)) { blockedLog('fetch', u); return Promise.reject(new TypeError('[testenv] blocked external request: ' + u)); }
    var p = _fetch(input, init);
    if (/access\.json/.test(String(u))) { T.mark('fetch start ' + u); p.then(function () { T.mark('fetch done ' + u); }, function () {}); }
    return p;
  };
  var _xopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    if (!allowedUrl(u)) { blockedLog('xhr', u); throw new TypeError('[testenv] blocked external request: ' + u); }
    return _xopen.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (u, d) { if (!allowedUrl(u)) { blockedLog('beacon', u); return false; } return _beacon(u, d); };
  }
  document.addEventListener('securitypolicyviolation', function (e) {
    T.cspViolations.push({ t: new Date().toISOString(), directive: e.violatedDirective, url: e.blockedURI });
    console.warn('[testenv] CSP で遮断:', e.violatedDirective, e.blockedURI);
    renderBadge();
  });
  if (window.__TESTENV_PATCH) {
    var P = window.__TESTENV_PATCH;
    if (/^(laycat|pmboard)(_dev)?\.html$/.test(P.file) && (!P.firebase || !P.authgate)) {
      console.error('[testenv] 差し替えが効いていません。本体の書き方が変わった可能性があります（testenv/server.py の PATCHES を確認）:', P);
    }
  }

  /* ---------------- 偽 NAS：FileSystem Access API 互換シム */
  function domErr(name, msg) { try { return new DOMException(msg || name, name); } catch (_) { var e = new Error(msg || name); e.name = name; return e; } }
  function checkName(name) {
    name = String(name);
    if (!name || name === '.' || name === '..' || /[\/\\]/.test(name)) throw new TypeError("Name is not allowed: '" + name + "'");
    return name;
  }
  function nasUrl(path, op, extra) {
    var enc = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    var q = op ? '?op=' + op : '';
    if (extra) q += (q ? '&' : '?') + extra;
    return '/__nas/' + enc + q;
  }
  async function nasReq(method, path, op, body, extra) {
    var headers = {};
    if (T.user) headers['x-testenv-user'] = T.user.email;
    var r;
    /* cache:'no-store'：Chrome は同じ URL への同時 GET を「先の返答待ち」で直列化する（HTTP キャッシュのロック）。
       本物の NAS（ファイル直接アクセス）には無い待ちなので、キャッシュを通さず並行に送る。 */
    try { r = await _fetch(nasUrl(path, op, extra), { method: method, headers: headers, body: body, cache: 'no-store' }); }
    catch (e) { throw domErr('NotReadableError', '[testenv nas] network error: ' + e.message); }
    var te = r.headers.get('X-Testenv-Error');
    if (!r.ok || te) {
      var j = {};
      try { j = await r.json(); } catch (_) {}
      throw domErr(j.error || te || 'InvalidStateError', j.message || ('[testenv nas] HTTP ' + r.status));
    }
    return r;
  }
  function joinPath(a, b) { return a ? a + '/' + b : b; }

  function FakeHandle(kind, path, name) {
    this.kind = kind;
    this.name = name;
    this.__testenvFsa = 1; /* IndexedDB に入れても残る印（メソッドは prototype にあるので構造化複製で落ちる） */
    this.__p = path;
  }
  FakeHandle.prototype.queryPermission = async function () { return 'granted'; };
  FakeHandle.prototype.requestPermission = async function () { return 'granted'; };
  FakeHandle.prototype.isSameEntry = async function (o) { return !!o && o.kind === this.kind && o.__p === this.__p; };

  function FakeDirectoryHandle(path, name) { FakeHandle.call(this, 'directory', path, name); }
  FakeDirectoryHandle.prototype = Object.create(FakeHandle.prototype);
  FakeDirectoryHandle.prototype.constructor = FakeDirectoryHandle;
  FakeDirectoryHandle.prototype.getDirectoryHandle = async function (name, opts) {
    name = checkName(name);
    var p = joinPath(this.__p, name);
    if (opts && opts.create) await nasReq('POST', p, 'mkdir');
    else {
      var st = await (await nasReq('GET', p, 'stat')).json();
      if (st.kind !== 'directory') throw domErr('TypeMismatchError', 'The path supplied exists, but was not an entry of requested type.');
    }
    return new FakeDirectoryHandle(p, name);
  };
  FakeDirectoryHandle.prototype.getFileHandle = async function (name, opts) {
    name = checkName(name);
    var p = joinPath(this.__p, name);
    if (opts && opts.create) await nasReq('POST', p, 'touch');
    else {
      var st = await (await nasReq('GET', p, 'stat')).json();
      if (st.kind !== 'file') throw domErr('TypeMismatchError', 'The path supplied exists, but was not an entry of requested type.');
    }
    return new FakeFileHandle(p, name);
  };
  FakeDirectoryHandle.prototype.removeEntry = async function (name, opts) {
    name = checkName(name);
    await nasReq('DELETE', joinPath(this.__p, name), '', undefined, opts && opts.recursive ? 'recursive=1' : '');
  };
  FakeDirectoryHandle.prototype._list = async function () {
    var j = await (await nasReq('GET', this.__p, 'list')).json();
    var self = this;
    return j.entries.map(function (e) {
      var p = joinPath(self.__p, e.name);
      return [e.name, e.kind === 'directory' ? new FakeDirectoryHandle(p, e.name) : new FakeFileHandle(p, e.name)];
    });
  };
  FakeDirectoryHandle.prototype.entries = async function* () { var l = await this._list(); for (var i = 0; i < l.length; i++) yield l[i]; };
  FakeDirectoryHandle.prototype.keys = async function* () { var l = await this._list(); for (var i = 0; i < l.length; i++) yield l[i][0]; };
  FakeDirectoryHandle.prototype.values = async function* () { var l = await this._list(); for (var i = 0; i < l.length; i++) yield l[i][1]; };
  FakeDirectoryHandle.prototype[Symbol.asyncIterator] = FakeDirectoryHandle.prototype.entries;
  FakeDirectoryHandle.prototype.resolve = async function (h) {
    if (!h || !h.__p) return null;
    var me = this.__p ? this.__p + '/' : '';
    if (h.__p === this.__p) return [];
    return h.__p.indexOf(me) === 0 ? h.__p.slice(me.length).split('/') : null;
  };

  function FakeFileHandle(path, name) { FakeHandle.call(this, 'file', path, name); }
  FakeFileHandle.prototype = Object.create(FakeHandle.prototype);
  FakeFileHandle.prototype.constructor = FakeFileHandle;
  FakeFileHandle.prototype.getFile = async function () {
    var r = await nasReq('GET', this.__p);
    var blob = await r.blob();
    var mt = parseInt(r.headers.get('X-Mtime') || '0', 10) || Date.now();
    return new File([blob], this.name, { type: r.headers.get('content-type') || '', lastModified: mt });
  };
  FakeFileHandle.prototype.createWritable = async function (opts) {
    var w = new FakeWritable(this);
    if (opts && opts.keepExistingData) {
      try { var f = await this.getFile(); w._buf = new Uint8Array(await f.arrayBuffer()); } catch (_) {}
    }
    return w;
  };
  FakeFileHandle.prototype.createSyncAccessHandle = async function () { throw domErr('NotSupportedError', '[testenv] createSyncAccessHandle は未対応'); };

  /* 書き込みは close() で一括送信（本物も close 時にスワップファイルから置き換える） */
  function FakeWritable(fh) { this._fh = fh; this._parts = []; this._buf = null; this._pos = 0; this._closed = false; this.locked = false; }
  FakeWritable.prototype._materialize = async function () {
    if (this._parts.length) {
      var add = new Uint8Array(await new Blob(this._parts).arrayBuffer());
      var base = this._buf || new Uint8Array(0);
      var out = new Uint8Array(base.length + add.length);
      out.set(base, 0); out.set(add, base.length);
      this._buf = out; this._parts = [];
    }
    if (!this._buf) this._buf = new Uint8Array(0);
  };
  FakeWritable.prototype.write = async function (data) {
    if (this._closed) throw new TypeError('[testenv] stream is closed');
    if (data && typeof data === 'object' && typeof data.type === 'string' && !(data instanceof Blob)) {
      if (data.type === 'seek') return this.seek(data.position);
      if (data.type === 'truncate') return this.truncate(data.size);
      if (data.type === 'write') { if (data.position != null) await this.seek(data.position); data = data.data; }
    }
    var chunk = (typeof data === 'string') ? new Blob([data]) : (data instanceof Blob ? data : new Blob([data]));
    var endLen = (this._buf ? this._buf.length : 0) + this._parts.reduce(function (s, p) { return s + p.size; }, 0);
    if (this._pos === endLen) { this._parts.push(chunk); this._pos += chunk.size; return; }
    await this._materialize();
    var bytes = new Uint8Array(await chunk.arrayBuffer());
    var need = Math.max(this._buf.length, this._pos + bytes.length);
    if (need > this._buf.length) { var nb = new Uint8Array(need); nb.set(this._buf, 0); this._buf = nb; }
    this._buf.set(bytes, this._pos);
    this._pos += bytes.length;
  };
  FakeWritable.prototype.seek = async function (pos) { await this._materialize(); this._pos = pos; };
  FakeWritable.prototype.truncate = async function (size) {
    await this._materialize();
    var nb = new Uint8Array(size); nb.set(this._buf.subarray(0, Math.min(size, this._buf.length)), 0);
    this._buf = nb; if (this._pos > size) this._pos = size;
  };
  FakeWritable.prototype.close = async function () {
    if (this._closed) throw new TypeError('[testenv] stream is closed');
    this._closed = true;
    var body = this._buf ? new Blob([this._buf].concat(this._parts)) : new Blob(this._parts);
    await nasReq('PUT', this._fh.__p, '', body);
  };
  FakeWritable.prototype.abort = async function () { this._closed = true; this._parts = []; this._buf = null; };
  FakeWritable.prototype.getWriter = function () {
    var self = this;
    return { write: function (d) { return self.write(d); }, close: function () { return self.close(); }, abort: function () { return self.abort(); }, releaseLock: function () {}, ready: Promise.resolve() };
  };

  T.FakeDirectoryHandle = FakeDirectoryHandle;
  T.FakeFileHandle = FakeFileHandle;
  T.nasDir = function (path) { var p = String(path || '').split('/').filter(Boolean).join('/'); return new FakeDirectoryHandle(p, p.split('/').pop() || 'nas'); };

  function rehydrate(v) {
    if (!v || typeof v !== 'object') return v;
    if (v.__testenvFsa === 1 && !(v instanceof FakeHandle)) {
      return v.kind === 'file' ? new FakeFileHandle(v.__p, v.name) : new FakeDirectoryHandle(v.__p, v.name);
    }
    if (Array.isArray(v)) {
      var changed = false;
      var out = v.map(function (x) { var y = rehydrate(x); if (y !== x) changed = true; return y; });
      return changed ? out : v;
    }
    return v;
  }
  try {
    var rd = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
    Object.defineProperty(IDBRequest.prototype, 'result', {
      configurable: true, enumerable: rd.enumerable,
      get: function () { return rehydrate(rd.get.call(this)); },
    });
    var cd = Object.getOwnPropertyDescriptor(IDBCursorWithValue.prototype, 'value');
    Object.defineProperty(IDBCursorWithValue.prototype, 'value', {
      configurable: true, enumerable: cd.enumerable,
      get: function () { return rehydrate(cd.get.call(this)); },
    });
  } catch (e) { console.error('[testenv] IndexedDB フック失敗', e); }

  /* ---------------- フォルダ選択（showDirectoryPicker の差し替え） */
  T.nextPick = null; /* 自動化用：パス文字列を入れておくと次の showDirectoryPicker がダイアログを出さずに返す */
  window.showDirectoryPicker = async function () {
    if (T.nextPick != null) { var p = T.nextPick; T.nextPick = null; return T.nasDir(p); }
    var picked = await folderPickerUI();
    if (picked == null) throw domErr('AbortError', 'The user aborted a request.');
    return T.nasDir(picked);
  };

  /* ---------------- UI（バッジ・フォルダ選択・ユーザー選択） */
  var Z = 2147483000;
  function h(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function whenBody(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn, { once: true }); }
  var BTN = 'all:initial;font:600 12px system-ui,sans-serif;padding:6px 12px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#eee;cursor:pointer;';
  var BTN_P = BTN + 'background:#e8e8e8;color:#111;border-color:#e8e8e8;';
  function overlay() {
    var ov = h('div', 'position:fixed;inset:0;z-index:' + (Z + 2) + ';background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;');
    var box = h('div', 'all:initial;display:block;font:13px system-ui,sans-serif;color:#eee;background:#1b1b1b;border:1px solid #444;border-radius:10px;padding:16px 18px;width:min(520px,92vw);max-height:80vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.5);');
    ov.appendChild(box);
    document.body.appendChild(ov);
    return { ov: ov, box: box };
  }

  function folderPickerUI() {
    return new Promise(function (resolve) {
      whenBody(function () {
        var o = overlay(), cur = '';
        function close(v) { o.ov.remove(); resolve(v); }
        async function draw() {
          o.box.innerHTML = '';
          o.box.appendChild(h('div', 'font-weight:700;font-size:14px;margin-bottom:4px;', '🧪 testenv：偽 NAS のフォルダを選択'));
          o.box.appendChild(h('div', 'color:#aaa;font-size:11px;margin-bottom:10px;', '実体は testenv/data/nas/ です。全ユーザーで共有されます。'));
          o.box.appendChild(h('div', 'font-family:monospace;color:#9cf;margin-bottom:8px;', 'nas/' + cur));
          var list = h('div', 'border:1px solid #333;border-radius:6px;max-height:300px;overflow:auto;margin-bottom:10px;');
          o.box.appendChild(list);
          if (cur) {
            var up = h('div', 'padding:6px 10px;cursor:pointer;color:#ccc;', '⬆ ..');
            up.onclick = function () { cur = cur.split('/').slice(0, -1).join('/'); draw(); };
            list.appendChild(up);
          }
          try {
            var r = await _fetch(nasUrl(cur, 'list'), { headers: { 'x-testenv-bypass': '1' } });
            var j = await r.json();
            var dirs = (j.entries || []).filter(function (e) { return e.kind === 'directory'; });
            var files = (j.entries || []).filter(function (e) { return e.kind === 'file'; });
            if (!dirs.length && !files.length) list.appendChild(h('div', 'padding:8px 10px;color:#777;', '（空）'));
            dirs.forEach(function (e) {
              var row = h('div', 'padding:6px 10px;cursor:pointer;border-top:1px solid #2a2a2a;', '📁 ' + e.name);
              row.onclick = function () { cur = joinPath(cur, e.name); draw(); };
              list.appendChild(row);
            });
            files.slice(0, 12).forEach(function (e) { list.appendChild(h('div', 'padding:4px 10px;color:#777;border-top:1px solid #2a2a2a;font-size:11px;', '📄 ' + e.name)); });
          } catch (e) { list.appendChild(h('div', 'padding:8px;color:#f88;', '一覧の取得に失敗: ' + e.message)); }
          var row2 = h('div', 'display:flex;gap:6px;margin-bottom:10px;');
          var inp = h('input', 'all:initial;flex:1;font:12px system-ui;padding:6px 8px;border:1px solid #444;border-radius:6px;background:#111;color:#eee;');
          inp.placeholder = '新しいフォルダ名';
          var mk = h('button', BTN, '作成して開く');
          mk.onclick = async function () {
            var n = (inp.value || '').trim(); if (!n) return;
            try { await nasReq('POST', joinPath(cur, n), 'mkdir'); cur = joinPath(cur, n); draw(); } catch (e) { alert(e.message); }
          };
          row2.appendChild(inp); row2.appendChild(mk);
          o.box.appendChild(row2);
          var foot = h('div', 'display:flex;gap:8px;justify-content:flex-end;');
          var cancel = h('button', BTN, 'キャンセル'); cancel.onclick = function () { close(null); };
          var ok = h('button', BTN_P, cur ? 'このフォルダを選択' : '（フォルダを選んでください）');
          ok.disabled = !cur;
          ok.onclick = function () { if (cur) close(cur); };
          foot.appendChild(cancel); foot.appendChild(ok);
          o.box.appendChild(foot);
        }
        draw();
      });
    });
  }

  T.pickUser = function () {
    if (T.nextUser) { var nu = normUser(T.nextUser); T.nextUser = null; T.setUser(nu); return Promise.resolve(nu); }
    return new Promise(function (resolve) {
      whenBody(function () {
        var o = overlay();
        o.box.appendChild(h('div', 'font-weight:700;font-size:14px;margin-bottom:10px;', '🧪 testenv：ログインするテストユーザー'));
        (info.users || []).forEach(function (u) {
          var row = h('div', 'display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #333;border-radius:6px;margin-bottom:6px;cursor:pointer;');
          row.appendChild(h('div', 'font-weight:700;min-width:70px;', u.name || u.id));
          row.appendChild(h('div', 'color:#9cf;font-family:monospace;font-size:11px;min-width:150px;', u.email));
          row.appendChild(h('div', 'color:#999;font-size:11px;', u.note || ''));
          row.onclick = function () { o.ov.remove(); var nu = normUser(u.id); T.setUser(nu); resolve(nu); };
          o.box.appendChild(row);
        });
        var cancel = h('button', BTN, 'キャンセル');
        cancel.onclick = function () { o.ov.remove(); resolve(null); };
        o.box.appendChild(cancel);
      });
    });
  };

  var badge = null;
  function renderBadge() {
    if (!document.body) return;
    if (!badge) {
      badge = h('div', 'all:initial;position:fixed;left:8px;bottom:8px;z-index:' + Z + ';font:600 11px system-ui,sans-serif;color:#111;background:#ffd54a;border-radius:999px;padding:4px 10px;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer;opacity:.92;user-select:none;');
      badge.title = 'testenv（クリックでメニュー）';
      badge.onclick = openMenu;
      document.body.appendChild(badge);
    }
    var warn = T.blocked.length + T.cspViolations.length;
    badge.textContent = '🧪 TESTENV :' + location.port + ' · ' + (T.user ? T.user.email : '未ログイン') + (warn ? ' · 遮断 ' + warn : '');
    badge.style.background = warn ? '#ff9b6a' : '#ffd54a';
  }
  function openMenu() {
    var o = overlay();
    o.box.appendChild(h('div', 'font-weight:700;font-size:14px;margin-bottom:8px;', '🧪 testenv'));
    o.box.appendChild(h('div', 'color:#aaa;font-size:11px;margin-bottom:10px;', 'ポート ' + location.port + ' ／ ' + (T.user ? T.user.email : '未ログイン') + ' ／ ブラウザ内保存はポートごとに独立'));
    o.box.appendChild(h('div', 'font-weight:700;margin:6px 0;', 'このポートのユーザーを切り替え（再読み込み）'));
    var wrap = h('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;');
    (info.users || []).forEach(function (u) {
      var b = h('button', BTN, u.name || u.id);
      b.onclick = function () { var s = new URLSearchParams(location.search); s.set('as', u.id); location.search = s.toString(); };
      wrap.appendChild(b);
    });
    var lo = h('button', BTN, '未ログイン');
    lo.onclick = function () { var s = new URLSearchParams(location.search); s.set('as', 'none'); location.search = s.toString(); };
    wrap.appendChild(lo);
    o.box.appendChild(wrap);
    if (T.blocked.length || T.cspViolations.length) {
      o.box.appendChild(h('div', 'font-weight:700;margin:6px 0;color:#f99;', '遮断した通信'));
      T.blocked.concat(T.cspViolations).slice(-10).forEach(function (b) { o.box.appendChild(h('div', 'font-family:monospace;font-size:11px;color:#f99;word-break:break-all;', (b.kind || b.directive) + ' ' + (b.url || ''))); });
    }
    var foot = h('div', 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;');
    var con = h('button', BTN, 'コンソールを開く');
    con.onclick = function () { window.open('/testenv/console.html', '_blank'); };
    var cl = h('button', BTN_P, '閉じる');
    cl.onclick = function () { o.ov.remove(); };
    foot.appendChild(con); foot.appendChild(cl);
    o.box.appendChild(foot);
    o.ov.onclick = function (e) { if (e.target === o.ov) o.ov.remove(); };
  }
  whenBody(renderBadge);

  /* ---------------- 検証スクリプト用ヘルパー */
  async function ctl(method, sub, body) {
    var r = await _fetch('/__testenv/' + sub, { method: method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }
  T.ctl = ctl;
  T.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.waitFor = async function (fn, timeoutMs, stepMs) {
    var end = Date.now() + (timeoutMs || 10000);
    while (Date.now() < end) { try { var v = await fn(); if (v) return v; } catch (_) {} await T.sleep(stepMs || 100); }
    throw new Error('[testenv] waitFor timeout');
  };
  T.faults = {
    list: function () { return ctl('GET', 'faults'); },
    set: function (rules) { return ctl('POST', 'faults', { rules: rules || [] }); },
    add: function (rule) { return ctl('POST', 'faults', { rule: rule }); },
    clear: function () { return ctl('DELETE', 'faults'); },
  };
  T.log = {
    since: function (seq) { return ctl('GET', 'log?since=' + (seq || 0)); },
    mark: async function () { return (await ctl('GET', 'info')).seq; },
    reads: function (on) { return ctl('POST', 'config', { logReads: !!on }); },
  };
  /* 偽 NAS を障害注入なしで直接読む（検証用） */
  T.nas = {
    read: async function (path) {
      var r = await _fetch(nasUrl(path), { headers: { 'x-testenv-bypass': '1' }, cache: 'no-store' });
      if (!r.ok || r.headers.get('X-Testenv-Error')) return null;
      return r.text();
    },
    readJson: async function (path) { var t = await T.nas.read(path); try { return t == null ? null : JSON.parse(t); } catch (_) { return null; } },
    list: async function (path) {
      var r = await _fetch(nasUrl(path, 'list'), { headers: { 'x-testenv-bypass': '1' }, cache: 'no-store' });
      if (!r.ok || r.headers.get('X-Testenv-Error')) return null;
      return (await r.json()).entries;
    },
  };
  /* 再現シナリオの実行：testenv/scenarios/<name>.js を async 関数として実行（引数 T, params）。
     本体のグローバル（DB / getNode / setStatus / persist / autoRefresh など）をそのまま使える。 */
  T.run = async function (name, params) {
    var r = await _fetch('/testenv/scenarios/' + encodeURIComponent(name) + '.js', { cache: 'no-store' });
    if (!r.ok) throw new Error('[testenv] scenario not found: ' + name);
    var code = await r.text();
    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    return new AsyncFunction('T', 'params', code + '\n//# sourceURL=testenv/scenarios/' + name + '.js')(T, params || {});
  };
  /* 偽 R2 を障害注入なしで直接読む（検証用）。key は 'tenants/<tid>/projects/<pid>/...' */
  T.r2 = {
    read: async function (key) {
      var r = await _fetch('/api/r2/' + String(key).replace(/^\/+/, ''), {
        headers: { authorization: 'Bearer testenv:' + (T.user ? T.user.email : ''), 'x-testenv-bypass': '1' }, cache: 'no-store' });
      if (!r.ok) return null;
      return r.text();
    },
    readJson: async function (key) { var t = await T.r2.read(key); try { return t == null ? null : JSON.parse(t); } catch (_) { return null; } },
  };
  T.fsdump = function () { return ctl('GET', 'fsdump'); };
  T.snapshot = function (name) { return ctl('POST', 'snapshot', { name: name }); };
  T.restore = function (name) { return ctl('POST', 'snapshot', { name: name, restore: true }); };

  console.info('%c🧪 LayCAT testenv', 'background:#ffd54a;color:#111;padding:2px 6px;border-radius:4px;font-weight:700',
    'port=' + location.port, 'user=' + (T.user ? T.user.email : '(未ログイン)'));
})();
