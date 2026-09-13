# LayCAT TODO

将来対応候補の機能・改善アイデアを記録するファイル。
確定した実装計画・仕様は別途 `docs/` 配下にドキュメント化する。

---

## タブグループ作成機能（優先度：中）

### 概要
ショットタブで既存の複数選択機能（`state.shotSel`）で選択したショット群を、まとめてタブグループとして開く。

### ユースケース
- レビュー時に「今日チェックする 10 カット」を選んでタブグループ化 → 1 グループで並列作業
- チーム内で「あるシーンの全カット」をまとめて開いて連携チェック

### スコープ検討時の論点（2026-09-02 時点）

**1. データモデル**
- A. `state.tabGroups = [{id, name, taskIds:[], color}]` を localStorage 保持（個人設定）
- B. laycat.project.json に保存（チーム共有）

**2. 見た目**
- A. インライン下線＋左端に小ラベル（実装最小・約 200 行）
- B. 折りたたみヘッダ `▼ グループ名 (3)`（実装中規模）
- C. セパレーター区切り（実装最小）

**3. UX**
- 選択→作成：ショット選択バーに「＋ タブグループ作成」ボタン
- 既存タブをグループに追加：右クリック→「グループに追加」メニュー（初版はスコープ外）
- タブの ✕ でグループから自動除去、空になったら自動削除

**4. アクション**
- 必須：作成・全メンバー閉じる
- オプション：名前変更・色変更・グループごと削除（タブは残す）

### MVP 提案（未着手）

- 1: A（localStorage・個人設定）
- 2: A（インライン下線＋ラベル）
- 3: 選択→作成のみ
- 4: 作成 ＋ 全メンバー閉じる ＋ 名前変更 ＋ グループごと削除

見積り：**約 200 行**（既存の task-tabs 描画・D&D と競合しない形で組み込む）。

### 参考実装位置
- 選択バー UI：[laycat_dev.html:5173-5186](../laycat_dev.html) 付近（`▶ 選択した動画を REEL に追加` の隣に追加）
- タブ描画：[laycat_dev.html:4489-4695](../laycat_dev.html) 付近（`state.openTasks` ループ内でグループ判定・ラベル差込）
- 状態：`state.openTasks` に並列で `state.tabGroups` を追加

---

## ユーザー基盤・環境設定・役職システム（優先度：高）

### 概要
Firestore に `laycatUsers/{emailKey}` コレクションを新設し、各 LayCAT ユーザーのプロフィール・環境設定・役職を格納。端末間で同期される。

### 動機
- 現状：ユーザー設定は localStorage のみ → ブラウザ変更で消える／端末間で同期不可
- 現状：役職の概念がない（`projectMembers.roles` は per-project の割当のみ）
- 現状：既存 `laynaAccess/loggedUsers` は単一ドキュメントに全ユーザー map で入っているため詳細設定に不向き

### データモデル案
```
laycatUsers/{emailKey}
├── email, displayName, photoURL, createdAt, lastSeen
│
├── profile: {
│     roles: ["animator","director"],  // 複数選択可
│     primaryRole: "animator",         // メインバッジ用
│     skills: ["3DCG","VFX"],          // 詳細スキル（任意）
│     company: "○○スタジオ",
│     bio: "..."
│   }
│
└── preferences: {
      shortcuts: { newTab: "Ctrl+T", ... },
      upload: { notifyDefault: true, ... },
      annotation: { defaultColor: "#ff5c5c", brushW: 3 },
      ui: { fontSize: 14 },
      reel: { autoPlay: true }
    }
```

### 事前定義役職（`ROLE_TYPES`）
`director` / `producer` / `pm` / `layouter` / `animator` / `modeler` / `rigger` / `compositor` / `paint` / `bg` / `vfx` / `cg` / `reviewer` / `client` / `other`
各役職に：表示名（日本語）・アイコン・色。

### Firestore ルール
```
match /laycatUsers/{emailKey} {
  allow read: if signedIn();  // 他人の displayName/role 閲覧（メンション UI 用）
  allow write: if signedIn()
    && request.auth.token.email.lower().replace('[.@#$/]', '_') == emailKey;
}
```

