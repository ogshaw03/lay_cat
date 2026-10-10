# CLAUDE.md

このリポジトリで作業する際の方針メモ。

## 言語
- ユーザーへの応答・思考・コミットメッセージ・PR は**すべて日本語**（関数名やファイルパスなど固有名詞はそのまま引用可）。

## スコープ・提案方針
- **指示された対象だけに絞る**。範囲外で気づいた改善案は勝手にやらず、必ず先にユーザーに提案して承認を取る。
- 関連する類似バグ（例：同じ関数のバグが別の UI にもある）を見つけても、**報告のみ** で実装は別タスクとして聞く。
- 一度に多くの変更を混ぜない。1 コミット＝ 1 目的が原則。

## 🚨 データ書き込み系の絶対ルール（v.029/v.030 データ損失事故の教訓・2026-09-19）

**この事故の記録**：v.029/v.030「参加する」ボタンの実装で `persist()` を呼んだところ、`persist()` が REG 全プロジェクトを走査して shot.json を書き換える設計だったため、既存プロジェクトの **shot.json の versions[] 全消失**（動画版データ・FB・アノテ・コメント履歴の永続ロスト）が発生した。以下は再発防止の絶対ルール：

### 書き込み系コードを触る／追加するときの必須確認

1. **`persist()` を軽々しく呼ばない**
   - `persist()` は LayCAT の**全 REG プロジェクトを保存する**設計。単一プロジェクト用途では絶対に使わない。
   - 「安全策として最後に呼んでおく」は禁止。呼ぶなら**何を書くかを明確に理解してから**。
   - 単一プロジェクトなら `storage.saveRegistry(REG)` / `storage.saveProject(pid,meta)` / `_saveShotWithLock(pid,sid,file)` / `storage.saveStatus(pid,sid,file)` など**狭い関数**を選ぶ。

2. **hydrate 未完了で write を発火させない**
   - `readProjectData` / `_hydrateShots` / `_hydrateStatuses` は非同期。結果を検証せず `persist()` を続けると、部分ロード状態のメモリでシリアライズされて**既存データを空で上書きする**。
   - 「読み込み → メモリ更新 → 保存」の連鎖は、読み込み失敗／部分成功の分岐を明示。失敗時は保存しない（`return`）。

3. **既存プロジェクトデータを触る変更は特に慎重に**
   - `shots/*.json` / `status/*.json` / `laycat.project.json` / `reels.json` / `notes/*.json` は**ユーザーの制作成果物**（動画メタ、FB、レビュー履歴等）。壊すと復旧困難。
   - 変更前にドライラン（実書き込みせず console.log で影響を見せる）モードで挙動確認する。

4. **新規機能のプランで「書き込み境界」を明文化する**
   - 大きめの機能（マイグレ、参加フロー、共有機能等）の実装前に、プランで「**この操作でどの JSON がどう書かれるか**」を列挙してユーザーに合意を取る。
   - 「参加＝ REG に足すだけ／shot.json は書かない」のような**書き込み境界**を明示。

5. **UPDATE_LOG に書き込み経路の影響範囲を明記**
   - コミットメッセージ／UPDATE_LOG に「どの JSON が書かれるか／何を上書きするか／既存データへの副作用」を明記。

### 特に危険なパターン（禁忌）

- ❌ 新機能実装の締めくくりに `await persist()` を「なんとなく」追加する
- ❌ `readProjectData` の直後に無条件 `persist()` を呼ぶ（部分成功で空上書きになる）
- ❌ 既存プロジェクトの shot.json / laycat.project.json に触る変更を、影響範囲を UPDATE_LOG に書かないままコミットする
- ❌ `Object.assign(existing, newData)` で `newData` が既存フィールドを持っていない場合の挙動を確認せずに使う

**これは実際にデータ損失を起こしたルールです。「これぐらいなら大丈夫」と判断せず、必ず全項目を確認してください。**

## ファイル役割
- `laycat.html` … Beta（本番）。他ユーザーが利用中。**ユーザーの明示指示があるまで触らない**。
- `laycat_dev.html` … Dev（開発）。**通常の開発コミットはこちらだけ編集**。
- `pmboard.html` … Beta（進行管理ボード・本番）。**ユーザーの明示指示があるまで触らない**。
- `pmboard_dev.html` … Dev（進行管理ボード・開発）。**通常の開発コミットはこちらだけ編集**。
- `PATCH_NOTES.md` … 確定パッチノート。Claude から勝手に書かない（ユーザー指示のみ）。
- `UPDATE_LOG.md` … dev コミット単位のログ。LayCAT 本体と pmboard で **セクション分割**（後述）。
- `docs/` … 設計メモ。
- アセットは単一 HTML の自己完結性のため **base64 データ URI でインライン埋め込み**。

## APP_VERSION
### LayCAT 本体
- Dev（`laycat_dev.html`）は日付ベース `YYYY.MM.DD.NNN`。**dev コミットごとに末尾番号を +1**、日付が変わったら `.001` にリセット。
- Beta（`laycat.html`）は `beta v0.0.X`。**パッチノート更新のタイミングでのみ上げる**。

