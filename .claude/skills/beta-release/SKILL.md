---
name: beta-release
description: LayCAT／pmboard の Dev → Beta 反映手順。未反映レビュー・候補グループ化・PATCH_NOTES 追記・ファイルコピー・APP_VERSION バンプ・UPDATE_LOG アーカイブ・commit/push を一貫して実行。ユーザーが「Beta 反映」「ベータに出す」等を指示したときに起動。
---

# beta-release：LayCAT／pmboard の Beta 反映

## 使うタイミング

ユーザーが以下のような指示を出した時：
- 「Beta 反映しましょう」
- 「パッチノート更新してベータに出して」
- 「v0.X.Y として Beta 反映」
- `/beta-release`

**重要**：Beta 反映は CLAUDE.md のルールで **ユーザー明示指示のみ** 実行可。自発的に起動しない。

## 事前チェック（スキル起動時に自動で判定）

以下を順に確認：

1. **worktree 内か** → `pwd` して `.claude/worktrees/` 配下にいることを確認
2. **git status 確認** → 未コミット変更があれば、先に commit するか確認
3. **CLAUDE.md のルールを再読** → 特に「文体ルール」「言語ルール」「ファイル役割」のセクション
4. **PATCH_NOTES.md の最新 Beta バージョンを取得** → `head -5 PATCH_NOTES.md` で現在の最新バージョンを把握
5. **両 dev ファイルの APP_VERSION を取得** → `grep -m1 "const APP_VERSION" laycat_dev.html pmboard_dev.html`

## 手順

### Step 1：未反映のレビュー＋候補グループ化

1. `UPDATE_LOG.md` の「## 未反映（次のパッチノート候補）」セクションを両方（LayCAT 本体 ＋ pmboard）読む
2. 以下の 4 分類で項目をグループ化：

| 分類 | 判定基準 | PATCH_NOTES 掲載 |
|---|---|---|
| **ユーザー向け新機能** | 新しい UI、新しいフロー、見える機能追加 | ✅ 掲載 |
| **UI 改善・使いやすさ向上** | 既存機能のブラッシュアップ、見た目改善 | ✅ 掲載（1 項目にまとめても可）|
| **バグ修正** | ユーザーが遭遇した問題の修正 | 大きいものは掲載・小さいものは「反映済み・パッチノート記載なし」 |
| **運営向け／内部変更** | コンソール変更、マイグレーション、技術的 refactor | **掲載なし**（「反映済み・パッチノート記載なし」へ） |

3. 似た機能を**まとめて 1 セクション**にする（例：祝日カレンダー関連の v.060-v.062 は「📅 祝日カレンダー」1 項目）

4. ユーザーに **A/B/C... の候補リスト** で提示：
   - 各候補は `見出し（絵文字＋一言）＋ 1-2 行の要約` 形式
   - 対象の dev バージョン範囲を括弧書き
   - 全部を推奨して、不要なものだけ外してもらう

### Step 2：候補の確定＋バージョン番号決定

ユーザーの返答を待って：
- 採用する候補を確認
- Beta バージョン番号を提案（デフォルト：**マイナーバンプ**。v0.2.0 → v0.3.0）
  - 大きな機能追加 → マイナーバンプ
  - 小さい修正のみ → パッチバンプ（v0.3.1）
- pmboard も同時反映するかを確認（通常は Yes）

### Step 3：PATCH_NOTES.md に追記

**文体ルール（厳守）**：
- 見出し：絵文字 ＋ **一言タイトル**（例：「👤 マイページを新設」）
- 本文：**1〜2 行の要約**
- 実装詳細（CSS 変数・内部処理・ファイル名）は書かない → `UPDATE_LOG.md` 参照
- **「刷新」は使わない** → 「作り直し」「改良」「見直し」など平易な語に置き換える
- 禁止ワード：「刷新」「アーキテクチャ」「リファクタ」「スキーマ」

**挿入位置**：既存の最新 Beta バージョンの **上**（新バージョンが先頭に）
**日付**：今日の日付（YYYY-MM-DD）

### Step 4：Beta ファイルをコピー＋ APP_VERSION 書き換え

**LayCAT 本体**：
```bash
cp laycat_dev.html laycat.html
```
その後、`laycat.html` の `const APP_VERSION='YYYY.MM.DD.NNN'` を `const APP_VERSION='beta vX.Y.Z'` に書き換え。

