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

  /* v.016：デモ用のサンプル画像を canvas で生成（アノテ窓・タイムリマップ UI を試せるように）。
     ショット名を描き入れた 1280x720 の PNG を data URL で返す。
     storage.urlCache に先に入れておけば getURL() がネットワーク往復ゼロで解決してくれる。 */
  function _makeDemoFrame(shotName, stage, bg1, bg2){
    try{
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d');
      /* 背景グラデ */
      const g = ctx.createLinearGradient(0,0,c.width,c.height);
      g.addColorStop(0, bg1);
      g.addColorStop(1, bg2);
      ctx.fillStyle = g;
      ctx.fillRect(0,0,c.width,c.height);
      /* センター円（キャラアタリ） */
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.width/2, c.height/2 - 40, 120, 0, Math.PI*2); ctx.stroke();
      /* 体 */
      ctx.beginPath(); ctx.moveTo(c.width/2, c.height/2 + 80); ctx.lineTo(c.width/2, c.height/2 + 240); ctx.stroke();
      /* 腕 */
      ctx.beginPath(); ctx.moveTo(c.width/2, c.height/2 + 120); ctx.lineTo(c.width/2 - 140, c.height/2 + 200); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.width/2, c.height/2 + 120); ctx.lineTo(c.width/2 + 140, c.height/2 + 200); ctx.stroke();
      /* 脚 */
      ctx.beginPath(); ctx.moveTo(c.width/2, c.height/2 + 240); ctx.lineTo(c.width/2 - 90, c.height/2 + 360); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.width/2, c.height/2 + 240); ctx.lineTo(c.width/2 + 90, c.height/2 + 360); ctx.stroke();
      /* ショット情報オーバーレイ */
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(32, 32, 300, 70);
      ctx.fillStyle = '#F2C86B';
      ctx.font = 'bold 32px "Space Grotesk", sans-serif';
      ctx.fillText(shotName, 48, 68);
      ctx.fillStyle = '#aaa';
      ctx.font = '18px sans-serif';
      ctx.fillText(stage + ' / DEMO', 48, 92);
      /* セーフフレーム */
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8,8]);
      ctx.strokeRect(80, 60, c.width - 160, c.height - 120);
      ctx.setLineDash([]);
      /* 右下ウォーターマーク */
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '14px sans-serif';
      ctx.fillText('🎬 LayCAT DEMO — サンプルフレーム', c.width - 320, c.height - 30);
      return c.toDataURL('image/png', 0.9);
    }catch(e){ return null; }
  }

  /* storage.urlCache にデモ画像を事前投入するためのヘルパ */
  function _registerDemoImage(ref, dataUrl){
    try{
      if(typeof storage!=='undefined' && storage.urlCache && dataUrl){
        storage.urlCache.set(ref, dataUrl);
      }
    }catch(_){}
  }

  // ===== Root（プロジェクト） =====
  // 注意：root.stages は **文字列配列** が正。openAddModal の工程編集 UI は
  //       `inp.value = nm` で表示するため、オブジェクト配列を入れると [object Object] と表示される。
  //       色は root.stageColors（{name: color}）に別途保存される。
  DB.nodes.push({
    id: rootId, parentId: null, name: 'DEMO_プロジェクト', type: 'section',
    description: '取説用のサンプルプロジェクト', thumbnail: null, createdAt: now, versions: [],
    stages: ['レイアウト', '動画', '仕上げ'],
    stageTemplates: [
      { id:'tpl_default', name:'テンプレートA', stages:['レイアウト','動画','仕上げ'] },
    ],
    stageColors: { 'レイアウト':'#5A9BFF', '動画':'#5CB878', '仕上げ':'#F2986B' },
    members: [
      { email:'director@example.com', name:'山田監督', role:'director' },
      { email:'pm@example.com',       name:'佐藤制作', role:'pm' },
      { email:'anim@example.com',     name:'鈴木作画', role:'animator' },
      { email:'paint@example.com',    name:'田中仕上', role:'paint' },
    ],
  });

  // ===== エピソード × シーケンス =====
  // 注意：shot.currentStage は stage の **label**（名前）を入れること。
  //       進捗タブは review 子ノードの name と currentStage の文字列一致で現工程を特定する。
  const structure = [
    { ep:'EP01', sqs:[
      { sq:'A-pt', shots:[
        { nm:'sh001', stage:'動画',       status:'pending',  worker:'鈴木作画' },
        { nm:'sh002', stage:'レイアウト', status:'approved', worker:'山田監督' },
        { nm:'sh003', stage:'仕上げ',     status:'retake',   worker:'田中仕上' },
        { nm:'sh004', stage:'動画',       status:'pending',  worker:'鈴木作画' },
        { nm:'sh005', stage:'仕上げ',     status:'approved', worker:'田中仕上' },
      ]},
      { sq:'B-pt', shots:[
        { nm:'sh006', stage:'レイアウト', status:'pending',  worker:'山田監督' },
        { nm:'sh007', stage:'動画',       status:'retake',   worker:'鈴木作画' },
        { nm:'sh008', stage:'仕上げ',     status:'approved', worker:'田中仕上' },
        { nm:'sh009', stage:'レイアウト', status:'omit',     worker:'-' },
      ]},
    ]},
    { ep:'EP02', sqs:[
      { sq:'A-pt', shots:[
        { nm:'sh010', stage:'動画',       status:'pending',  worker:'鈴木作画' },
        { nm:'sh011', stage:'レイアウト', status:'approved', worker:'山田監督' },
        { nm:'sh012', stage:'仕上げ',     status:'pending',  worker:'田中仕上' },
        { nm:'sh013', stage:'動画',       status:'retake',   worker:'鈴木作画' },
        { nm:'sh014', stage:'動画',       status:'pending',  worker:'鈴木作画' },
      ]},
      { sq:'B-pt', shots:[
        { nm:'sh015', stage:'レイアウト', status:'pending',  worker:'山田監督' },
        { nm:'sh016', stage:'仕上げ',     status:'approved', worker:'田中仕上' },
        { nm:'sh017', stage:'レイアウト', status:'omit',     worker:'-' },
        { nm:'sh018', stage:'動画',       status:'approved', worker:'鈴木作画' },
      ]},
    ]},
  ];

  const reviewStages = [
    { id:'lay', label:'レイアウト' },
    { id:'anm', label:'動画' },
    { id:'col', label:'仕上げ' },
  ];

  /* v.016：どのショットに「サンプル版」を仕込むか（アノテ窓・タイムリマップが開けるように）。
     多すぎると起動が重くなるので代表的な数ショットだけに限定。 */
  const sampleShots = new Set(['sh001','sh002','sh003','sh010']);
  const stagePalette = {
    'レイアウト': ['#1E3A5F', '#5A9BFF'],
    '動画':       ['#1E4A2E', '#5CB878'],
    '仕上げ':     ['#4F2E1E', '#F2986B'],
  };

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
        // _isShotLikeNode 判定を通すため review 子ノードを追加（stage 分）。
        // 進捗タブは「現工程 review ノードの status」を見るので、現工程の review ノードに
        // ショットの status を伝搬しておく。他工程 review の status は未着手扱いになる。
        for (const st of reviewStages) {
          const isCurrent = (st.label === sh.stage);
          const reviewNode = {
            id: shId + '_r_' + st.id, parentId: shId, name: st.label,
            type: 'review', createdAt: now, versions: [],
            status: isCurrent ? sh.status : undefined,
          };
          /* v.016：デモショット（sampleShots に含まれる）の現工程 review に、サンプル画像版を 2 つ入れる。
             - v1, v2 の 2 版を用意して「版履歴の切替」も体感可能
             - type='image' にしているが LayCAT 側のアノテ・タイムリマップ UI は画像でも開ける */
          if(isCurrent && sampleShots.has(sh.nm)){
            const palette = stagePalette[st.label] || ['#333', '#777'];
            const frame1 = _makeDemoFrame(sh.nm + ' v1', st.label, palette[0], palette[1]);
            const frame2 = _makeDemoFrame(sh.nm + ' v2', st.label, palette[1], palette[0]);
            const ref1 = 'demo:' + shId + '_v1';
            const ref2 = 'demo:' + shId + '_v2';
            _registerDemoImage(ref1, frame1);
            _registerDemoImage(ref2, frame2);
            reviewNode.versions = [
              { id:'ver_'+shId+'_v1', name:'v1 (サンプル)', type:'image', file:ref1, thumb:ref1,
                uploadedBy:sh.worker, uploadedAt:now, stage:st.label,
                review:{status:'pending', notes:[]} },
              { id:'ver_'+shId+'_v2', name:'v2 (サンプル)', type:'image', file:ref2, thumb:ref2,
                uploadedBy:sh.worker, uploadedAt:now, stage:st.label,
                review:{status: sh.status==='approved'?'approved':'pending', notes:[]} },
            ];
          }
          DB.nodes.push(reviewNode);
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
