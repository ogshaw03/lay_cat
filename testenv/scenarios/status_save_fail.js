/* シナリオ②：ステータスの保存（status/{sid}.json の書き込み）が失敗したとき、
 *            利用者に知らされるか？ 画面とディスクはどうなるか？
 *
 * 実行：NAS プロジェクトを開いたタブのコンソールで
 *   await __testenv.run('status_save_fail')
 *   await __testenv.run('status_save_fail', {shotId:'nd_xxx', to:'approved', error:'InvalidStateError'})
 *
 * 手順
 *   1. 偽 NAS に障害注入：このショットの status/{sid}.json への書き込みを数回失敗させる
 *      （NAS の瞬断・同期ソフトのロックなどを想定。error は DOMException 名）
 *   2. ステータスのプルダウン変更と同じ処理（setStatus → persist）
 *   3. 画面上の値・ディスクの値・トースト表示を確認
 *   4. 障害を解除してから取り込み（autoRefresh）を 1 回実行し、画面の値がどうなるかを確認
 *   5. リロードした場合に表示される値（ディスクから読み直した値）を読み取り専用で確認
 * 書き込み：失敗させたステータス保存の試行と、persist（通常のステータス変更と同じ範囲）のみ。
 */
const pid = params.pid || ((REG.find(e => e.backend !== 'r2') || {}).id);
if (!pid) throw new Error('NAS プロジェクトが接続されていません');
const ph = storage.projHandles.get(pid) || await storage.projRoot(pid);
if (!ph || !ph.__p) throw new Error('偽 NAS のフォルダに接続されたプロジェクトではありません');
const folder = ph.__p;
const shot = params.shotId ? getNode(params.shotId) : DB.nodes.find(n => rootOfId(n) === pid && n.kind === 'shot');
if (!shot) throw new Error('ショットが見つかりません');
const opts = projStatuses(shot).map(s => s.id);
const before = shot.status || null;
const to = params.to || opts.find(s => s !== before);
const statusPath = folder + '/status/' + shot.id + '.json';
const diskBefore = ((await T.nas.readJson(statusPath)) || {}).status || null;

/* トーストの監視（本体の toast() が出す要素を拾う） */
const toasts = [];
const mo = new MutationObserver(ms => {
  for (const m of ms) for (const n of m.addedNodes) {
    if (n.nodeType === 1 && /toast/i.test(n.className || '') && n.textContent) toasts.push(n.textContent.trim());
  }
});
mo.observe(document.body, { childList: true, subtree: true });
const _warn = console.warn; const warns = [];
console.warn = function () { try { warns.push([...arguments].map(x => (x && x.message) || (typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 200)); } catch (_) {} return _warn.apply(console, arguments); };

const mark = await T.log.mark();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
await T.faults.set([{ area: 'nas', op: 'write', path: esc('/status/' + shot.id + '.json') + '$', failRate: 1,
  error: params.error || 'InvalidStateError', times: params.times || 5 }]);

/* ステータスのプルダウン変更と同じ処理 */
const ret = await setStatus(shot, to, 'ui');
await persist();
try { render(); } catch (_) {}
await T.sleep(800);
await T.faults.clear();
const memAfterChange = shot.status || null;
const diskAfterChange = ((await T.nas.readJson(statusPath)) || {}).status || null;

/* 障害解除後の取り込み（タブに戻った／30 秒ごとの自動取り込み） */
await autoRefresh(true);
await T.sleep(300);
const memAfterRefresh = (getNode(shot.id) || shot).status || null;

/* リロードした場合に見える値：ディスクから読み直す（読み取りのみ・DB は変えない） */
const remote = await storage.readProjectData(pid);
const rn = remote && (remote.nodes || []).find(n => n.id === shot.id);
const reloadWouldShow = rn ? (rn.status || null) : '(不明)';

mo.disconnect();
console.warn = _warn;
const writes = (await T.log.since(mark)).entries.filter(e => e.area === 'nas' && !['stat', 'read', 'list'].includes(e.op));
const result = {
  scenario: '② ステータス保存の失敗',
  shot: shot.name + ' (' + shot.id + ')',
  before, to, diskBefore,
  setStatusReturned: ret,
  memAfterChange, diskAfterChange,
  memAfterRefresh, reloadWouldShow,
  toasts, warns: warns.filter(w => /status|ステータス/i.test(w)),
  reproduced: diskAfterChange !== to,
  verdict: (diskAfterChange !== to)
    ? '再現：保存に失敗（ディスクは ' + diskAfterChange + ' のまま）。setStatus は ' + ret + ' を返し、トースト ' + (toasts.length ? 'あり' : 'なし') +
      '。画面は変更直後 ' + memAfterChange + ' → 取り込み後 ' + memAfterRefresh + '、リロード後は ' + reloadWouldShow
    : '再現せず：ディスクにも ' + to + ' が保存された',
  writes: writes.map(e => e.op + ' ' + e.path + (e.fault ? ' [注入失敗 ' + e.status + ']' : '')),
};
console.log('[testenv] status_save_fail', result);
return result;
