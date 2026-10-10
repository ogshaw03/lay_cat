/*
 * LayCAT デモプロジェクト注入スクリプト
 *
 * 用途：取説用スクショ・プレゼン・開発中の UI 確認。
 *       実データなしでショット一覧／PM Board／REEL／各モーダルを「埋まった状態」で見せる。
 *
 * 使い方：
 *   1. LayCAT (laycat_dev.html または laycat.html) を開く
 *   2. ブラウザの DevTools (F12) → Console タブを開く
 *   3. このファイル全文をコピーしてコンソールに貼り付け → Enter
 *   4. 画面にデモプロジェクト `DEMO_プロジェクト` が現れる
 *
 * 特徴：
 *   - 2 エピソード × 2 シーケンス × 計 18 ショット
 *   - 工程 3 種（レイアウト／動画／仕上げ）
 *   - ステータス分布（チェック待ち／OK／リテイク／完了／オミット）に偏りを持たせてある
 *   - 担当者 4 名でアサインを散らす
 *   - サムネイル・動画実体は無し（枠だけ出る）
 *
 * 除去：
 *   DB.nodes = DB.nodes.filter(n => !String(n.id||'').startsWith('nd_demo_'));
 *   state.currentId = null; render();
 *
 * 永続化しません（REG への保存は呼んでいない）。リロードで消えます。
 */
(function injectDemo(){
  const now = new Date().toISOString();
  const rootId = 'nd_demo_root';

  // ===== Root（プロジェクト） =====
  DB.nodes.push({
    id: rootId, parentId: null, name: 'DEMO_プロジェクト', type: 'section',
    description: '取説用のサンプルプロジェクト', thumbnail: null, createdAt: now, versions: [],
    stages: [
      { id:'lay', label:'レイアウト', color:'#5A9BFF' },
      { id:'anm', label:'動画',       color:'#5CB878' },
      { id:'col', label:'仕上げ',     color:'#F2986B' },
    ],
    members: [
      { email:'director@example.com', name:'山田監督', role:'director' },
      { email:'pm@example.com',       name:'佐藤制作', role:'pm' },
      { email:'anim@example.com',     name:'鈴木作画', role:'animator' },
      { email:'paint@example.com',    name:'田中仕上', role:'paint' },
    ],
  });

  // ===== エピソード × シーケンス =====
  const structure = [
    { ep:'EP01', sqs:[
      { sq:'A-pt', shots:[
        { nm:'sh001', stage:'anm', status:'pending',  worker:'鈴木作画' },
        { nm:'sh002', stage:'lay', status:'approved', worker:'山田監督' },
        { nm:'sh003', stage:'col', status:'retake',   worker:'田中仕上' },
        { nm:'sh004', stage:'anm', status:'pending',  worker:'鈴木作画' },
        { nm:'sh005', stage:'col', status:'approved', worker:'田中仕上' },
      ]},
      { sq:'B-pt', shots:[
        { nm:'sh006', stage:'lay', status:'pending',  worker:'山田監督' },
        { nm:'sh007', stage:'anm', status:'retake',   worker:'鈴木作画' },
        { nm:'sh008', stage:'col', status:'approved', worker:'田中仕上' },
        { nm:'sh009', stage:'lay', status:'omit',     worker:'-' },
      ]},
    ]},
    { ep:'EP02', sqs:[
      { sq:'A-pt', shots:[
        { nm:'sh010', stage:'anm', status:'pending',  worker:'鈴木作画' },
        { nm:'sh011', stage:'lay', status:'approved', worker:'山田監督' },
        { nm:'sh012', stage:'col', status:'pending',  worker:'田中仕上' },
        { nm:'sh013', stage:'anm', status:'retake',   worker:'鈴木作画' },
        { nm:'sh014', stage:'anm', status:'pending',  worker:'鈴木作画' },
      ]},
      { sq:'B-pt', shots:[
        { nm:'sh015', stage:'lay', status:'pending',  worker:'山田監督' },
        { nm:'sh016', stage:'col', status:'approved', worker:'田中仕上' },
        { nm:'sh017', stage:'lay', status:'omit',     worker:'-' },
        { nm:'sh018', stage:'anm', status:'approved', worker:'鈴木作画' },
      ]},
    ]},
  ];

  const reviewStages = [
    { id:'lay', label:'レイアウト' },
    { id:'anm', label:'動画' },
    { id:'col', label:'仕上げ' },
  ];

  let shotCount = 0;
  for (const ep of structure) {
    const epId = 'nd_demo_' + ep.ep.toLowerCase();
    DB.nodes.push({
      id: epId, parentId: rootId, name: ep.ep, type: 'section', createdAt: now, versions: [],
    });
    for (const sq of ep.sqs) {
      const sqId = epId + '_' + sq.sq.toLowerCase().replace(/[^a-z0-9]/g,'');
      DB.nodes.push({
        id: sqId, parentId: epId, name: sq.sq, type: 'section', createdAt: now, versions: [],
      });
      for (const sh of sq.shots) {
        const shId = 'nd_demo_' + sh.nm;
        DB.nodes.push({
          id: shId, parentId: sqId, name: sh.nm, type: 'section', kind: 'shot',
          currentStage: sh.stage, status: sh.status, createdAt: now, versions: [],
          assignedWorker: sh.worker, assignedChecker: '山田監督',
        });
        // _isShotLikeNode 判定を通すため review 子ノードを追加（stage 分）
        for (const st of reviewStages) {
          DB.nodes.push({
            id: shId + '_r_' + st.id, parentId: shId, name: st.label,
            type: 'review', createdAt: now, versions: [],
          });
        }
        shotCount++;
      }
    }
  }

  state.currentId = rootId;
  try { render(); } catch(e) { console.warn('render error:', e); }
  console.log('[LayCAT demo] injected', shotCount, 'shots across', structure.length, 'episodes.');
  return 'OK: '+shotCount+' shots';
})();