**pmboard**（対象の場合のみ）：
```bash
cp pmboard_dev.html pmboard.html
```
`pmboard.html` の `const APP_VERSION='YYYY.MM.DD.NNN'` を `const APP_VERSION='pmboard vX.Y.Z'` に書き換え。

**dev ファイルは触らない**：`laycat_dev.html` / `pmboard_dev.html` の APP_VERSION は日付ベースのまま維持。

### Step 5：UPDATE_LOG.md 再構成

Node スクリプトで一括処理：

```js
// 以下を実行して「## 未反映」を「## 反映済み beta vX.Y.Z（YYYY-MM-DD）」にリネーム
// LayCAT と pmboard の両方を処理
const fs=require('fs');
const p='UPDATE_LOG.md';
let src=fs.readFileSync(p,'utf8');
const marker='## 未反映（次のパッチノート候補）';
const new_pm='## 反映済み pmboard vX.Y.Z（YYYY-MM-DD）';  // ← 書き換え
const new_lc='## 反映済み beta vX.Y.Z（YYYY-MM-DD）';     // ← 書き換え
const blank=marker+'\n\n<!-- 以降、コミット単位で `- (short-hash) 日本語要約` を追記していく -->\n\n';
const positions=[];
let idx=0;
while((idx=src.indexOf(marker, idx))!==-1){ positions.push(idx); idx+=marker.length; }
if(positions.length !== 2){ console.error('expected exactly 2'); process.exit(1); }
const [p1, p2]=positions;
let src2 = src.slice(0,p2) + blank + new_pm + src.slice(p2+marker.length);
let src3 = src2.slice(0,p1) + blank + new_lc + src2.slice(p1+marker.length);
fs.writeFileSync(p, src3);
```

**pmboard を同時反映しない場合**：pmboard 側の rename はせず、LayCAT のみ処理。

### Step 6：構文検証

両 Beta ファイルの JS 構文を検証：

```bash
node -e "
const fs=require('fs');
for(const f of ['laycat.html','pmboard.html']){
  const html=fs.readFileSync(f,'utf8');
  const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  let errs=0;
  for(let i=0;i<scripts.length;i++){
    let code=scripts[i][1].replace(/^\s*import\s+[^;]+from\s+['\"][^'\"]+['\"];?/gm,'').replace(/^\s*export\s+/gm,'');
    try{new Function(code);}catch(e){console.log(f+'[script '+i+'] ERR:',e.message.slice(0,250));errs++}
  }
  if(errs===0) console.log(f+': OK');
}
"
```

エラーが出たら commit せず、何が壊れたかを調査する。

### Step 7：commit + push

コミットメッセージ定型：
```
Beta 反映：LayCAT beta vX.Y.Z + pmboard vA.B.C

PATCH_NOTES.md vX.Y.Z 追記（N 項目）：
- （採用した見出しをリスト）

ファイルコピー：
- laycat_dev.html → laycat.html（APP_VERSION: beta vX.Y.Z）
- pmboard_dev.html → pmboard.html（APP_VERSION: pmboard vA.B.C）

UPDATE_LOG.md：
- LayCAT 未反映 v.XXX-v.YYY を「反映済み beta vX.Y.Z」へアーカイブ
- pmboard 未反映 v.XXX-v.YYY を「反映済み pmboard vA.B.C」へアーカイブ
- 新しい未反映セクションを空で用意

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

push 先：`origin main`（CLAUDE.md ルール：Dev/Beta ファイル分離済みで main 自動 push OK）

### Step 8：完了報告

ユーザーに：
- 反映した Beta バージョン（LayCAT ＋ pmboard）
- 掲載した PATCH_NOTES 項目数
- GitHub Pages のデプロイ待ち時間（通常 1-2 分）
- 動作確認手順の提案

を報告。

## ガードレール

- **ユーザー承認なしに実行しない**：Step 2 で候補確定の明示的な返答を受けてから Step 3 以降に進む
- **PATCH_NOTES の実装詳細禁止**：Step 3 で絵文字＋一言タイトル＋1-2 行要約のルールを厳守
- **「刷新」等の禁止ワードチェック**：PATCH_NOTES.md に書き込む前に禁止ワードが含まれていないか確認
- **dev ファイルの APP_VERSION は触らない**：`laycat_dev.html` / `pmboard_dev.html` は日付ベースを維持（CLAUDE.md ルール）
- **構文エラー時は push しない**：Step 6 で検証失敗したら commit せず調査
- **force push 禁止**
