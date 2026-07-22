/**
 * LayCAT ホームページ風 Word ドキュメント（Rich Version）
 * 画像・カラフルなカラーバンド・カード風レイアウトを多用したランディングページ風
 */
const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
        BorderStyle, PageOrientation, LevelFormat, ShadingType,
        Table, TableRow, TableCell, WidthType, VerticalAlign, PageBreak,
        HeightRule } = require('docx');
const fs = require('fs');

// ========== カラーパレット ==========
const PURPLE = 'A56BF0';
const BLUE = '5A9BFF';
const DARK = '1C1C22';
const TEXT = '2C2C33';
const MUTED = '6B6B7B';
const BG_HERO = '111116';      // ダークヒーロー背景
const BG_LIGHT = 'F5F5F8';
const BG_ACCENT = 'F0EAFB';   // 淡い紫
const BG_BLUE = 'E8F1FF';     // 淡い青
const GREEN = '5CB878';
const ORANGE = 'F5804A';

// ========== ヘルパ ==========
const font = (extra={}) => ({ font: { name: 'Meiryo', hint: 'eastAsia' }, ...extra });

function tr(text, opts={}) {
  return new TextRun({ text, size: opts.size||20, bold: !!opts.bold, italics: !!opts.italic,
                       color: opts.color||TEXT, underline: opts.u?{type:'single'}:undefined });
}

function p(text, opts={}) {
  return new Paragraph({
    spacing: { before: opts.before||0, after: opts.after||100 },
    alignment: opts.align || AlignmentType.LEFT,
    children: Array.isArray(text) ? text : [ tr(text, opts) ],
  });
}

function h1(text, opts={}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: opts.before||500, after: opts.after||200 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [ tr(text, { size: 40, bold: true, color: opts.color||DARK }) ],
  });
}

function h2(text, color=PURPLE) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 350, after: 150 },
    children: [ tr(text, { size: 28, bold: true, color }) ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 250, after: 100 },
    children: [ tr(text, { size: 22, bold: true, color: TEXT }) ],
  });
}

function bullet(text, level=0, colorDot=BLUE) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 320, hanging: 220 },
    children: [
      tr('●  ', { size: 18, bold: true, color: colorDot }),
      tr(text, { size: 20, color: TEXT }),
    ],
  });
}

function image(path, w, h) {
  const buf = fs.readFileSync(path);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [ new ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' }) ],
  });
}

// ページ本文幅（DXA）：Letter 12240 - margin left/right 400*2 = 11440
const CONTENT_W = 11440;

const NO_BORDERS = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// カラー背景の 1 セル・1 段テーブル（DXA 固定幅で Google Docs 対策）
function band(children, bg, height) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [ CONTENT_W ],
    borders: NO_BORDERS,
    rows: [ new TableRow({
      height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined,
      children: [ new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: bg, color: 'auto' },
        margins: { top: 400, bottom: 400, left: 500, right: 500 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
          bottom: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
          left: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
          right: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
        },
        children,
      }) ],
    }) ],
  });
}

// 3 列カード（DXA 固定）
function cards3(items) {
  const colW = Math.floor(CONTENT_W / 3);
  const widths = [colW, colW, CONTENT_W - colW*2];
  const cells = items.map((item, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: item.bg||BG_LIGHT, color: 'auto' },
    margins: { top: 300, bottom: 300, left: 300, right: 300 },
    verticalAlign: VerticalAlign.TOP,
    borders: {
      top: {style: BorderStyle.SINGLE, size: 30, color: 'FFFFFF'},
      bottom: {style: BorderStyle.SINGLE, size: 30, color: 'FFFFFF'},
      left: {style: BorderStyle.SINGLE, size: 30, color: 'FFFFFF'},
      right: {style: BorderStyle.SINGLE, size: 30, color: 'FFFFFF'},
    },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER,
                      children: [ tr(item.icon, { size: 40 }) ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 },
                      children: [ tr(item.title, { size: 22, bold: true, color: item.color||PURPLE }) ] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
                      children: [ tr(item.desc, { size: 16, color: MUTED }) ] }),
    ],
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: NO_BORDERS,
    rows: [ new TableRow({ children: cells }) ],
  });
}

