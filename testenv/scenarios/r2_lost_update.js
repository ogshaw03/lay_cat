/* シナリオ③：R2 プロジェクトで、A さんのステータス変更が B さんの「無関係な保存」で消えるか？
 *   R2 ではステータスがプロジェクト骨格（laycat.project.json）に入っていて、保存は丸ごと上書き。
 *
 * 2 つのタブ（別ポート＝別ユーザー）で同じ R2 プロジェクトを開き、順番に実行する：
 *   A のタブ： await __testenv.run('r2_lost_update', {step:1, shotId:'<A が変えるショット>', to:'approved'})
 *   B のタブ： await __testenv.run('r2_lost_update', {step:2, otherShotId:'<B がメモを書く別ショット>', shotId:'<同上 A のショット>'})
 *              ※ A の step1 から 30 秒以内（B の自動取り込みより前）に実行する
 *   A のタブ： await __testenv.run('r2_lost_update', {step:3, shotId:'<A のショット>'})
 * 書き込み：step1 = A のステータス変更（通常操作と同じ）、step2 = B の説明文の保存（通常操作と同じ）。
 */
const step = params.step | 0;
const shot = getNode(params.shotId);
if (!shot) throw new Error('shotId のショットが見つかりません');
const pid = rootOfId(shot);
if (storage._backend(pid) !== 'r2') throw new Error('R2 プロジェクトではありません');
const tid = storage._r2._resolveTid(pid);
const skeletonStatus = async () => {
  const pj = await T.r2.readJson('tenants/' + tid + '/projects/' + pid + '/laycat.project.json');
  const n = pj && (pj.nodes || []).find(x => x.id === shot.id);
  return n ? (n.status || null) : '(ノードなし)';
};

if (step === 1) {
  const before = shot.status || null;
  const to = params.to || projStatuses(shot).map(s => s.id).find(s => s !== before);
  await setStatus(shot, to, 'ui');
  await persist();
  return { step: 1, who: T.user.email, shot: shot.name, before, to, onServer: await skeletonStatus(),
    next: '30 秒以内に B のタブで step:2 を実行' };
}
if (step === 2) {
  const other = getNode(params.otherShotId);
  if (!other) throw new Error('otherShotId のショットが見つかりません');
  const bobSees = shot.status || null;
  other.description = (other.description || '') + ' [testenv ' + new Date().toLocaleTimeString() + ' のメモ]';
  await persist();
  return { step: 2, who: T.user.email, savedOnly: other.name + ' の説明文', thisUserSawTargetAs: bobSees,
    targetOnServerAfterSave: await skeletonStatus(), next: 'A のタブで step:3 を実行' };
}
if (step === 3) {
  const memBefore = shot.status || null;
  await autoRefresh(true);
  await T.sleep(300);
  const memAfter = (getNode(shot.id) || shot).status || null;
  const onServer = await skeletonStatus();
  return { step: 3, who: T.user.email, shot: shot.name, screenBeforeRefresh: memBefore, screenAfterRefresh: memAfter, onServer,
    reproduced: memBefore !== memAfter || onServer !== memBefore,
    verdict: (onServer !== memBefore) ? '再現：A のステータス ' + memBefore + ' がサーバー上で ' + onServer + ' に戻り、画面も ' + memAfter + ' になった' : '再現せず' };
}
throw new Error('params.step は 1 / 2 / 3');
