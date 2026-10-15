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

  /* v.017：intro.html で使っているアニメ風サンプル画像（slides_assets/gal_01〜09.png）を
     デモショットの版サムネイルに流用する。
     - 直接 URL を v.thumb / v.file に書き、storage.urlCache に url を事前投入すれば
       `storage.getURL()` がネットワーク往復ゼロで解決してくれる
     - type:'video' にすることで `latestVideoVersionUnder` が拾い、ショットカードに
       サムネが出る（タイルホバーで元解像度再生は PNG のため失敗するが、サムネは出る） */
  function _registerDemoImage(ref){
    try{
      if(typeof storage!=='undefined' && storage.urlCache){
        storage.urlCache.set(ref, ref); /* ref 自体を URL として（相対パス） */
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

  /* v.017：全ショットに intro.html のアニメ風ギャラリ画像（gal_01〜09）を割り振る。
     9 枚しか無いので循環させて使う。版 v1 と v2 で違う画像にして「版履歴の切替」も体感可能。
     サムネサイズを圧迫しないよう、相対パスのまま読み込む。 */
  const galUrls = Array.from({length:9},(_,i)=>'slides_assets/gal_0'+(i+1)+'.png');
  galUrls.forEach(_registerDemoImage);

  /* コメント・メッセージのサンプルを工程別に用意（レビューっぽい雰囲気を出す） */
  const commentTemplates = {
    'レイアウト': [
      { author:'山田監督', text:'構図 OK ですが、キャラの右側にもう少し空間欲しいです' },
      { author:'佐藤制作', text:'タイミングよさそう。この引きで続けてください' },
    ],
    '動画': [
      { author:'山田監督', text:'10f あたりの振り返り、もう少し溜めてください' },
      { author:'山田監督', text:'全体的に良いです。コンテ通りで仕上げへ' },
    ],
    '仕上げ': [
      { author:'山田監督', text:'影の濃さ 10% くらい薄くできますか' },
      { author:'佐藤制作', text:'色味 OK です。完パケへお願いします' },
    ],
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
          /* v.017：現工程 review にサンプル版を 2 つ入れる（全 18 ショット対象）。
             - type:'video' で `latestVideoVersionUnder` が拾い、ショットカードにサムネが出る
             - 画像は intro.html の gal_01〜09 を循環使用（1 ショットごとに 2 枚異なる） */
          if(isCurrent){
            const imgIdx1 = (shotCount * 2) % 9;
            const imgIdx2 = (shotCount * 2 + 1) % 9;
            const ref1 = galUrls[imgIdx1];
            const ref2 = galUrls[imgIdx2];
            /* v2 の方が新しいようにタイムスタンプをずらす */
            const t1 = new Date(Date.now() - 7*86400*1000).toISOString();
            const t2 = new Date(Date.now() - 2*86400*1000).toISOString();
            /* コメントサンプル（版の review.notes に流し込み） */
            const comments = commentTemplates[st.label] || [];
            const v1Notes = comments.slice(0,1).map((c,i)=>({ id:'nt_'+shId+'_v1_'+i, author:c.author, text:c.text, time:t1 }));
            const v2Notes = (sh.status==='retake' ? comments : comments.slice(1)).map((c,i)=>({ id:'nt_'+shId+'_v2_'+i, author:c.author, text:c.text, time:t2 }));
            reviewNode.versions = [
              { id:'ver_'+shId+'_v1', name:'v1', type:'video', file:ref1, thumb:ref1,
                uploadedBy:sh.worker, uploadedAt:t1, stage:st.label,
                review:{status:'retake', notes:v1Notes} },
              { id:'ver_'+shId+'_v2', name:'v2', type:'video', file:ref2, thumb:ref2,
                uploadedBy:sh.worker, uploadedAt:t2, stage:st.label,
                review:{status: sh.status==='approved'?'approved':(sh.status==='retake'?'retake':'pending'), notes:v2Notes} },
            ];
            /* ショット section に全体コメントも 1 つ入れる（アノテ窓のメッセージ欄に出る） */
            if(comments[0]){
              const shotNode = DB.nodes.find(n=>n.id===shId);
              if(shotNode){
                shotNode.comments = shotNode.comments || [];
                shotNode.comments.push({
                  id:'cm_'+shId+'_1',
                  author: comments[0].author,
                  text: comments[0].text,
                  time: t2,
                  stage: st.label,
                  kind: 'upload',
                });
              }
            }
          }
          DB.nodes.push(reviewNode);
        }
        shotCount++;
      }
    }
  }

  /* v.017：資料タブのデモ資料も投入。state.refItemsByPid[rootId] に配置する。
     intro.html の gal_*.png を利用して「キャラ資料・背景資料・設定メモ」のモックを作る。 */
  try{
    if(typeof state !== 'undefined'){
      state.refItemsByPid = state.refItemsByPid || {};
      const t = (type, props) => Object.assign({ id:'ref_demo_'+Math.random().toString(36).slice(2,8), type }, props);
      state.refItemsByPid[rootId] = [
        /* セクション A：キャラクター */
        t('title', { text:'キャラクター', x:60, y:40, fontSize:48, color:'#F2C86B' }),
        t('text',  { text:'主人公・ヒロインの衣装や表情のバリエーション。アニメーションの参考に。',
                     x:60, y:110, fontSize:16, color:'#aaa', w:720 }),
        t('image', { mediaRef:galUrls[0], mediaType:'image', label:'主人公 立ちポーズ',
                     x:60, y:170, w:420, h:280 }),
        t('image', { mediaRef:galUrls[1], mediaType:'image', label:'主人公 走り',
                     x:500, y:170, w:420, h:280 }),
        t('image', { mediaRef:galUrls[2], mediaType:'image', label:'ヒロイン 微笑み',
                     x:940, y:170, w:420, h:280 }),
        t('text',  { text:'※ 服の色味は背景の光源に馴染ませてください',
                     x:60, y:470, fontSize:14, color:'#6fa8dc', w:600 }),

        /* セクション B：背景 */
        t('title', { text:'背景 Reference', x:60, y:560, fontSize:48, color:'#5A9BFF' }),
        t('text',  { text:'教室／河川敷／駅前の 3 シーン分のロケーション資料。',
                     x:60, y:630, fontSize:16, color:'#aaa', w:720 }),
        t('image', { mediaRef:galUrls[3], mediaType:'image', label:'教室内',
                     x:60, y:690, w:420, h:280 }),
        t('image', { mediaRef:galUrls[4], mediaType:'image', label:'河川敷',
                     x:500, y:690, w:420, h:280 }),
        t('image', { mediaRef:galUrls[5], mediaType:'image', label:'駅前',
                     x:940, y:690, w:420, h:280 }),

        /* セクション C：設定メモ */
        t('title', { text:'設定・ルール', x:60, y:1080, fontSize:48, color:'#5CB878' }),
        t('shape', { shape:'rect', color:'#5CB878', opacity:0.12, x:60, y:1150, w:720, h:260 }),
        t('text',  { text:'■ 作画ルール\n・瞳のハイライトは右上固定\n・ジャンプ時の髪の揺れは 3F ホールド→1F 戻し\n・ピカピカは最大 2F まで',
                     x:80, y:1170, fontSize:18, color:'#e8e8ec', w:680 }),
        t('shape', { shape:'rect', color:'#F2986B', opacity:0.12, x:800, y:1150, w:560, h:260 }),
        t('text',  { text:'■ 色指定\n主人公の髪：#C9A96A\n学ランの黒：#1E1E26\n夕焼け：グラデ ⇒ #F2986B → #D04A4A',
                     x:820, y:1170, fontSize:18, color:'#e8e8ec', w:520 }),

        /* セクション D：外部リンク */
        t('title', { text:'外部リンク', x:60, y:1470, fontSize:32, color:'#A56BF0' }),
        t('text',  { text:'https://ogshaw03.github.io/lay_cat/',
                     x:60, y:1520, fontSize:14, color:'#6fa8dc', underline:true, w:500,
                     href:'https://ogshaw03.github.io/lay_cat/' }),
        t('image', { mediaRef:galUrls[6], mediaType:'image', label:'参考映像サムネ',
                     x:60, y:1570, w:320, h:200 }),
        t('image', { mediaRef:galUrls[7], mediaType:'image', label:'構図参考',
                     x:400, y:1570, w:320, h:200 }),
        t('image', { mediaRef:galUrls[8], mediaType:'image', label:'色味参考',
                     x:740, y:1570, w:320, h:200 }),
      ];
    }
  }catch(e){ console.warn('ref items inject error:', e); }

  state.currentId = rootId;
  try { render(); } catch(e) { console.warn('render error:', e); }
  console.log('[LayCAT demo] injected', shotCount, 'shots across', structure.length, 'episodes.');
  return 'OK: '+shotCount+' shots';
})();