// 4 列カード（DXA 固定）
function cards4(items) {
  const colW = Math.floor(CONTENT_W / 4);
  const widths = [colW, colW, colW, CONTENT_W - colW*3];
  const cells = items.map((item, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: item.bg||BG_LIGHT, color: 'auto' },
    margins: { top: 250, bottom: 250, left: 200, right: 200 },
    verticalAlign: VerticalAlign.TOP,
    borders: {
      top: {style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF'},
      bottom: {style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF'},
      left: {style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF'},
      right: {style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF'},
    },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER,
                      children: [ tr(item.icon, { size: 36 }) ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 },
                      children: [ tr(item.title, { size: 18, bold: true, color: item.color||PURPLE }) ] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
                      children: [ tr(item.desc, { size: 14, color: MUTED }) ] }),
    ],
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: NO_BORDERS,
    rows: [ new TableRow({ children: cells }) ],
  });
}

// 2 列（DXA 固定）：ratio は 0-100 の合計 100 前提
function twoCol(leftChildren, rightChildren, ratio=[50,50]) {
  const leftW = Math.floor(CONTENT_W * ratio[0] / 100);
  const rightW = CONTENT_W - leftW;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [leftW, rightW],
    borders: NO_BORDERS,
    rows: [ new TableRow({ children: [
      new TableCell({
        width: { size: leftW, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 100, right: 200 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE},
          left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE}
        },
        children: leftChildren,
      }),
      new TableCell({
        width: { size: rightW, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 200, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE},
          left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE}
        },
        children: rightChildren,
      }),
    ] }) ],
  });
}

function imgOnly(path, w, h) {
  const buf = fs.readFileSync(path);
  return [ new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [ new ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' }) ],
  }) ];
}

function spacer() {
  return new Paragraph({ spacing: { before: 200, after: 200 }, children: [] });
}

// ========== コンテンツ ==========
const iconBuf = fs.readFileSync('laycat_icon.png');

