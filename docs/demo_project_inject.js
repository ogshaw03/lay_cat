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
  // v.019：メンバー構造を本番準拠に（m.id=メール／m.name／m.roles[]／m.color）。
  //       assignee / reviewer はこの m.id を参照する。
  DB.nodes.push({
    id: rootId, parentId: null, name: 'DEMO_プロジェクト', type: 'section',
    description: '取説用のサンプルプロジェクト', thumbnail: null, createdAt: now, versions: [],
    stages: ['レイアウト', '動画', '仕上げ'],
    stageTemplates: [
      { id:'tpl_default', name:'テンプレートA', stages:['レイアウト','動画','仕上げ'] },
    ],
    stageColors: { 'レイアウト':'#5A9BFF', '動画':'#5CB878', '仕上げ':'#F2986B' },
    /* v.019：プロジェクトタグのサンプル。追加モーダルや shot のタグ付けに表示される。 */
    tags: [
      { id:'tag_main',   name:'メイン', createdAt: now },
      { id:'tag_sub',    name:'サブ',   createdAt: now },
      { id:'tag_action', name:'アクション', createdAt: now },
      { id:'tag_emote',  name:'感情表現', createdAt: now },
    ],
    members: [
      { id:'director@example.com', name:'山田監督', roles:['監督'],  color:'#F2986B' },
      { id:'pm@example.com',       name:'佐藤制作', roles:['制作'],  color:'#A56BF0' },
      { id:'anim@example.com',     name:'鈴木作画', roles:['作画'],  color:'#5CB878' },
      { id:'paint@example.com',    name:'田中仕上', roles:['仕上げ'],color:'#5A9BFF' },
    ],
    /* 統一ステータス定義（進捗タブや PMB と形式を揃える） */
    statuses: [
      { id:'pending',  label:'チェック待ち', checkWait:true },
      { id:'approved', label:'OK' },
      { id:'retake',   label:'リテイク' },
      { id:'done',     label:'完了' },
      { id:'omit',     label:'オミット' },
    ],
  });

  /* メンバー検索用マッピング（name → email） */
  const memberEmailByName = {
    '山田監督': 'director@example.com',
    '佐藤制作': 'pm@example.com',
    '鈴木作画': 'anim@example.com',
    '田中仕上': 'paint@example.com',
  };
  /* 工程ごとに適切な作業担当を自動選択 */
  const workerByStage = {
    'レイアウト': 'anim@example.com',  /* 作画が LO 兼任 */
    '動画':       'anim@example.com',
    '仕上げ':     'paint@example.com',
  };

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

  /* v.017：全ショットのサムネに intro.html のアニメ風ギャラリ画像（gal_01〜09）を割り振る。
     9 枚しか無いので循環使用。相対パスのまま読み込む。 */
  const galUrls = Array.from({length:9},(_,i)=>'slides_assets/gal_0'+(i+1)+'.png');
  galUrls.forEach(_registerDemoImage);
  /* v.020：実動画サンプル（slides_assets/movie 配下）。
     ショットの v.file として割り振り、ショットページでインライン再生＆アノテ・リタイム
     ビューアで実際に触れるように。6 本を循環使用。 */
  const movUrls = [
    'slides_assets/movie/100223-video-360.mp4',
    'slides_assets/movie/101516-video-360.mp4',
    'slides_assets/movie/140630-775595877_medium.mp4',
    'slides_assets/movie/4067-360.mp4',
    'slides_assets/movie/41576-360.mp4',
    'slides_assets/movie/4633-360.mp4',
  ];
  movUrls.forEach(_registerDemoImage);

  /* コメント・メッセージのサンプルを工程別に用意（レビューっぽい雰囲気を出す）。
     v.018：ショットページ動画ブロックは「フレーム付きコメント」しか表示しないので、
     v1 のレビュー時指摘には必ず `frame` を入れる。
     v2 のアップロード時メッセージは shotNode.comments + v.uploadCommentId で接続する。 */
  /* v2Upload.author は呼び出し時に sh.worker（アップロード者）を渡す（uploadedBy と一致させる）。
     v1Frames / v2Frames の author はレビュワー寄りに固定（監督・制作がフィードバックするロール分担）。 */
  const commentTemplates = {
    'レイアウト': {
      v1Frames: [
        { frame:14, author:'山田監督', text:'構図 OK ですが、キャラの右側にもう少し空間欲しいです' },
        { frame:38, author:'山田監督', text:'ここで一度カメラを引きにしませんか' },
        { frame:62, author:'佐藤制作', text:'タイミングよさそう。この引きで続けてください' },
      ],
      v2UploadText: '空間と引きの指摘を反映しました。確認お願いします 🙏',
      v2Frames:   [ { frame:22, author:'山田監督', text:'構図直り良くなりました！👍' } ],
    },
    '動画': {
      v1Frames: [
        { frame:10, author:'山田監督', text:'振り返りのタイミング、もう少し溜めてください' },
        { frame:28, author:'山田監督', text:'目線の動き、ここで一瞬止めると良さそう' },
        { frame:52, author:'佐藤制作', text:'全体の流れ良いです。あとは尺調整だけ' },
      ],
      v2UploadText: 'タイミング・目線の指摘を反映しました！',
      v2Frames:   [ { frame:15, author:'山田監督', text:'溜め OK です。コンテ通りで仕上げへ 🎬' } ],
    },
    '仕上げ': {
      v1Frames: [
        { frame:8,  author:'山田監督', text:'影の濃さ 10% くらい薄くできますか' },
        { frame:34, author:'山田監督', text:'ここのハイライト、もう一段入れてほしい' },
        { frame:70, author:'佐藤制作', text:'全体の色調 OK です' },
      ],
      v2UploadText: '影の濃度調整＋ハイライト追加しました。色味最終確認お願いします',
      v2Frames:   [ { frame:45, author:'山田監督', text:'色味 OK。完パケへ進めてください ✨' } ],
    },
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
        /* v.019：assignedWorker/Checker → assignee/reviewer に変更。値は member.id (= メール)。
           name 文字列が入っていた旧形式では taskAssignBadges の memberById 検索で解決できなかった。 */
        /* v.019：工程に応じた担当者を自動選択。sh.worker（旧式 name 文字列）は無視。
           - LO/動画 → 鈴木作画（anim）
           - 仕上げ → 田中仕上（paint）
           omit shots（sh.worker='-'）は assignee を null に。 */
        const workerEmail = sh.worker === '-' ? null : (workerByStage[sh.stage] || null);
        const workerName  = sh.worker === '-' ? '-' : (
          Object.keys(memberEmailByName).find(n => memberEmailByName[n] === workerEmail) || sh.worker
        );
        const assignee = workerEmail;
        const reviewer = memberEmailByName['山田監督'];
        /* v.019：ショットにタグを付与。ショット番号で疑似ランダムに割り当て。 */
        const tagPool = ['tag_main','tag_sub','tag_action','tag_emote'];
        const tagIdx = (shotCount * 7 + 3) % tagPool.length;
        const shotTags = [tagPool[tagIdx]];
        if(shotCount % 3 === 0) shotTags.push(tagPool[(tagIdx+1) % tagPool.length]);
        DB.nodes.push({
          id: shId, parentId: sqId, name: sh.nm, type: 'section', kind: 'shot',
          currentStage: sh.stage, status: sh.status, createdAt: now, versions: [],
          assignee, reviewer, tags: shotTags,
        });
        // _isShotLikeNode 判定を通すため review 子ノードを追加（stage 分）。
        // 進捗タブは「現工程 review ノードの status」を見るので、現工程の review ノードに
        // ショットの status を伝搬しておく。他工程 review の status は未着手扱いになる。
        for (const st of reviewStages) {
          const isCurrent = (st.label === sh.stage);
          /* v.019：各 review node にも assignee/reviewer を設定（工程により作業担当が変わるため工程別）。
             - 現工程の review の assignee はショットの担当（既に代入済み）
             - 他工程の review はその工程の典型的な担当者 */
          const reviewAssignee = workerByStage[st.label] || null;
          const reviewReviewer = memberEmailByName['山田監督'];
          const reviewNode = {
            id: shId + '_r_' + st.id, parentId: shId, name: st.label,
            type: 'review', createdAt: now, versions: [],
            status: isCurrent ? sh.status : undefined,
            assignee: reviewAssignee,
            reviewer: reviewReviewer,
          };
          /* v.017：現工程 review にサンプル版を 2 つ入れる（全 18 ショット対象）。
             - type:'video' で `latestVideoVersionUnder` が拾い、ショットカードにサムネが出る
             - 画像は intro.html の gal_01〜09 を循環使用（1 ショットごとに 2 枚異なる） */
          if(isCurrent){
            const imgIdx1 = (shotCount * 2) % 9;
            const imgIdx2 = (shotCount * 2 + 1) % 9;
            const ref1 = galUrls[imgIdx1];      /* v1 のサムネ（poster） */
            const ref2 = galUrls[imgIdx2];      /* v2 のサムネ（poster） */
            /* v.020：v.file には実動画 URL。v1/v2 で同じ動画を使う（版は進捗の違いを示す物語なので
               視覚的に同じ映像でも違和感ない）。ショット別に動画を散らすため shotCount で循環。 */
            const movUrl = movUrls[shotCount % movUrls.length];
            /* v2 の方が新しいようにタイムスタンプをずらす */
            const t1 = new Date(Date.now() - 7*86400*1000).toISOString();
            const t2 = new Date(Date.now() - 2*86400*1000).toISOString();
            /* コメントサンプル（版の review.notes に流し込み）。
               v.018：ショットページ動画ブロックは frame 付きコメントしか表示しないので、
               デモの指摘には必ず frame 番号を入れる。アノテ窓とショットページで同じコメントが見える。 */
            const tmpl = commentTemplates[st.label] || null;
            const v1Notes = (tmpl ? tmpl.v1Frames : []).map((c,i)=>({
              id:'nt_'+shId+'_v1_'+i,
              author:c.author, text:c.text, time:t1, frame:c.frame
            }));
            const v2Notes = (tmpl ? tmpl.v2Frames : []).map((c,i)=>({
              id:'nt_'+shId+'_v2_'+i,
              author:c.author, text:c.text, time:t2, frame:c.frame
            }));
            /* v2 のアップロード時メッセージ：
               review node の comments に書いて、version.uploadCommentId で参照する。
               author は workerName（uploadedBy と一致）。 */
            let uploadCommentId = null;
            if(tmpl && tmpl.v2UploadText){
              uploadCommentId = 'cm_'+shId+'_'+st.id+'_v2upload';
              reviewNode.comments = reviewNode.comments || [];
              reviewNode.comments.push({
                id: uploadCommentId,
                author: workerName,
                text: tmpl.v2UploadText,
                time: t2,
                stage: st.label,
                kind: 'upload',
              });
            }
            reviewNode.versions = [
              { id:'ver_'+shId+'_v1', name:'v1', type:'video', file:movUrl, thumb:ref1,
                uploadedBy:workerName, uploadedAt:t1, stage:st.label,
                review:{status:'retake', notes:v1Notes} },
              { id:'ver_'+shId+'_v2', name:'v2', type:'video', file:movUrl, thumb:ref2,
                uploadedBy:workerName, uploadedAt:t2, stage:st.label,
                uploadCommentId: uploadCommentId,
                review:{status: sh.status==='approved'?'approved':(sh.status==='retake'?'retake':'pending'), notes:v2Notes} },
            ];
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
