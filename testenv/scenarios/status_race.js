/* シナリオ①：他の人の変更の取り込み（autoRefresh）の最中に自分がステータスを変えると、
 *            取り込みが読んだ古い値で自分の変更が上書きされるか？
 *
 * 実行：NAS プロジェクトを開いたタブのコンソールで
 *   await __testenv.run('status_race')                       // 自動でショットと変更先を選ぶ
 *   await __testenv.run('status_race', {shotId:'nd_xxx', to:'approved', delayMs:3000})
 *
 * 手順（本体の処理をそのまま呼ぶ。ファイルへの書き込みは「ステータス変更 1 回分」だけ＝通常操作と同じ）
 *   1. 偽 NAS に障害注入：このユーザーの status/*.json 読み込みだけ「中身は即読む・返答を delayMs 遅らせる」
 *      （取り込みが読む分の回数だけ。自分のステータス保存時の読み込みには効かない）
 *   2. autoRefresh(true)（タブに戻った時と同じ取り込み）を開始
 *   3. 取り込みが status を読み終えた（古い値を掴んだ）のを待ってから、
 *      ステータスのプルダウン変更と同じ処理（setStatus → persist）を実行
 *   4. 取り込みの完了を待ち、画面上の値（メモリ）とディスクの値を比べる
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
const delayMs = params.delayMs || 3000;

const files = (await T.nas.list(folder + '/status')) || [];
const nStatus = files.filter(f => f.kind === 'file' && f.name.endsWith('.json')).length;
if (!nStatus) throw new Error('status/ にファイルがありません（先にどれかのショットのステータスを 1 回変えてください）');

const mark = await T.log.mark();
const userEmail = T.user && T.user.email;
/* op:'read' … 中身の読み込みだけ（存在確認 stat には効かせない） */
await T.faults.set([{ area: 'nas', op: 'read', path: '/status/[^/]+\\.json$', delayMs, delayPhase: 'after', user: userEmail, times: nStatus }]);
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);
const timeline = [];
let refreshDone = false;
const refreshP = autoRefresh(true).then(() => { refreshDone = true; timeline.push([ms(), '取り込み（autoRefresh）完了']); });
timeline.push([ms(), '取り込み開始（status/*.json ' + nStatus + ' 件の返答を ' + delayMs + 'ms 遅延）']);
/* 取り込みが status を全部要求した＝古い値を掴んだのを待つ */
await T.waitFor(async () => { const f = (await T.faults.list()).faults[0]; return f && f.times <= 0; }, 15000, 50);
timeline.push([ms(), '取り込みが status を読んだ（中身は古い値で確定済み）']);

/* ステータスのプルダウン変更と同じ処理（laycat_dev.html の sel.onchange と同じ） */
await setStatus(shot, to, 'ui');
timeline.push([ms(), 'ステータスを ' + before + ' → ' + to + ' に変更（setStatus 完了）']);
await persist();
timeline.push([ms(), 'persist 完了（refreshDone=' + refreshDone + '）']);
const memRightAfter = shot.status || null;

await refreshP;
await T.sleep(300);
await T.faults.clear();

const memAfter = (getNode(shot.id) || shot).status || null;
const disk = await T.nas.readJson(folder + '/status/' + shot.id + '.json');
const writes = (await T.log.since(mark)).entries.filter(e => e.area === 'nas' && e.op !== 'stat' && e.op !== 'read' && e.op !== 'list');
const result = {
  scenario: '① 取り込み中のステータス変更',
  shot: shot.name + ' (' + shot.id + ')',
  before, to,
  memRightAfterChange: memRightAfter,
  memAfterRefresh: memAfter,
  disk: disk && disk.status,
  reproduced: memAfter !== to,
  verdict: memAfter !== to
    ? '再現：画面上のステータスが ' + to + ' → ' + memAfter + ' に戻った（ディスクは ' + (disk && disk.status) + '）'
    : '再現せず：画面上も ' + to + ' のまま',
  timeline,
  writes: writes.map(e => e.op + ' ' + e.path),
};
try { render(); } catch (_) {}
console.log('[testenv] status_race', result);
return result;