const children = [
  // ============ HERO BAND ============
  band([
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [ new ImageRun({ data: iconBuf, transformation: { width: 120, height: 120 }, type: 'png' }) ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [ tr('LayCAT', { size: 88, bold: true, color: 'FFFFFF' }) ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [ tr('映像制作のためのレビュー ＆ 進行管理ツール', { size: 26, color: 'CACADE' }) ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [ tr('「ここ、こうして」が、すぐ伝わる。', { size: 36, bold: true, color: PURPLE }) ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [ tr('描く・見る・共有。ブラウザ 1 つで。', { size: 20, color: '9A9AAA' }) ],
    }),
  ], BG_HERO, 2400),

  spacer(),

  // ============ 悩み提示 ============
  h1('こんな悩み、ありませんか？', { align: AlignmentType.CENTER }),

  cards4([
    { icon: '💬', title: '伝わらない', desc: '「もう少し右」が\n言葉じゃ伝わらない', color: ORANGE, bg: BG_LIGHT },
    { icon: '❓', title: '見えない', desc: 'どのカットが\nどこまで進んでる？', color: ORANGE, bg: BG_LIGHT },
    { icon: '🔀', title: 'ズレる', desc: '誰が確認する番？\n最新版はどれ？', color: ORANGE, bg: BG_LIGHT },
    { icon: '🗂', title: '散らかる', desc: '動画やコメントが\nあちこちに散らばる', color: ORANGE, bg: BG_LIGHT },
  ]),

  spacer(),

  band([
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [ tr('その悩み、LayCAT がまとめて解決します。', { size: 28, bold: true, color: 'FFFFFF' }) ] }),
  ], PURPLE, 900),

  spacer(),

  // ============ LayCAT とは ============
  h1('LayCAT とは', { align: AlignmentType.CENTER }),
  p('映像制作の「指示・共有・チェック」を、ブラウザ 1 つで完結させるレビュー＆進行管理ツールです。',
    { align: AlignmentType.CENTER, size: 22, color: MUTED, after: 300 }),

  cards3([
    { icon: '🎬', title: '動画・画像レビュー', desc: 'OK / リテイク / NG で判定。\nコマに直接描き込み。', color: PURPLE, bg: BG_ACCENT },
    { icon: '📊', title: '進捗の見える化', desc: 'エピソード別グラフを\n横並びで一望。', color: BLUE, bg: BG_BLUE },
    { icon: '👥', title: 'チーム共有', desc: 'フォルダ or クラウドで\n1 つのデータを共同運用。', color: GREEN, bg: BG_LIGHT },
  ]),

  spacer(),

  // ============ 主な機能 ============
  h1('主な機能', { align: AlignmentType.CENTER }),

  h2('タスクページ — カットごとの作業画面'),
  p('1 つのカットの工程を開く、作業の中心画面です。'),
  bullet('「＋ 動画」でアップロード。上げるたびに版（v1・v2…）が残る'),
  bullet('動画ごとに、コメントや OK・リテイクの判定をやり取り'),
  bullet('ステータスや担当（作業・チェック）もここで設定'),

  h2('アノテーション — レイヤー機能'),
  twoCol(
    [
      p('動画のコマに、直接「絵」で指示を描けます。', { size: 20, after: 200 }),
      bullet('指示はレイヤーで分けられる（演出／作画／修正）'),
      bullet('レイヤーごとに表示・非表示や削除'),
      bullet('ブラシ・消しゴム・トレーシングペーパー'),
      bullet('筆圧検知（環境設定で ON/OFF）'),
    ],
    imgOnly('slides_assets/exr_anno_crypto.png', 300, 169),
    [45, 55]
  ),

  h2('顔の向きガイド'),
  p('顔の向きを立体的に示せる独自機能。ドラッグで上下・左右・傾きを指定できます。コメント欄にはスクショが自動で残ります。'),

  h2('進捗管理'),
  p('エピソードごとの円グラフを、横に並べて表示。工程／ステータスを切り替えて全体をひと目で把握。'),
  bullet('担当者でしぼり込み可能'),
  bullet('リテイクが多いエピソードのつまずきも一目'),
  bullet('チェック待ちタブで、自分が見る番のカットだけを表示'),

  h2('REEL — カットをつなげて連続再生'),
  p('複数のカットをつなげて連続再生。REEL 上で書いたコメントは各カットのタスクページに反映されるので、つながり確認・試写・修正指示が 1 か所で完結します。'),

  spacer(),

  // ============ EXR スポットライト ============
  band([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [ tr('🎨 SPOTLIGHT', { size: 18, color: 'CACADE' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [ tr('EXR フォーマット対応', { size: 40, bold: true, color: 'FFFFFF' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [ tr('CG レンダーの中間ファイル（.exr）を、専用ビューアなしでブラウザで直接プレビュー。', { size: 20, color: 'CACADE' }) ] }),
  ], BG_HERO, 1200),

  spacer(),

  image('slides_assets/exr_alllayers.png', 640, 420),

  p('通常この形式は Nuke や After Effects で開かないと中身が見えませんが、LayCAT は多層 EXR をブラウザ上でレイヤー切替＆可視化できます。監督や PD が CG ソフトを持たずに、レンダー出力の中身を確認・注釈できます。',
    { after: 300 }),

  h3('あらゆる AOV レイヤーを自動判定して可視化＋タイル一覧表示'),
  bullet('Beauty（RGB）／ Depth（黒白点・反転付き）／ Normal（XYZ）を自動判定'),
  bullet('Motion Vector ／ UV パス／ Position パスも対応'),
  bullet('Cryptomatte（オブジェクト／アセット分離）にも対応'),
  bullet('「🎨 全レイヤー」モーダルで、含まれる全レイヤーをタイル一覧で一望'),
  bullet('露出（EV）／ガンマ／Depth の黒白点／反転を、その場でスライダや数値入力で調整'),
  bullet('主要レンダラー（Nuke／Arnold／Redshift／V-Ray など）の出力に対応'),

  band([
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [ tr('CG チームは追加の書き出し作業なしで、レンダー完了直後の .exr をそのまま監督・PD に共有できます。',
                     { size: 22, bold: true, color: 'FFFFFF' }) ] }),
  ], BLUE, 900),

  spacer(),

  // ============ R2 スポットライト ============
  band([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [ tr('☁ SPOTLIGHT', { size: 18, color: 'CACADE' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [ tr('クラウドストレージ対応', { size: 40, bold: true, color: 'FFFFFF' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [ tr('プロジェクトデータをネット共有。会社・自宅・出先どこからでも同じデータへ。', { size: 20, color: 'CACADE' }) ] }),
  ], BG_HERO, 1200),

  spacer(),

  image('slides_assets/r2_architecture.png', 640, 360),

  p('「ブラウザ → 受付係（Worker） → 保管庫（バケット）」の 3 段構造で、招待メンバーだけが安全にプロジェクトデータへアクセスできます。'),

  cards4([
    { icon: '🌏', title: 'どこからでも', desc: '会社・自宅・出先どこでも\n同じデータをブラウザで', color: BLUE, bg: BG_BLUE },
    { icon: '🔒', title: '決まった人だけ', desc: '招待メンバー以外は\n自動的に拒否', color: PURPLE, bg: BG_ACCENT },
    { icon: '📊', title: '安全に保管', desc: 'サイズ制限＋\nアクセス履歴で追跡可能', color: GREEN, bg: BG_LIGHT },
    { icon: '🔄', title: 'フォルダと併用', desc: 'プロジェクト単位で\nクラウド／フォルダ選択', color: ORANGE, bg: BG_LIGHT },
  ]),

  spacer(),

  // ============ その他の主要画面 ============
  h1('そのほかの主要画面', { align: AlignmentType.CENTER }),
  cards3([
    { icon: '⏱', title: 'タイムライン', desc: '更新履歴を時系列で集約。誰がいつ何をしたかひと目で。', color: BLUE, bg: BG_BLUE },
    { icon: '🎞', title: 'ショット一覧', desc: '全カットの最新版を一望。ホバーで動画プレビュー。', color: PURPLE, bg: BG_ACCENT },
    { icon: '📤', title: 'サブミット', desc: '複数カットをまとめて提出。個別コメントも一括で。', color: GREEN, bg: BG_LIGHT },
  ]),

  spacer(),

  // ============ 導入のメリット ============
  h1('まとめ — 導入のメリット', { align: AlignmentType.CENTER }),
  cards4([
    { icon: '✎', title: 'そのまま指示', desc: '動画に直接描き込み、\n言葉なしで伝わる', color: PURPLE, bg: BG_ACCENT },
    { icon: '📈', title: '進捗が見える', desc: 'グラフとチェック待ちで\n見落としを防止', color: BLUE, bg: BG_BLUE },
    { icon: '🤝', title: 'チームで回る', desc: '1 つのデータで共同運用。\nまとめて確認・提出。', color: GREEN, bg: BG_LIGHT },
    { icon: '⚡', title: '導入かんたん', desc: 'ブラウザだけで動作、\nインストール不要', color: ORANGE, bg: BG_LIGHT },
  ]),

  spacer(),

  // ============ クロージング ============
  band([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [ tr('「ここ、こうして」が、すぐ伝わる。', { size: 42, bold: true, color: 'FFFFFF' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [ tr('描く・見る・共有。ブラウザ 1 つで。', { size: 22, color: 'CACADE' }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [ tr('LayCAT が、現場のやりとりを軽くします。', { size: 26, bold: true, color: PURPLE }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 },
      children: [ tr('https://ogshaw03.github.io/laycat/', { size: 20, color: '9A9AAA' }) ] }),
  ], BG_HERO, 2400),
];

const doc = new Document({
  creator: 'LayCAT',
  title: 'LayCAT 紹介ページ',
  description: '映像制作のためのレビュー＆進行管理ツール',
  styles: {
    default: {
      document: { run: font() },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // Letter
        margin: { top: 400, right: 400, bottom: 400, left: 400 },
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