### 段階実装プラン
- **Phase 1（1 日）**：`laycatUsers/{emailKey}` 基盤・ログイン時 upsert・Firestore ルール
- **Phase 2（半日〜1 日）**：環境設定モーダル（プロフィールタブ＋役職選択）
- **Phase 3（半日）**：役職バッジをタブ・コメント欄・メンションで表示
- **Phase 4（半日）**：プロジェクトメンバー追加時に LayCAT ユーザー DB から選択
- **Phase 5（1〜2 日）**：@メンション の職種フィルタ・統計反映

見積り：MVP（Phase 1 + 2）で **2 日**、フル実装で **4〜5 日**。

### 既存機能への影響
- `laynaAccess/loggedUsers` は併存（アクセスコンソールの表示互換のため）
- `projectMembers.roles` は per-project 割当として残す（グローバル役職とは別レイヤー）
- `projectMembers` に「LayCAT 登録済みユーザーから追加」導線追加（既存の手動入力も併用可）

### 応用先の TODO 候補（別項目化予定）
- **ローカル運用の監査ログ**：役職＋ユーザー DB を前提に「誰が何をしたか」記録
- **稼働期間集計**：各ショットの状態遷移＋担当者を集計してグラフ化・工数計算

---

## ローカル運用（フォルダ運用）の監査ログ（優先度：中）

### 概要
現状 R2 運用は Worker 経由で Firestore `laynaAudit` に監査ログを残しているが、フォルダ運用は Worker を経由しないため一切ログが残らない。プロジェクトフォルダに append-only の JSONL ログを保存し、誰がいつ何をしたか（アップロード・ステータス変更・提出・メンバー追加等）を後追い可能にする。

### 動機
- フォルダ運用は運営者に見えない代わりに、**内部監査もできない**という盲点あり
- チーム内で「誰がこの版を上げた？」を追いたい時に手掛かりがない
- 稼働期間集計の生データにもなる

### データモデル案
```
projects/{pid}/_audit/
  ├── 2026-09.jsonl        // 月別 JSONL（append-only・1 行 1 イベント）
  ├── 2026-10.jsonl
  └── ...
```

各行の形式（JSON Lines）：
```json
{"ts":"2026-09-08T14:23:45.123Z","actor":"tanaka@studio.jp","actorName":"田中太郎","kind":"upload","nodeId":"nd_xxx","versionId":"ver_yyy","meta":{"filename":"cut010_v3.mp4","size":52428800}}
{"ts":"2026-09-08T14:25:12.456Z","actor":"yamada@studio.jp","actorName":"山田花子","kind":"status_change","nodeId":"nd_xxx","meta":{"from":"pending","to":"approved"}}
```

### 記録対象イベント
- **`upload`** …版アップロード（動画・EXR）
- **`status_change`** …ステータス変更
- **`assignee_change`** / **`reviewer_change`** …担当・チェック担当変更
- **`submit`** …提出
- **`review_note`** …アノテ送信
- **`comment`** …コメント追加
- **`node_add`** / **`node_delete`** …ショット・工程の追加削除
- **`member_add`** / **`member_remove`** …プロジェクトメンバー変更
- **`login`** …LayCAT でこのプロジェクトを開いた（起動時に 1 回だけ）

### 各イベントに含むフィールド
- `ts`：ISO タイムスタンプ
- `actor`：認証メール（＝ユーザー ID）
- `actorName`：表示名（snapshot・後から変わっても記録は残る）
- `actorRole`：主役職（laycatUsers から snapshot）
- `kind`：イベント種別
- `nodeId` / `versionId` / `submitId`：対象 ID
- `meta`：kind ごとの詳細情報

### 書き込みフロー
- 各アクション実行後、`storage.appendAudit(pid, event)` を呼ぶ
- 実装：現在月の `_audit/YYYY-MM.jsonl` に 1 行追記
- ファイル書き込み失敗時は console.warn（アプリ動作は継続）
- 月替わり時は自動でファイル分割

### 閲覧 UI
- プロジェクト設定に「📜 監査ログ」タブ
- フィルタ：日付・ユーザー・イベント種別
- CSV エクスポート

