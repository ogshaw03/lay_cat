# 自動スクショが撮れるツールの作り方（Playwright 前提の設計メモ）

紹介ページ・ガイド用のスクリーンショットを Playwright（or Puppeteer）で自動生成できる構造をあらかじめ組み込んでおくための技術メモ。ツール新規作成時にこの構造を最初から入れておくと、後から「スクショを撮れない」問題が発生しない。

---

## 大前提：なぜ「撮れないツール」ができてしまうのか

多くの SaaS 型 Web アプリは、以下の理由で自動スクショが困難になる:

1. **サーバー側で認証が必須**
   → 有効な JWT/セッションが無いと API 全部 401、UI が空
2. **データがバックエンド DB にある**
   → フロントから任意のプロジェクト状態を作れない、API 経由でしか作れず時間がかかる
3. **React/Vue/Next の内部 state に外部からアクセスできない**
   → `window.__STORE__` 等のグローバル露出がないと state 直接注入不可
4. **OAuth 強制で 2FA / reCAPTCHA が挟まる**
   → Playwright 側で通過できない
5. **招待コード or 社内 SSO 必須**
   → 認証を突破する手段そのものが無い

このいずれかに引っかかると、Playwright で自動化しようとしても手詰まりになる。

---

## 撮れるようにするための設計チェックリスト

以下のうち **少なくとも 2〜3 つ**を最初から入れておく。全部満たさなくても構わないが、多いほど柔軟性が上がる。

### ✅ 1. 認証ゲートに「モックモード」を用意する

URL パラメータ or 環境変数で認証をスキップできるようにする:

```js
// 起動時に URL クエリを判定
const isMock = new URLSearchParams(location.search).get('mock') === '1';
if (isMock) {
  // 認証チェックを飛ばす
  currentUser = { email: 'demo@example.com', name: 'デモユーザー' };
  render();
  return;
}
// 通常の認証フロー
```

Playwright からは `page.goto('http://localhost:3000/?mock=1')` で入れる。

**注意**：本番環境で mock=1 が誤爆しないよう、以下のいずれかで保護:
- 本番ビルドでは `?mock=1` を無効化するフラグを立てる
- localhost / staging ドメインでしか受け付けない
- 明らかにダミーだと分かる状態表示（右上に「MOCK MODE」バッジ）

### ✅ 2. フロントエンドから直接データを注入できるようにする

内部 state を `window` にぶら下げるか、明示的なテスト用 API を用意する:

```js
// A. state をグローバル露出（開発ビルドだけ）
if (import.meta.env.DEV) {
  window.__testStore = store;
}

// B. 専用の inject API
window.__testAPI = {
  addProject(data) { store.projects.push(data); rerender(); },
  addUser(email) { store.users.push({email}); rerender(); },
};
```

Playwright から:
```js
await page.evaluate(() => {
  window.__testAPI.addProject({id: 'p1', name: 'テスト作品'});
  for (let i = 0; i < 10; i++) {
    window.__testAPI.addProject({id: `p${i}`, name: `作品 ${i}`});
  }
});
```

### ✅ 3. ファイル・画像を base64 で注入できる経路

アップロード機能のあるツールでは、実ファイルではなく Data URI から Blob 化して直接ストアに登録する経路を持つ:

```js
window.__testAPI.uploadFakeFile = async (name, dataUri) => {
  const blob = await (await fetch(dataUri)).blob();
  await store.uploadBlob(name, blob);
};
```

Playwright 側で `readFileSync('img.png').toString('base64')` して注入。

### ✅ 4. 認証をフロントエンドに寄せる（バックエンド 401 の乱発を回避）

API に依存しない UI 部分だけでもレンダリング可能にする:
- 初期表示に「読み込み中...」を出さず、モックデータで即描画
- 認証失敗時に "not-logged-in" 用のフォールバック UI を用意
- Playwright は初期表示の UI に到達できる

**アンチパターン**：初回に API GET 401 が返ると全画面「ログインしてください」で真っ白 → スクショ撮れない

### ✅ 5. ネットワーク切断時にも動く

Playwright 環境は外部 API に到達できないことがある（Firestore・S3 等）:
- API 失敗時に fallback（localStorage / メモリ）で継続動作
- タイムアウト時にダミーデータで代替
- 「オフライン時のフォールバック UI」を初期状態から用意

### ✅ 6. アニメーション・遷移をスキップできる

スクショ撮影時は静止画が欲しいので、アニメーションを無効化するフラグ:

```js
if (isMock || location.search.includes('noAnim=1')) {
  document.documentElement.classList.add('no-anim');
}
```
```css
.no-anim * { transition: none !important; animation: none !important; }
```

