/**
 * LayCAT ホームページ風 Word ドキュメントを生成
 * プレゼンの内容を、ランディングページ的に読み物形式で構成
 */
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        BorderStyle, PageOrientation, LevelFormat, ShadingType, PositionalTab,
        PositionalTabAlignment, PositionalTabLeader, PageBreak,
        UnderlineType } = require('docx');
const fs = require('fs');

// カラー（LayCAT テーマ）
const PURPLE = 'A56BF0';
const BLUE = '5A9BFF';
const DARK = '1C1C22';
const TEXT = '2C2C33';
const MUTED = '6B6B7B';
const BG_LIGHT = 'F5F5F8';
const GREEN = '5CB878';

// ========== ヘルパ ==========
function hero(title, subtitle) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [ new TextRun({ text: title, size: 72, bold: true, color: PURPLE }) ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [ new TextRun({ text: subtitle, size: 24, color: MUTED }) ],
    }),
  ];
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 600, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PURPLE, space: 4 } },
    children: [ new TextRun({ text, size: 32, bold: true, color: TEXT }) ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 120 },
    children: [ new TextRun({ text, size: 26, bold: true, color: PURPLE }) ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 300, after: 80 },
    children: [ new TextRun({ text, size: 22, bold: true, color: BLUE }) ],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [ new TextRun({ text, size: opts.size || 20, color: opts.color || TEXT, bold: !!opts.bold, italics: !!opts.italic }) ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'features', level },
    spacing: { after: 80 },
    children: [ new TextRun({ text, size: 20, color: TEXT }) ],
  });
}

function quote(text) {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    indent: { left: 400 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: PURPLE, space: 12 } },
    children: [ new TextRun({ text, size: 24, italics: true, color: DARK }) ],
  });
}

function callout(text, color = BLUE) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 300 },
    shading: { type: ShadingType.CLEAR, fill: BG_LIGHT, color: 'auto' },
    children: [ new TextRun({ text, size: 26, bold: true, color }) ],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 400, after: 400 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
    children: [],
  });
}

function pageBreak() {
  return new Paragraph({ children: [ new PageBreak() ] });
}

