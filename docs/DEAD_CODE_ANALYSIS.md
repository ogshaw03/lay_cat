# LayCAT デッドコード解析メモ

- **解析日**：2026-09-02
- **対象**：`laycat_dev.html`（15,395 行）
- **調査方法**：scout エージェントで grep 走査＋動的参照（HTML属性・window露出・キーバインド・DOM data-*）まで裏取り
- **前提**：インライン `onclick=""` は 0 件確認済み。呼び出しは全て JS 側 `.onclick=` 経由 → grep ベース検出が信頼できる

---

## 集計

- **確定デッド**：15 件（関数 14 + CSS 変数 1）
- **要確認**：3 件（UI 復活か削除か判断が必要）
- **問題なし（誤検知）**：5 件
- **軽微候補**：未使用 CSS クラス 30 件超

---

## 🟡 要ヒアリング（削除前にユーザー判断が必要）

| # | 場所 | 内容 | 判断ポイント |
|---|---|---|---|
| 1 | `laycat_dev.html:7503` `openR2ConnectModal` | R2 プロジェクトを手動 ID 入力で接続するモーダル | ⇄ 接続 UI 統合時に導線が失われた。復活希望あり得る |
| 2 | `laycat_dev.html:6161` `buildStageStrip` | レビュードロワー上部の「ショット内全工程プルダウン」 | 意図された機能の組込漏れの可能性 |

---

## 🟢 削除安全リスト（機能欠落なし・grep 裏取り済み）

### 中〜大型（機能単位で消える）

| # | 場所 | 内容 | 備考 |
|---|---|---|---|
| 3 | `:11497` `openProgress` / `:11308` `openShotList` | ポップアップ 2 種の起動関数 | render() 内の後始末分岐（pgWin/slWin）と pgBuild/slBuild 等のインフラ含めて一括削除可 |
| 4 | `:3713` `openSubmit` / `:3717` `openSubmitView` | 現役 `openSubmitCreate` の兄弟・薄いラッパー | 中身の subBuildModal/subShowList/subShowView は他所からも使うので残す |
| 5 | `:5619` `pmPreview` | プログレス画面用の動画プレビューモーダル | 関連 `#pmMod` DOM もあれば同時削除 |
| 6 | `:6294` `nodeCard` | 大型カード描画関数（30 行弱） | 現行 UI は `mkTile` / `mkRow` に置換済み |

### 単純ヘルパー 6 件

| # | 場所 | 内容 |
|---|---|---|
| 7 | `:5393` `shotsParentOf`（単数形） | `shotsParentsOf(root)[0]` の 1 行ラッパー |
| 8 | `:11435` `shotCurrentStage` | ショット内の「動画が最新の工程名」を返すヘルパー |
| 9 | `:2502` `defaultDb` | 初期 DB ファクトリ（実 init は 3170 でインライン） |
| 10 | `:2504` `projectIdOf` | `getNode → rootOf().id` の 1 行 |
| 11 | `:3027` `reviewToStatus` | `return st` のみ（完全 no-op） |
| 12 | `:6700` `_qIdentity` | クォータニオン初期値。他の `_qFromAxisAngle` 等は現役 |

### 空スタブ・ノイズ

| # | 場所 | 内容 | 備考 |
|---|---|---|---|
| 13 | `:14413` `updUnsent` / `:14382` `scheduleReelAutoEmbed` | 完全な no-op `function xxx(){}` | 20 箇所以上の呼び出しも同時削除、または本来の実装（未送信件数バッジ）を復活 |
| 14 | `:13049 / 13101 / 14383 / 14414 / 14498` `reelUI.X = fn` 5 件 | `updStatus` / `updHeader` / `scheduleAutoEmbed` / `updUnsent` / `clearPool` の外部公開 | `reelUI.X(...)` の呼び出しは 0 件。内部関数は現役なので代入行だけ削除 |
| 15 | `:22 / :42` CSS 変数 `--hover-bg` | ダーク／ライト両テーマで定義、`var(--hover-bg)` 参照 0 件 | — |

---

## 軽微：未使用 CSS クラス 30 件超（一括削除候補）

### バッジ系（inline `style.background=hexA(color,.18)` に置換済み）
`.badge-empty` / `.badge-pending` / `.badge-approved` / `.badge-retake` / `.badge-rejected`（494-498）

### 旧レイアウト
`.home-flex` / `.home-side` / `.hs-item`

### 旧プログレス画面
`.pm-donrow` / `.pm-tabs` / `.pk-shot` / `.sc-count`

### 旧ノート UI
`.log-gen` / `.log-gen-head` / `.log-note-input` / `.log-notes` / `.note-input` / `.is-comment` / `.mention-role`

### 旧タイムライン
`.tl-fchip` / `.tl-substages` / `.tl-subthumbs` / `.tt-head` / `.tt-shot`

### 旧カード
`.vcard-play` / `.vcard-type` / `.add-tile` / `.cp-tile` / `.cp-label` / `.crop-preview`

### その他
`.file-drop` / `.review-actions` / `.review-media` / `.role-shot` / `.role-stage` / `.size-btn` / `.size-btns` / `.proj-add`

---

## ✅ デッド誤検知（削除禁止・残す）

| 関数 | 実際の呼び出し元 |
|---|---|
| `initSizeBtns`（3705） | `updateFolderStatus();initSizeBtns();`（3209） |
| `projStatuses`（2999） | `stInfo`, `isDoneStatus` など 11 箇所 |
| `subRevokeThumbs`（3718） | `doClose` |
| `pmDonutCard`（5538） | 5502 / 5506 |
| `_probeExrLibs`（1464） | `window._probeExrLibs=...` として意図的にコンソール用露出（コメントで明示） |

---

## 推奨削除順序（安全な順）

1. **CSS 未使用クラス一括削除**（最安全・数十〜100 行減）
2. **単純ヘルパー 6 件**（No.7〜12）＋ `_qIdentity` + `--hover-bg`
3. **空スタブ 2 件 + 20 箇所の空呼び**（No.13）
4. **`reelUI` 外部公開 5 件**（No.14、内部関数は残す）
5. **`pmPreview` / `nodeCard` / `openSubmit` / `openSubmitView`**（No.4-6）
6. **`openProgress` / `openShotList` + 関連インフラ**（No.3、機能ごと消える）
7. **`openR2ConnectModal` / `buildStageStrip`**（要ヒアリング後）

---

## 実施時の注意

- **削除は 1 コミット 1 カテゴリ** を推奨（万一動作不良があった時の巻き戻しが楽）
- **削除後は `laycat_dev.html` を Chrome で開いて主要機能の smoke test**（アップロード・提出・REEL 再生・タイムリマップ・比較モード）
- **Beta（`laycat.html`）は明示指示があるまで反映しない**（現行 CLAUDE.md ルール準拠）