### 実装コスト
- **Phase 1**：`storage.appendAudit()` 実装・upload/status_change だけ記録：**半日**
- **Phase 2**：全イベント種別記録：**1 日**
- **Phase 3**：閲覧 UI：**1〜2 日**
- 合計 **2〜3 日**

### R2 運用との整合
- R2 は既存 `laynaAudit` に集約（変更なし）
- フォルダ運用のみ `_audit/` を有効化（設定でオフ可能）
- 両方で使う場合は各自に記録される（要用途整理）

### 課題
- **改ざん可能**：ローカルファイル書き込みなので誰でも編集可能（悪意ある改ざんは検知できない）
- **削除された shot に紐付いた log**：node 削除後もログ側に残る（監査目的なのでこれで OK）
- **ファイルサイズ**：大規模プロジェクトで数 MB になる可能性 → 月別分割で緩和
- **同期タイミング**：Google Drive 経由だと反映まで数十秒ずれることあり

---

## 工数集計・プロジェクト進行の見える化（優先度：中）

### 概要
LayCAT 本体からアクセス可能な**外部 HTML（`manhours.html`）** として実装。ステータス変更履歴・アップロード履歴・監査ログを集計し、ガントチャート／リテイク数／日別アクティビティ／操作ログの 4 タブで可視化する。会社方針「目標 → 取り組み → 照合」の "照合" フェーズを支えるツール。

### 動機
- **スタジオ経営**：各カットの実所要時間を把握して見積もり精度を上げる
- **進行管理**：予定 vs 実績で遅延ショットを早期検出
- **個人管理**：自分の作業ペース・工数傾向を自己分析（会社方針「照合」）
- **プロジェクト振り返り**：進行がどうだったかを可視化して次回改善に活かす

### 外部 HTML の構造（`manhours.html`）
`access-console.html` と同じパターンで独立 HTML。LayCAT 本体の「メニュー → 工数集計」から新規タブで起動。データアクセスは **ユーザーがプロジェクトフォルダを FSA API で選択**（access-console 方式）。初回選択後は IndexedDB に永続化。

**却下案**：`postMessage` 経由（window 参照必要・実装複雑）／共通 IndexedDB（同一オリジン限定・二重管理）。

### UI 構成（4 タブ）

| タブ | 内容 | データ源 |
|---|---|---|
| 📅 **ガント** | ショット別 × 工程別の稼働期間バー | status.json.history |
| 🔁 **リテイク** | ショット別のリテイク数を折れ線で表示 | status.json.history |
| 📈 **アクティビティ** | 日別アップロード / 操作数の折れ線 | version.uploadedAt + audit log |
| 📜 **操作ログ** | 生ログの検索・フィルタ・CSV | audit log |

### 集計方法（要相談：Q1）

**A. 作業中限定**：`作業中` 突入 → `作業中` 離脱 の時間の合計
- 正確だが status 更新徹底が必須

**B. 未着手離脱〜次工程移行**：`未着手` 以外に遷移 → 次工程移行 or `クライアントOK` までの総計
- 停止時間を含むが取りこぼしにくい

**C. A + B 併記（推奨）**：両方を計算し、UI で切替表示
- 判断材料として最強・実装量少・現場で運用しながら判断できる

### 工程完了の自動判定
LayCAT のショットは工程（layout / anim / comp 等）ごとに子ノード（`type:review`）を持ち、子ノード単位で status を持つ。**次工程の status が動いた時点で前工程は自動的に "完了" 扱い**にすれば、既存 UI 変更なしで成立。「工程完了」ボタンは不要。

### リテイク数集計
`status.json.history` から派生：
- **クライアントリテイク**：`クライアントOK` → 何か → 再度作業系 に遷移した回数
- **社内リテイク**：`チェック待ち` → `差し戻し` に遷移した回数
- **完了回数**：`クライアントOK` に到達した回数

**status の意味づけ**（要相談：Q2）：
- **a. 設定 UI を追加（推奨）**：プロジェクト設定で「クライアントOK に該当する status」「差し戻しに該当する status」を明示指定
- b. 命名規約：status ID に `client-ok` `internal-back` 等の予約語
- c. ヒューリスティック：label 文字列で自動判別

### 同一作業者 × 同日 × 複数ショットの割り振り