// ========== コンテンツ ==========
const children = [
  // Hero
  ...hero('LayCAT', '映像制作のためのレビュー ＆ 進行管理ツール'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [ new TextRun({ text: '動画への描き込み、進捗の見える化、チェックの割り振り、連続再生まで。', size: 20, color: TEXT }) ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [ new TextRun({ text: '制作のやり取りを、これ 1 つで。', size: 20, color: TEXT }) ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [ new TextRun({ text: 'ブラウザだけで動作 ／ インストール不要 ／ チーム共有対応', size: 18, color: MUTED, italics: true }) ],
  }),

  callout('「もう少し右」を、絵で伝える。', PURPLE),

  // ---- こんな悩みありませんか ----
  h1('こんな悩み、ありませんか？'),
  quote('「もう少し右」が伝わらない。修正の意図が、口頭やメールの往復ばかりでなかなか伝わらない。'),
  quote('「どのカットが、どこまで？」進捗が見えず、Excel 管理や状況確認に手間がかかる。'),
  quote('「誰が確認する番？」「最新版はどれ？」チェックの抜け漏れや、二度手間が起きやすい。'),
  quote('動画やコメントが散らばり、探すのに時間がかかる。'),
  callout('—— その悩み、LayCAT がまとめて解決します。', DARK),

  // ---- LayCAT とは ----
  h1('LayCAT とは'),
  p('LayCAT は、映像制作の「指示・共有・チェック」を、ブラウザ 1 つで完結させるレビュー＆進行管理ツールです。'),
  bullet('動画や画像を共有して、OK・リテイク・NG で判定できます。'),
  bullet('動画のコマに直接描き込むアノテーションで、修正指示をそのまま伝えられます。'),
  bullet('レイヤー・顔の向きガイドで、言葉にしづらい直しも的確に。'),
  bullet('カットごとの進み具合が、ひと目でわかります。'),
  bullet('作品ごとにフォルダへ保存してチームで共有。ブラウザだけで動作・インストール不要。'),

  // ---- 主な機能 ----
  h1('主な機能'),

  h2('タスクページ — カットごとの作業画面'),
  p('1 つのカットの工程を開く、作業の中心画面です。'),
  bullet('「＋ 動画」でアップロード。上げるたびに版（v1・v2…）が残ります。'),
  bullet('動画ごとに、コメントや OK・リテイクの判定をやり取り。'),
  bullet('ステータスや担当（作業・チェック）もここで設定できます。'),

  h2('アノテーション — レイヤー機能'),
  p('動画のコマに、直接「絵」で指示を描けます。'),
  bullet('指示はレイヤーで分けられます（例：演出／作画／修正）。'),
  bullet('レイヤーごとに、表示・非表示や削除ができます。'),
  bullet('ブラシ・消しゴム・トレーシングペーパーなどを用意。'),
  bullet('筆圧検知にも対応（環境設定で ON/OFF）。'),

  h2('動画への埋め込み ＆ 顔の向きガイド'),
  p('描いた指示はそのコマに保存され、再生すると自動で出ます。'),
  bullet('コメント欄にも、縮小画像で残ります。'),
  bullet('「顔の向きガイド」で、顔の向きを立体的に示せます。'),
  bullet('ドラッグで、上下・左右・傾きを指定できます。'),

  h2('進捗管理 — 複数グラフの同時表示'),
  p('エピソードごとの円グラフを、横に並べて表示します。'),
  bullet('「工程」と「ステータス」の 2 種類を切り替えられます。'),
  bullet('担当者でしぼり込めます。'),
  bullet('作品全体の進み具合が、ひと目でわかります。'),
  bullet('ステータス別（チェック待ち・OK・リテイク・NG の割合）にも即切替可能。'),

  h2('チェック待ち — 担当者一覧'),
  p('チェック担当者ごとに、タブで分かれます。'),
  bullet('自分が見る番のカットだけを表示できます。'),
  bullet('残り件数がバッジでわかり、見落としを防げます。'),
  bullet('一覧のまま、ステータスを変えられます。'),

  h2('REEL — カットをつなげて連続再生'),
  p('複数のカットをつなげて、連続再生できます。'),
  bullet('並べ替えて、通しのテンポを確認できます。'),
  bullet('REEL で書いたコメント・アノテーションは、各カットのタスクページにそのまま反映。'),
  bullet('つながり確認や試写に、そのまま使えます。'),

  // ---- 差別化ポイント：EXR ----
  h1('差別化ポイント ① EXR フォーマット対応'),
  p('LayCAT は、CG レンダーの中間ファイル（.exr）を、専用ビューアなしでブラウザから直接プレビューできます。'),
  p('通常この形式は Nuke や After Effects で開かないと中身が見えませんが、LayCAT は多層 EXR をブラウザ上でレイヤー切替＆可視化できます。監督や PD が CG ソフトを持たずに、レンダー出力の中身を確認・注釈できるのが強みです。', { after: 200 }),

  h3('あらゆる AOV レイヤーを自動判定して可視化＋タイル一覧表示'),
  bullet('Beauty（RGB）／ Depth（黒白点・反転付き）／ Normal（XYZ）を自動判定'),
  bullet('Motion Vector（動きの向き）／ UV パス／ Position パスも対応'),
  bullet('Cryptomatte（オブジェクト／アセット分離）にも対応'),
  bullet('「🎨 全レイヤー」モーダルで、含まれる全レイヤーをタイル一覧で一望'),
  bullet('露出（EV）／ガンマ／Depth の黒白点／反転を、その場でスライダや数値入力で調整'),
  bullet('主要レンダラー（Nuke／Arnold／Redshift／V-Ray など）の出力に対応（ZIP・シングルパート推奨）'),

  callout('CG チームは追加の書き出し作業なしで、レンダー完了直後の .exr をそのまま監督・PD に共有できます。', BLUE),

  // ---- 差別化ポイント：R2 ----
  h1('差別化ポイント ② クラウドストレージ対応'),
  p('プロジェクトデータをクラウドストレージ（Cloudflare R2）に保存できるようになり、フォルダ運用に加えて「ネット経由でチーム共有」ができるようになりました。'),

  h3('👤 チームメンバー'),
  p('ブラウザで LayCAT を開くだけで、会社の PC でも、家でも、出張先でも、同じプロジェクトを開けます。'),

  h3('🚪 Worker（受付係）'),
  p('Cloudflare 上の小さなプログラムが、アクセスの受付を担当します。'),
  bullet('本人確認：ログイン中のユーザーかどうかを確認'),
  bullet('メンバーチェック：そのプロジェクトの招待メンバーか判定'),
  bullet('ファイル検査・記録：サイズ制限とアクセス履歴の記録'),

  h3('🪣 バケット（保管庫）'),
  p('プロジェクトのデータは Cloudflare R2（クラウドストレージ）に安全に保管されます。動画・EXR・コメント履歴すべて。'),

  h3('この構成のメリット'),
  bullet('🌏 どこからでも見られる（会社・自宅・出先どこでもブラウザで開ける）'),
  bullet('🔒 決まった人だけがアクセス（招待メンバー以外は自動的に拒否）'),
  bullet('📊 安全に保管・追跡可能（ファイルサイズ制限＋全アクセスの記録）'),
  bullet('🔄 従来のフォルダ運用と併用可能（プロジェクト単位でクラウド／フォルダを選べる）'),

  // ---- その他の主要画面 ----
  h1('その他の主要画面'),
  bullet('タイムライン — 更新履歴が時系列で集約'),
  bullet('ショット一覧 — 全カットの最新版を一望'),
  bullet('サブミット — 複数カットをまとめて提出'),
  bullet('メッセージ機能 — @メンション・通知'),
  bullet('比較再生 — A/B 同期再生（同じフレームで見比べ）'),

  // ---- 導入のメリット ----
  h1('まとめ — 導入のメリット'),

  h3('そのまま指示できる'),
  p('動画に直接描き込み、レイヤーと顔の向きガイドで、直しが言葉なしで伝わります。'),

  h3('進捗が見える'),
  p('グラフの同時表示と、担当者ごとのチェック待ちで、見落としを防げます。'),

  h3('チームで回る'),
  p('フォルダ共有 or クラウド共有で 1 つのデータを共同運用。REEL やサブミットでまとめて確認・提出できます。'),

  h3('導入がかんたん'),
  p('ブラウザだけで動作・インストール不要。単一 HTML で完結し、パスワード保護にも対応。'),

  divider(),

  // ---- クロージング ----
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
    children: [ new TextRun({ text: '「ここ、こうして」が、すぐ伝わる。', size: 40, bold: true, color: DARK }) ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [ new TextRun({ text: '描く・見る・共有。ブラウザ 1 つで。', size: 22, color: MUTED }) ],
  }),
  callout('LayCAT が、現場のやりとりを軽くします。', BLUE),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [ new TextRun({ text: '公開 URL：https://ogshaw03.github.io/laycat/', size: 20, color: MUTED }) ],
  }),
];

const doc = new Document({
  creator: 'LayCAT',
  title: 'LayCAT 紹介',
  description: '映像制作のためのレビュー＆進行管理ツール',
  numbering: {
    config: [{
      reference: 'features',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 400, hanging: 220 } }, run: { color: BLUE, bold: true } } },
      ],
    }],
  },
  styles: {
    default: {
      document: { run: { font: { name: 'Meiryo', hint: 'eastAsia' }, size: 20 } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 900, right: 900, bottom: 900, left: 900 },
      },
    },
    children,
  }],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync('LayCAT_紹介ページ.docx', buf);
  console.log('wrote LayCAT_紹介ページ.docx (' + buf.length + ' bytes)');
})();