### pmboard（進行管理ボード）
- Dev（`pmboard_dev.html`）は日付ベース `YYYY.MM.DD.NNN`。LayCAT 本体と同じルール。
- Beta（`pmboard.html`）は `pmboard vX.Y.Z`。**Beta 反映のタイミングでのみ上げる**。
- 初回 Beta 版は `pmboard v0.1.0`（2026-09-16）。

## Beta 反映（ユーザー明示指示のみ）
### LayCAT 本体
1. `laycat_dev.html` を `laycat.html` にコピー（cp）。
2. `laycat.html` の `APP_VERSION` を新しい `beta v0.0.X` に。
3. `PATCH_NOTES.md` に新バージョンを追記（`UPDATE_LOG.md` の未反映から抜粋）。
4. `UPDATE_LOG.md` の未反映を「反映済み beta vX.Y.Z」に移動。
5. `laycat_dev.html` の `APP_VERSION` は日付ベースのまま。

### pmboard
1. `pmboard_dev.html` を `pmboard.html` にコピー（cp）。
2. `pmboard.html` の `APP_VERSION` を新しい `pmboard vX.Y.Z` に。
3. `UPDATE_LOG.md` の pmboard 未反映を「反映済み pmboard vX.Y.Z」に移動。
4. `pmboard_dev.html` の `APP_VERSION` は日付ベースのまま。
5. pmboard の PATCH_NOTES は当面作らない（大きな節目までは UPDATE_LOG のみで運用）。

## フォント
- **`Syne` は使わない**（読みづらいため廃止）。新規追加も禁止。
- 標準変数：
  - `--font-head: 'Space Grotesk','Noto Sans JP',sans-serif` … 見出し（太字で "可愛い" ユーザー好み）
  - `--font-body: 'Noto Sans JP',sans-serif` … 本文
  - `--font-code: 'Space Grotesk','Noto Sans JP',sans-serif` … 数値／コード（`font-variant-numeric:tabular-nums` 併用）
  - `--font-ui: system-ui,-apple-system,...,'Noto Sans JP',sans-serif` … 可読性優先の特定箇所のみ
- `--font-ui` は現状 `.fb-title`（アノテ窓の動画タイトル）のみ。**全体を OS フォントに寄せない**（「可愛い雰囲気が消えた」というフィードバック実績あり）。

## 設計方針（API・データ型）

### 工程色の API 使い分け
- UI で工程色を表示するときは **必ず `stageColorFor(root, name)`** を使う（手動色 → 既定マップ → 自動パレット の優先順位で解決）。
- `stageColor(name)` は名前ハッシュのみで **ユーザーが保存した `root.stageColors[name]` を見ない**。UI では使わない（内部フォールバック用）。
- 新しく「工程名→色チップ」を描く UI を実装する時は必ず `stageColorFor` を使う。v.007 で `openAddModal` の工程編集 UI が `stageColor` だったため「プロジェクト設定で変えた色が追加モーダルに反映されない」バグになった教訓。

### 工程名・ステージの型（Simple B）
- `shot.currentStage` と `root.stages[]` は **文字列**（例：`'レイアウト'`, `['レイアウト','動画','仕上げ']`）。
- オブジェクト配列（`{id, label, color}` のような形）は **使わない**。`openAddModal` 等の工程編集 UI は `inp.value = nm` で表示するので、オブジェクトを入れると `[object Object]` と表示される。
- 色は別フィールド `root.stageColors = {name: hex}` に保存。
- 工程テンプレは `root.stageTemplates = [{id, name, stages:[文字列,文字列,...]}, ...]`。
- 新しい demo / test データを作るときも同じ構造に合わせる（`docs/demo_project_inject.js` 参照）。

## UPDATE_LOG.md の構造
LayCAT 本体と pmboard で **セクション分割**：
- `# LayCAT 本体アップデートログ` セクション：`laycat_dev.html` / `laycat.html` の変更を記録
- `# pmboard アップデートログ` セクション：`pmboard_dev.html` / `pmboard.html` の変更を記録

各セクションは共通の 3 サブセクション構成：
1. **未反映（次のパッチノート候補）** … Beta 未反映。新規追加はここに積む。
2. **反映済み・パッチノート記載なし** … Beta 反映済みだが `PATCH_NOTES.md` に載せない項目（バグ修正・運営限定変更など）。
3. **反映済み [beta vX.Y.Z / pmboard vX.Y.Z]** … 該当バージョンごとのアーカイブ。

Beta 反映のみ→2 に移動、パッチノート記載→3 に移動。「反映済み」と「記載済み」を混同しない。
コミット単位で `- (dev vYYYY.MM.DD.NNN) <日本語1行要約>` を追記。詳細な実装メモは bullet ネストで補足可。