**ルール**：1 日 ÷ その日に作業したカット数（作業者本人の稼働は等分配される）

**「作業した」判定の候補**（要相談：Q4 と関連）：
- 1a. status が `作業中` だった日
- **1b. その日に何らかの操作をした日（status 変更・アップロード・コメント）** … 推奨
- 1c. 稼働ウィンドウが跨いだ日

推奨は 1b（案 A / B のどちらでも整合・他プロジェクトの余暇日を除外可能）。

### 集計軸
- ショット別
- 工程別（レイアウト／作画／仕上げ 等）
- 担当者別
- 期間別（週次・月次）
- 職種別（アニメーター全体／モデラー全体）

### データソース

| ソース | 現状 | 用途 |
|---|---|---|
| `status/{sid}.json.history` | ✅ 実装済（v:5） | 稼働期間・リテイク集計の主データ |
| `shots/{sid}.json.versions[].uploadedAt` | ✅ 実装済 | 版アップロード履歴・アクティビティ |
| 監査ログ（audit/*.jsonl） | ⚠ 別 TODO | 操作ログ・アップ以外の日別アクティビティ拡張 |
| `laycatUsers/{emailKey}` | ⚠ 別 TODO | ユーザー別集計・役職別集計 |

**Phase 1 の材料は既に揃っている**（v:5 status.json + version）。監査ログ・ユーザー基盤は Phase 2 で拡張。

### 要相談ポイント（着手前に決定すべき設計判断）

**Q1. 稼働期間の算出方法**：A / B / **C（両方併記・推奨）**

**Q2. status の意味づけ設定**：**a（設定 UI・推奨）** / b（命名規約）/ c（ヒューリスティック）

**Q3. Phase 1 スコープ**：
- 稼働期間ガント：status.json だけで可能 ✅
- リテイク数：status.json だけで可能 ✅
- 日別アクティビティ：version.uploadedAt だけ（アップロードのみ）で成立、監査ログ待ちで拡張
- 操作ログ：監査ログ必須 → Phase 2

**Q4. 同一作業者 × 同日の割り振り実装タイミング**：Phase 1 / **Phase 2（推奨）**
- まず単純な稼働期間を出してから調整するほうがユーザー検証しやすい

**Q5. 監査ログ TODO との統合**：独立実装 / **同時実装（推奨）**
- 監査ログ形式（`audit/YYYY-MM.jsonl`）を工数集計の要件も踏まえて設計するのが最も効率的

**Q6. 実装優先度・タイミング**：他機能との順序と、いつ着手するか

### 実装フェーズ

**Phase 1（工数集計 MVP・監査ログ不要）** — **4〜5 日**
1. `manhours.html` スケルトン + FSA API でプロジェクトフォルダ選択（0.5 日）
2. status.json / shots/ / laycat.project.json の読み込みエンジン（0.5 日）
3. status の意味づけ設定 UI（Q2-a を選んだ場合、0.5 日）
4. 稼働期間計算エンジン（案 C = A + B 両方、1 日）
5. ガント SVG 描画（0.5 日）
6. リテイク折れ線 SVG 描画（0.5 日）
7. アクティビティ折れ線（アップロードのみ、0.5 日）
8. LayCAT 本体にメニュー導線追加（0.25 日）

**Phase 2（監査ログ統合 + 拡張）** — **3〜4 日**
1. 監査ログ TODO を並行実装（audit/YYYY-MM.jsonl append-only ロガー）
2. アクティビティ折れ線に全操作を追加
3. 操作ログタブ（フィルタ・CSV エクスポート）
4. 同一作業者 × 同日の割り振り実装
5. laycatUsers/ 連携（ユーザー別・役職別集計）

**合計：7〜9 日**（Phase 1 単独なら 4〜5 日でも実運用に足りる）

### 依存関係マップ
```
ステータス JSON 分離（v:5・実装済）
    │  history[] が主データ源
    ▼
工数集計 Phase 1 ◀────────── ステータス意味づけ設定 UI
    │
    ├─────────────────────────┐
    ▼                          ▼
監査ログ TODO ◀── Phase 2 統合 ── ユーザー基盤 TODO
    │  (audit/YYYY-MM.jsonl)         │  (laycatUsers/{emailKey})
    └─────────────┬────────────────┘
                  ▼
          工数集計 Phase 2（拡張）
```

### 課題・論点
- **稼働 ≠ 実労働時間**：案 A でも「作業中」放置は含まれる。「概算」割り切りが前提。
- **休日判定**：土日祝日を除外する仕組みが必要（オプションでカレンダー設定）
- **想定精度**：あくまで概算。労務時間管理システム（給与計算等）の代替にはならない
- **プライバシー**：個人稼働時間の集計は同意 UI が必要かも（laycatUsers の preferences に「集計対象に含める」フラグ）
- **status のカスタム定義**：プロジェクトごとに status ID が異なるため、意味づけ設定 UI（Q2-a）が実質必須

### 着手条件
以下がすべて満たされたタイミングで実装着手：
1. 会社側の実運用準備が整い、工数集計データを実業務で使う意思がある
2. Q1〜Q6 の設計判断が確定している
3. 監査ログ TODO と同時実装で進める合意がある（推奨）

---

## ステータス JSON 分離（v:5 化）— 巻き戻り事故の根本解決（優先度：高）

### 概要
`shots/{sid}.json` に混在している `status`（および任意で `assignee`/`reviewer`）を、`status/{sid}.json` という別ファイルに物理的に分離する。3-way マージ経路から `status` を **原理的に外す** ことで、巻き戻り事故の再発余地を絶つ。

### 動機
- **巻き戻り事故の恒久解決**：v.027／v.039／v.045→v.048 と、3-way マージ調整のたびに新変種が出続けている歴史がある。「マージが status を触れる限り、抜け穴を塞ぐ戦いは終わらない」ため、マージ経路から物理的に外す。
- **監査ログ・工数集計と設計が完全一致**：3 機能が 1 つの土台に乗せられる（下記「依存関係」参照）。
- **コード保守性の向上**：`_mergeNode3` から status ブロック（16 行）＋関連 200〜300 行のマージロジックが削除可能。v.048 の 3 段防御コードも撤去できる。

### なぜファイル分離か（代替案との比較）

過去に検討した 2 案との比較：

| 案 | 事故排除の強度 | 実装コスト | 監査ログとの親和性 | 汎用性 |
|---|---|---|---|---|
| narrow-writer（書き込み経路を絞る） | ⚠ コードミスに弱い | ~2.5 日 | ○ | ○ |
| updatedAt 比較（値ごとにタイムスタンプ） | ⚠ 時計ズレに依存 | ~3〜4 日 | ○ | ✅ |
| **ファイル分離（本案）** | ✅ 物理的に無理 | ~4〜5 日 | ✅✅ | ○ |

**結論**：多少コスト高でもファイル分離が最強かつ副産物（監査ログ・工数集計との統合）が大きい。

### ストレージ構造変更

**現状 v:4**
```
projects/{pid}/laycat.project.json     ← 骨格 nodes + shotIds
projects/{pid}/shots/{sid}.json        ← shot ノード + kids + status 全部
projects/{pid}/submits/{sid}.json
```

**提案 v:5**
```
projects/{pid}/laycat.project.json     ← 変更なし
projects/{pid}/shots/{sid}.json        ← status キーを除去（それ以外は現状通り）
projects/{pid}/status/{sid}.json       ← ★NEW｜status + updatedAt + updatedBy + history
projects/{pid}/submits/{sid}.json      ← 変更なし
```

### `status/{sid}.json` のスキーマ
```json
{
  "v": 1,
  "shotId": "nd_xxx",
  "status": "pending",
  "updatedAt": "2026-09-11T14:23:45Z",
  "updatedBy": "tanaka@studio.jp",
  "source": "ui",
  "history": [
    {"ts":"2026-09-10T09:00:00Z","by":"tanaka@studio.jp","from":null,"to":"in_progress","source":"ui"},
    {"ts":"2026-09-11T14:23:45Z","by":"tanaka@studio.jp","from":"in_progress","to":"pending","source":"upload"}
  ],
  "_rev": 5
}
```

`source` は `"ui"` / `"upload"` / `"submit"` / `"migrate"` のいずれか。マージ経路や自動整合ロジックからの書き込みは物理的に発生させない（＝存在しない）。

### 事故が発生し得ない理由
- **shot3 の工程変更 → `shots/{s3}.json` のみ書き換え**。`status/{s1}.json`, `status/{s2}.json` は物理的に触らない → shot1/2 の status が変わる余地が存在しない。
- **3-way マージから status が完全に外れる**：`_mergeNode3` の status ブロックは削除。
- **baseline 乖離が status に影響しない**：shot ファイルの baseline がズレて false-dirty 判定に落ちても、書き込まれるのは shots/{sid}.json だけで、そこには status が入っていない。

### 実装フェーズ

| Phase | 内容 | 見積 |
|---|---|---|
| 1 | v:5 スキーマ定義・status/{sid}.json 形式決定 | 0.5 日 |
| 2 | storage 層に `loadStatus/saveStatus/loadAllStatuses/delStatus` 追加（フォルダ運用） | 0.5 日 |
| 3 | R2 Worker に status オブジェクトの CRUD 追加＋クライアント側の同 API | 1 日 |
| 4 | 起動時ロード：`loadProject` で shot と status を並行取得 → `node.status` に注入 | 0.5 日 |
| 5 | 保存フロー：status 変更は `saveStatus()` 経由に集約、`saveProjectSplit` からは status 除外 | 0.5 日 |
| 6 | v:4 → v:5 migrate：起動時に既存 shot.status を status/{sid}.json へ書き出し（1 回だけ） | 0.5 日 |
| 7 | `_mergeNode3` から status を除去、v.048 の 3 段防御コード撤去 | 0.25 日 |
| 8 | 動作検証・多人数運用テスト | 0.5 日 |

**合計 ~4.25 日**（監査ログ・工数集計と統合実装すればさらに短縮可能）

### 依存関係マップ

```
ユーザー基盤（laycatUsers/{emailKey}）
    │  updatedBy に使うため
    ▼
ステータス JSON 分離 ◀────┐
    │                      │  history 配列が生データ
    │ 変更履歴を提供         │
    ▼                      │
監査ログ ─────────────────┘（相互参照）
    │
    │ 集計対象データ
    ▼
稼働期間・工数集計
```

**推奨着手順序**：
1. ユーザー基盤（Phase 1〜2） → `updatedBy` の基盤
2. ステータス JSON 分離（Phase 1〜7） → 巻き戻り根絶＋履歴データ源
3. 監査ログ（他イベントの記録） → status 以外のイベントも記録
4. 稼働期間・工数集計 → 上記データを集計

### 課題・論点
- **v:4 → v:5 マイグレーション**：起動時に 1 回だけ shot.status を抜き出して status/{sid}.json を作成。冪等性を担保（既に status ファイルがあれば skip）。
- **後方互換**：旧 laycat.html（v:4 のみ理解）で開くと status が消えて見える。**Beta を先に v:5 対応してから広く公開**する順序が必要。
- **R2 Worker 拡張**：既存の shots/submits と同パターンで API 追加。認可は同じ owner/members ベース。
- **ファイル数増加**：ショット数 × 1 ファイル増える（100 ショット → 100 ファイル）。フォルダ運用では気にならない。R2 では 1 プロジェクト数千オブジェクトになる可能性 → list 系 API に注意。
- **assignee/reviewer も同様に分離するか**：初版は status のみ、必要に応じて後続で `assignee/{sid}.json` を追加（本案の設計を踏襲）。

### v.048（現状の 3 段防御）との関係
- 現在の 3 段防御（`_shotFileJsonForBaseline` ヘルパ／rev 逆行ガード ×2）は **暫定対策**。
- 本 TODO 実装時に **Phase 7 で全撤去**し、コードを大幅に簡素化できる。
- それまでは 3 段防御で当面回す（ユーザー報告の再現路は塞げているため実用上問題なし）。

### 実装トリガー
- 会社側の実運用準備が整い、監査ログ・工数集計の設計フェーズに入るタイミングで着手。
- 単独で着手する優先度は現時点では低いが、他 3 機能と統合すれば実装コスト対効果が最大化する。

---

## （今後の TODO 追加はここに）