### ✅ 7. 単一 HTML or SPA、どちらでも「ローカル HTTP サーバーで開ける」構造

- ビルド後の成果物が `dist/index.html` + 静的アセットで完結
- `python3 -m http.server 8080` のようなツールで簡単に配信できる
- API 呼び出しは環境変数で差し替え可能

---

## 具体的な Playwright スクリプト構造

```js
import { chromium } from 'playwright';
import fs from 'fs';

const IMG = {
  sample1: 'data:image/png;base64,' + fs.readFileSync('assets/sample1.png').toString('base64'),
};

async function setupData(page) {
  await page.evaluate(({IMG}) => {
    // 1. 認証状態を疑似的に成立させる
    window.__testAPI.setUser({email: 'demo@example.com', role: 'admin'});
    // 2. プロジェクト・データを注入
    for (const spec of [/* ... */]) {
      window.__testAPI.addProject(spec);
    }
    // 3. 画像を Blob として登録
    return Promise.all([
      window.__testAPI.uploadFakeFile('cover.png', IMG.sample1),
    ]);
  }, {IMG});
}

async function shoot(page, url, filename, {viewport = {width:1920, height:1080}} = {}) {
  await page.setViewportSize(viewport);
  await page.goto(url + '?mock=1&noAnim=1');
  await setupData(page);
  await page.waitForTimeout(300);          // レンダー完了待ち
  await page.screenshot({path: filename});
}

const browser = await chromium.launch();
const page = await browser.newPage();
await shoot(page, 'http://localhost:8080/', 'shots/home.png');
await shoot(page, 'http://localhost:8080/#project/p1', 'shots/project.png');
await browser.close();
```

---

## 実装時のコスト

新規ツール立ち上げ時にこの構造を組み込むコスト:

| 項目 | 所要時間 |
|---|---|
| 1. モックモード（URL パラメータで認証スキップ） | 30 分〜1 時間 |
| 2. テスト用データ注入 API を `window` に露出 | 1〜2 時間 |
| 3. Blob 化アップロードの経路 | 1 時間 |
| 4. アニメ抑制フラグ | 15 分 |
| **合計** | **半日程度** |

**後から追加すると 5〜10 倍かかる**ので、最初に入れておくのが得策。

---

## アンチパターン集

### ❌ 認証を絶対条件にする
「認証されていないユーザーは何も見せない」設計は、Playwright を含む全ての自動化を阻む。
→ **モックモード**を最初から入れる。

### ❌ 内部 state を完全隠蔽する
「テスト API は本番に不要」と言って全て `private` にすると、後で自動テスト・スクショ・E2E で困る。
→ 開発ビルドだけ `window.__testAPI` を露出する。

### ❌ 全てのデータをバックエンドに置く
「フロントは薄く、DB に真実がある」設計はセキュアだが、フロントから直接データを作れない。
→ フロントに「メモリ内 store」を持ち、それを DB と同期する二層設計にすると Playwright と相性が良い。

### ❌ 画像アップロードを input 要素経由のみに固定
`<input type="file">` を Playwright 経由で操作するのは可能だが遅い＋不安定。
→ Blob 化して store に直接登録する `uploadFakeFile` API を用意。

### ❌ プロダクション URL でしかテストできない
staging / local 環境が無いと、本物のデータを汚さないと動作確認できない。
→ localhost で動く構成を最初から。

---

## セキュリティ考慮

モックモードは便利だが、本番でも有効になっていると重大なセキュリティ問題。以下いずれかで保護:

1. **ビルドフラグで完全無効化**
   ```js
   const MOCK_ALLOWED = process.env.NODE_ENV !== 'production';
   ```
2. **ドメインチェック**
   ```js
   const MOCK_ALLOWED = /localhost|staging|preview/.test(location.hostname);
   ```
3. **明示的な運営環境変数で許可**
   ```js
   const MOCK_ALLOWED = window.__CONFIG__?.enableMock === true;
   ```

推奨は 1 と 2 の併用。

---

## まとめ

**「Playwright でスクショが撮れる」= 「認証をパスできる」＋「任意の状態を作れる」＋「静的にレンダリングされる」の 3 条件**。

新規ツール立ち上げ時に半日投資しておけば、以後の告知・ドキュメント・マーケティング素材の作成が劇的に楽になる。逆に、後から追加するとフレームワーク境界や認証システムを跨いだ改修が必要になり、実装コストが跳ね上がる。

**設計の優先順位**：
1. モックモード（URL パラメータで認証バイパス）
2. `window.__testAPI` でのデータ注入
3. Blob 経由の画像・ファイル登録
4. アニメ抑制フラグ

上記 4 点を最初のスプリントで実装しておくのが理想。