## パッチノート更新の手順（ユーザー指示のみ）
1. `UPDATE_LOG.md` の未反映＋パッチノート記載なしから候補を提示。
2. ユーザー選択分だけ `PATCH_NOTES.md` に新バージョンとして追記（既存は編集しない）。
3. `UPDATE_LOG.md` の該当を「反映済み beta vX.Y.Z」にアーカイブ。
4. `APP_VERSION` を新バージョンに。

### パッチノートの文体
- **とにかくシンプル**。見出し（絵文字＋一言）＋ 1〜2 行の要約が基本。
- 実装詳細（CSS 変数・閾値・内部処理）は書かない → `UPDATE_LOG.md` を参照。
- **「刷新」は使わない**。「作り直し」「改良」「見直し」など平易な語に置き換える。

## 運用ショートカット
- **「め」** = 現在のブランチを `main` に fast-forward push（「メインへ反映して」の短縮）。
- **main への push はコミットのたびに自動で OK**（Dev/Beta ファイル分離済みなので `*_dev.html` 変更は Beta ユーザーに影響しない）。
- ユーザーが「反映しないで」「保留」「main には出さないで」と明示した場合のみ push を止める。
- Beta 反映はユーザーの明示指示のみ（LayCAT 本体・pmboard それぞれ独立）。

## 修正後の動作確認（必須）

**LayCAT 本体（`laycat_dev.html` / `pmboard_dev.html`）のコード変更後は、必ずデモデータでブラウザ動作確認してから「完了」と報告する。** 2026-10-11 の工程色統合実装で TDZ エラー・レイアウト崩れ・`[object Object]` 表示などコードレビューだけでは拾えないバグが複数発覚した教訓。

手順：
1. `py -m http.server 8765 --bind 127.0.0.1` でローカルサーバを起動（既に立っていたら再利用）
2. ブラウザペインを `http://127.0.0.1:8765/laycat_dev.html?ver=<新バージョン>` へ navigate（キャッシュバスト）
3. **ビューポートを 1440x900 以上に** `mcp__Claude_Browser__resize_window({width:1440,height:900})` で設定（デフォルトの 800x600 だと上部タブが縦書きになるなどレイアウトが崩れて判定不能）
4. `fetch('/docs/demo_project_inject.js').then(r=>r.text()).then(c=>new Function(c)())` でデモ注入
5. 修正対象の UI へ遷移してスクショ、コンソールエラーの有無を確認
6. 期待通りに動くまで修正を続け、動いた状態を確認してから報告

**なぜ `py -m http.server` 経由か**：`laycat_dev.html` / `laycat.html` は **500KB 超**で、browser pane が `file://` 直読みを拒否する（「the file may be missing...」エラー）＋ FSA や fetch も file:// では動かない。ローカル HTTP サーバ経由にすれば両方解決する。Windows では `python` だと Microsoft Store の shim で詰まるので **`py` を使う**。

**例外**：UI 動作に一切影響しない変更（コメント／UPDATE_LOG／PATCH_NOTES のみ）はスキップ可。但し「UI 影響なしのためスキップ」と明示する。

**デモデータの一貫性**：`docs/demo_project_inject.js` のデータ構造が本物の LayCAT と違ってバグが見えた場合は、デモ側も実データ構造に合わせて修正する（デモの価値は「本物と同じ挙動を再現できる」こと）。

## 成果物（docx / pptx / 画像など）の配置
- ユーザー向け成果物（取説・プレゼン・設計資料など）は **`deliverables/`** に置く。
- Google Docs に配布するなら **`.docx` のまま** 送る（Google Drive にアップ → 右クリック →「Google ドキュメントで開く」で自動変換される。別途 Google 形式に変換不要）。
- Word で開かれているとファイル書き込みが失敗する（`EBUSY: resource busy or locked` ＋ `~$xxx.docx` ロックファイルが残る）→ 一時的に **`_v2.docx`** のような別名で生成して回避。ユーザーが Word 閉じたら本名に戻す。
- 取説用スクショは **`deliverables/manual_images/`** に `NN_<name>.jpg` の形式で（NN は順序）。
- 生成スクリプトは scratchpad に置く（例：`make_laycat_manual.js`）、再生成可能にしておく。

## pmboard 個別事項
- **LayCAT 本体のデザインを継承**：モノクロ基調（`--bg` / `--text` / `--accent` 系）。紫/シアン等のブランドカラーは使わない。
- **CSS 変数を LayCAT からそのままコピー**：`--bg/bg2/bg3/bg4`・`--text/text2/text3`・`--accent/accent2`・`--red/green/amber`・`--radius/radius2`・`--font-head/body/code`。
- **ボタン形式も LayCAT と同じ**：`.btn` `.btn-primary` `.btn-ghost` `.btn-sm`。
- **工程カラー**（ガント用）は彩度を落とした 5 色：Layout / Anim / FX / Comp / Paint。
- **pmboard は LayCAT 本体からアクセス**：本体のメニュー導線から新規タブで開く（Phase 1 で導線実装予定）。
