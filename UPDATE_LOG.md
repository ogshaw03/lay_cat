# LayCAT アップデートログ

このファイルは開発中の全変更を記録するログです。
`PATCH_NOTES.md` はここから取捨選択して更新されます（運用方針は `CLAUDE.md` の「パッチノート運用」を参照）。

セクション構成：
- **未反映（次のパッチノート候補）** … まだ Beta（`laycat.html`）に入っていない項目。
- **反映済み・パッチノート記載なし** … Beta には反映済みだが `PATCH_NOTES.md` には記載していない項目（バグ修正・運営限定変更・実験機能など）。次回パッチノート更新時に載せ替え候補になる。
- **反映済み beta vX.Y.Z** … `PATCH_NOTES.md` に記載済みの項目（バージョンごとにアーカイブ）。

---

## 未反映（次のパッチノート候補）

<!-- 以降、コミット単位で `- (short-hash) 日本語要約` を追記していく -->

- **EXR 連番シーケンス対応（ローカルフォルダ運用のみ）**：`＋ 動画` から複数 EXR を選択すると連番として認識してアップロードできる。命名パターン（`base.001.exr` 等）を自動検出し、同一ベースの連番グループを 1 版にまとめる。混在ファイルやパターン不一致は従来通り 1 件ずつアップ。
  - 実装：`groupExrSequence(files)` で連番判定 → 専用モーダル `openExrSeqUploadModal`（版名／FPS／コメント） → `uploadExrSequence` で全フレームを media/ に保存 → 版データは `type:'exr_seq'` + `frames:[{file,cache,name,frame}]` + `fps` で持つ。
  - R2 プロジェクトでは非対応（トースト警告して個別アップに促す）。
  - タスクページのタイルには紫の `SEQ Nコマ` バッジを表示。
  - レビュー画面に連番再生バーを追加：▶ 再生 / ⏸ 停止（FPS で自動送り・末尾でループ）・±1F ボタン・フレームスライダ・現在フレーム表示。
  - **アップロード時に全フレームの JPEG キャッシュを事前生成**：`thumbnails/<seqId>_<frame>.jpg` として保存し、`frames[i].cache` に参照を持たせる。再生時はキャッシュ JPEG を優先で使用し、EXR 都度パース（数百 ms）を回避（数 ms）。キャッシュが揃うまで進捗バーは「アップロード中」表示のままにして、完了時のトーストにキャッシュ生成成功数（例：`キャッシュ 47/47`）を表示。
  - オンメモリキャッシュも継続（LRU 60 フレーム）：一度取得した URL を短期記憶して再スライド時のフレッシュ取得を省略。
  - 削除時は各フレームの実 EXR とキャッシュ JPEG の両方を `storage.delMedia` で除去。
- **EXR 連番のレビュー画面 UI を mp4 と統一**：独自の下部スライダを廃止し、video で使っているタイムライン（canvas 版・フレーム目盛り・IN/OUT 範囲マーカー・プレイヘッド）と同じ UI をそのまま使うよう統合。プレイ／−1F／＋1F／ループ／IN／OUT／解除／fps セレクタ／タイムラインスクラブ すべて mp4 と同じ操作で使えるようになる。実装は `isPlayable = isVideo || isSeq` として `curFrame`/`dispFrame`/`seekRT`/`setupDuration`/`drawTimeline` を seq 対応、seq の再生は setInterval で FPS 毎にフレーム送り。範囲設定＆ループも video と同じ挙動。

---

## 反映済み beta v0.0.4

- タスクタブがブラウザリロードで消える不具合を修正。ハッシュ復元経路でも `openTasks` / `expanded` を localStorage から復元、URL の対象がタスクなら自動でタブに追加。加えて未解決 ID（暗号化解錠前・R2 非同期取り込み中）を `state.openTasks` から破壊的に削除しないよう堅牢化。close ボタンと「すべて閉じる」も表示中タブのみを対象。
- mp4 動画アップロード直後のコーデック警告オーバーレイ誤表示を根本対処。`uploadVersion` 内で元 File／サムネ Blob からその場で blob URL を作って `storage.urlCache` に投入。renderBody / openReview（FB オーバーレイ）で同期 src 設定。ローカル・R2 どちらの運用でも一瞬フラッシュも起きない。1.2s 遅延と canplay での自動 clearBadge も併設。

---

## 反映済み・パッチノート記載なし（Beta 反映済み・PATCH_NOTES.md 未記載）

- **【2026-07-22 Beta 反映 まとめ】** 以下の修正を beta v0.0.4（一部は据え置き）で反映。パッチノート記載対象は下記「反映済み beta v0.0.4」を参照：
  - 左サイドバーのカテゴリ／ショットの並び順を作成順 → 名前順（自然順ソート）に変更。ショットナンバー（"SC001"→"SC010"→"SC100"）で上から並ぶ。
  - ショット直下の工程の並び順を「工程設定（`section.stages` 配列の順）」に追従するよう変更。従来のハードコード `stageRankCmp` はフォールバック。
  - 動画サムネイルのキャプチャ位置を「1 秒地点」→「1 フレーム目」に変更。
  - 「チェック依頼」通知がチェック担当者に届かない不具合を修正：走査に「各タスクの新版アップロード」パスを追加（タスク直接アップの経路で通知が生成されるように）。重複抑止を `DB.notifications.rqKey` ベースへ切替。サブミット作成時に `byEmail` を保存し「自分の提出をスキップ」判定をメールで厳密化。担当者名比較の大文字小文字無視化。
  - 動画プレイヤーに音量／ミュート切替を追加：FB オーバーレイに 🔊/🔇 トグル＋音量スライダ、タスクページタイルに 🔊/🔇 トグル。起動時に明示的に `muted=false`／`volume=1.0`。設定は localStorage で保存。
  - はじめ方ガイド（`guide.html`）を新規作成（画面スクショ付き 10 ステップ構成）。`intro.html` の最上部に誘導帯・ヒーローにカード導線を追加。
- **メンテナンス終了時の自動リロードをキャッシュバスター付きに変更**（beta v0.0.3 ホットフィックス）：
  従来は `location.reload()`（普通リロード）で古い HTML が返る可能性があったが、
  `location.href=location.pathname+'?_='+Date.now()` に変更して 100% 最新版取得を保証。
  URL 見た目は一瞬 `?_=...` が付くがブックマーク・共有 URL は影響なし。
- 再生範囲（OUT）到達時のクランプ精度を向上：timeupdate（100〜200ms間隔）ではプレイヘッドが範囲外に1F以上はみ出してからループ/停止していたが、requestAnimationFrame で毎フレーム監視するよう変更し、OUT に到達した瞬間にクランプするように改善（アノテウィンドウ・REEL 両方）。
- 上記の追加バグ修正：ループ再生の2回目以降で監視 rAF が再スケジュールされず、OUT を素通りしていた不具合を修正。ループ時は監視を継続、停止時は監視終了。
- 運営向けメンテナンス中バナー（画面上端のオレンジ帯）を半透明＋クリックスルーに変更。バナー背後の LayCAT UI が見えるようになり、メンテ告知は残しつつ通常操作を邪魔しないように改善。オレンジの濃さは .15 に薄めて背景をより見せる形に。
- **料金プラン設計メモ**（`docs/PRICING_MEMO.md`）：LayCAT R2 と BYO（Bring Your Own R2）両方を想定した Free / Pro / Team のプラン設計。Stripe 前提で人数制限とプロジェクト作成権限をプラン別に定義。
- **セキュリティ・NDA 議論メモ**（`docs/SECURITY_MEMO.md`）：運営がすべての R2 プロジェクトの中身にアクセスできる構造への他社視点の不安感、Tier 別対応（一般 / 機密案件で暗号化必須 / ハイエンドで専用環境）等の議論メモ。
- 用語統一：UI 上の「項目」を「アイテム」に変更（プロジェクト設定・作業一覧・タスクページ等の各所）。
- 空プロジェクトへのオンボーディング改善：まだ子ノードが無いプロジェクトを開いたとき、中央に大きな「＋ プロジェクト作成／＋ カット追加／＋ タスクを追加」ボタンを表示。従来は小さいボタンが左上に寄っていて何をすればいいか分かりづらかった。
- EXR ダイアログ廃止＋アノテウィンドウに全機能統合：旧「🎨 EXR 表示調整」モーダル（openExrViewer 約 180 行）を削除。露出／ガンマ／Depth／レイヤー切替／サムネ更新／レイヤー詳細（ホバー表示）を全てアノテウィンドウのトップバーに集約。代わりに「🎨 全レイヤー」ボタン（openExrLayerGrid）でモーダル一覧表示。
- **R2 プロジェクトメンバー方式アクセス制御**（beta v0.0.3 に含まれるが要 Worker 再デプロイ）：`_access.json` に owner/members を保持、Worker 側で全 R2 操作前に検査。詳細は beta v0.0.3 のパッチノート参照。
- **Worker のセキュリティ強化**（beta v0.0.3 に含まれるが要 Worker 再デプロイ）：ファイルサイズ上限＋監査ログ。詳細は beta v0.0.3 のパッチノート参照。
- **プロジェクト接続 UI の統合**（beta v0.0.3 に含まれる）：ホームの「⇄ プロジェクトを接続」に R2 プロジェクトタイル一覧を統合。

---

## 将来対応（TODO）

### R2 運用まわり（今後まとめて着手）

**セキュリティ・アクセス制御**

- ~~**R2 のアクセス制御を「プロジェクトメンバー方式」で実装**~~ ✅ **実装済み**（要 Worker 再デプロイで反映）
- （旧計画：以下は実装済みの内容の参考記録）
  - LayCAT 側：`root.owner` を新規追加（作成者メール自動セット）、既存 `root.members` はそのまま
  - R2 側：プロジェクト直下に `_access.json`（平文で owner/members だけを持つ小さな JSON）を配置。laycat.project.json 本体は暗号化されていても _access.json は平文で維持する
  - Worker：全 R2 操作の前に `_access.json` を読み、`token.email === owner || members に含まれる` なら許可、そうでなければ 403
  - 初回作成：`_access.json` が無い場合のみ「新規作成」扱いで PUT を許可（作成者が自動 owner）
  - owner 権限譲渡・メンバー編集は既存の LayCAT メンバー管理 UI から。編集時は `_access.json` も同時更新
  - Worker のメモリキャッシュ（60秒）で毎リクエストの R2 GET レイテンシを緩和
  - バケット構造は現状の `projects/<projectId>/` を維持（owner ディレクトリ階層化はしない。owner の変更や共有が楽なため）
  - 既存のフォルダ運用プロジェクトはメンバー管理を書き込み判定に使っていないので、R2 運用時のみこの機構が動く形
  - 実装前に決めるポイント：
    - **owner の付与範囲**：全プロジェクト（フォルダ含む）に `root.owner` を付けるか、R2 プロジェクトだけか
    - **既存 `root.members` の解釈**：「担当・メンション用」の意味だけの現状を「書き込み権限」と同一視するか、別軸で持つか（例：`root.editors` を新設）
    - **admin エスカレーション**：owner 不在時に laynaAccess の `adminEmails` が強制的に owner 権限を持てるルールを Worker で入れるか

- **Firebase Service Account のロールを最小権限化**
  - 現状は Firebase 管理コンソールで生成した Service Account をそのまま使っており、Firestore に対して過剰権限を持っている可能性が高い
  - GCP コンソール → IAM で該当 SA のロールを「Cloud Datastore ユーザー」または「Cloud Datastore 閲覧者」（read only で足りるなら）に絞る
  - 万が一 FIREBASE_SERVICE_ACCOUNT シークレットが流出した場合の被害範囲を限定

- **R2 バケットの Versioning を有効化**（**現状 UI からは操作不可・保留中**）
  - Cloudflare の R2 は現状ダッシュボード UI からバージョニングを有効化する項目が無い（2026-07-21 確認時点）
  - 代替案：
    - **バケット ロック ルール**（削除・上書き防止の retention 設定）で保険は張れる
    - **S3 API 経由**でバージョニング設定できる可能性あり（未検証）
    - **自前でスケジュールドバックアップ Worker**：定期的に project.json を別プレフィックスにコピー
  - 将来 Cloudflare が UI 対応したら再検討

- ~~**Worker にファイルサイズ上限を設定**~~ ✅ **実装済み**（要 Worker 再デプロイで反映）
- ~~**監査ログ**（軽量版：console.log → Cloudflare Workers Logs）~~ ✅ **実装済み**（要 Worker 再デプロイで反映）
- **監査ログ（永続版＋ access-console 統合）**：現状は Cloudflare Workers Logs（保存期間限定）だけなので、長期保存と access-console からの閲覧を可能にする
  - **保存先**：Firestore `laynaAudit/{autoId}` コレクション
  - **書き込み**：Worker 側で `ctx.waitUntil()` を使い非同期記録（レスポンスに影響なし）
  - **フィールド**：ts, method, path, email, status, duration, extra, ray（Cloudflare Ray ID）, ip, ua（不正調査用）
  - **保持期間**：30日（Firestore TTL 設定）
  - **access-console.html への追加**：「監査ログ」タブ／直近500件表示／フィルター（メール・ステータス・期間）／CSV エクスポート／リアルタイム更新（onSnapshot）
  - **メタ監査**：監査ログ画面自体の閲覧履歴も別コレクションに記録（誰が監査ログを見たか）
  - **前提**：まず運営側での NDA・プライバシーポリシー・利用規約整備が先。詳細な運営視点のセキュリティ議論は `docs/SECURITY_MEMO.md` 参照

- **運営整備（サブスク展開前に必須）**：
  - NDA テンプレート
  - プライバシーポリシー（運営がデータにアクセス可能な範囲と目的を明示）
  - 利用規約
  - Tier 別サービス設計（一般 / 機密案件でプロジェクト暗号化必須 / ハイエンドで専用環境）
  - 詳細は `docs/SECURITY_MEMO.md` 参照

**データ整合性**

- **R2 の楽観的ロック（ETag + If-Match）で完全同時保存の race を防ぐ**
  - 現状 persist() は「読み→3-wayマージ→書き」だが、読みと書きの間に他ユーザーが書くと後勝ちで消える可能性がゼロではない
  - R2 は ETag をサポート。GET で取得した ETag を PUT の If-Match ヘッダに載せ、412 Precondition Failed が返ったら再読み込み→再マージ→再 PUT のループにすれば完全同時保存も安全に処理できる

**運用・UX**

- **プロジェクト一覧の集約 UI**（他ユーザー所有 R2 プロジェクトの発見導線）
  - 現状 REG は各ブラウザの localStorage に保存されているので、他人が作った R2 プロジェクトの存在に気づけない
  - Worker に「自分がメンバーとして招待されているプロジェクト一覧を返す」API を追加し、ホームに表示

- **フォルダ運用 → R2 移行機能**
  - 既存のフォルダ運用プロジェクトを R2 にコピー移行する UI
  - laycat.project.json + media/ + reels/ を丸ごとアップロード

- **R2 プロジェクトのオフライン対応（余裕があれば）**
  - Service Worker + IndexedDB で最終取得データをキャッシュ、オフラインでも閲覧可能に
  - 書き込みは online 時のみ（もしくはキューして復帰時に flush）

### EXR フォーマット対応 Phase 2（多層 EXR ・特殊レイヤー可視化）

現状の Phase 1（単一 EXR + 露出/ガンマ）では Three.js EXRLoader の制約で対応範囲が狭く、
Cryptomatte / Multi-part / Deep EXR / UINT ピクセル型が読み込めない。VFX ワークフローでは
Depth や Cryptomatte の確認が必須なので Phase 2 で本格対応する。

- **ライブラリ選定**：openexr-wasm を第一候補（1〜2MB WASM・全機能ほぼ網羅）
  - 代替案：自前パーサ実装 / Three.js EXRLoader 拡張
  - まず PoC で CDN 経由（esm.sh）読み込みが可能か検証
- **多層パース**：全チャンネル一覧（beauty.R/G/B, depth.Z, N.X/Y/Z, crypto00.* 等）
- **チャンネル/レイヤー選択 UI**：ドロップダウン
- **視覚化プリセット**：
  - Beauty (RGB) — 既存の露出/ガンマ
  - Depth (Z) — グレースケール + Near/Far 手動指定 + 疑似カラー（Turbo/Viridis）
  - Normal (XYZ) — X→R, Y→G, Z→B マッピング（±1 を 0〜1 に正規化）
  - Motion Vector — ヒートマップ
  - Cryptomatte — ハッシュ→疑似カラー変換
- **Cryptomatte 高度機能**（余裕あれば）：Alt+クリックで ID 表示、matte 抽出等
- **見積もり**：最小限（多層読み取り+チャンネル選択）で 半日〜1日、視覚化プリセット含めた完全版で 2〜3日、Cryptomatte 本格対応で追加 1〜2日

### R2 以外

- **Firestore パスのプレフィックスを `layna` → `laycat` にリネーム**（今は稼働中データに影響するため保留）
  - 対象コレクション：`laynaAccess/config` / `laynaAccess/invited` / `laynaAccess/loggedUsers` / `laynaAccess/maintenance` / `laynaAccess/broadcast` / `laynaAccessInvites/{token}`
  - 必要作業：
    1. `laycat.html` / `laycat_dev.html` / `access-console.html` 内のパス定数を書き換え
    2. Firestore セキュリティルールを新パス用に書き直し
    3. 既存 Firestore データを旧パスから新パスへコピー
    4. 旧パスのデータを削除
  - 稼働中のライブサイトへの影響が大きいため、実施前にメンテナンス告知＋アクセス数の少ない時間帯で作業する

---

## 反映済み beta v0.0.3（2026-07-21）

### EXR フォーマット対応
- **EXR カスタムパーサ**：ZIP/ZIPS/無圧縮、HALF/FLOAT、Scanline+Tiled ONE_LEVEL に対応。DecompressionStream API 使用。openexr-wasm を使わず自作した理由は「LayCAT の単一 HTML 構造を維持するため／CDN 経由で動的 import できるライブラリが存在しないため」。
- **多層 EXR の全レイヤー描画**：アノテウィンドウのレイヤードロップダウン + 「🎨 全レイヤー」モーダル。
- **可視化モード自動判定**：RGB / Depth（黒白点・反転付き）/ Normal（XYZ）/ Motion Vector（HSV）/ UV / Position / 輝度 / アルファ / Cryptomatte（preview + rank + rank 0 合成フォールバック）
- **仮想サブレイヤー**：beauty (ABGRZ) から自動的に Z (Depth)、A (Alpha) の独立エントリを生成
- **チャンネル表示**を EXR 内部順（BGR）から慣習の RGBA 順に並び替え
- **アノテウィンドウ EXR 統合**：露出／ガンマ／Depth スライダ（数値直接入力可）＋ サムネ更新ボタン＋レイヤー詳細ホバー
- **キャッシュ**：parseCache（LRU 3 件）+ renderCache（LRU 30 件）でセッション内 2 回目以降は即開く
- **Cryptomatte 対応**：ID を MurmurHash3 で 24bit RGB に変換して色分けモザイク表示。UINT ピクセル型も Cryptomatte 限定で描画可能に。プレビューが空の場合は Rank 0 から合成。
- 画像/EXR 送信時のスクショ焼き込み（フレーム概念のない画像でも Snapshot がノートに残る）
- 画像アイテムのフレームコメント欄が正しく表示されるように

### R2 対応（プロジェクト保存先）
- Cloudflare R2 バックエンド追加（`storage` 抽象化に r2 分岐、`r2:<projectId>|<path>` 参照）
- Worker（`worker/laycat-r2-api.js`）＋ セットアップ手順（`docs/R2_SETUP.md`）
- Firebase ID トークン検証＋メンバー方式 ACL（`_access.json`）
- Worker ファイルサイズ上限＋監査ログ
- プロジェクト接続 UI に R2 タイル一覧統合
- ※ Cloudflare 側のセットアップ（バケット作成・Worker デプロイ・Firebase Service Account 設定）が必要

### NOTE パネル
- タスクページ右カラムに contenteditable ベースのリッチテキストメモパネル
- ツールバー：太字／斜体／下線／H₁ H₂／文字サイズ／境界ライン
- 手動保存（Ctrl+S）、未保存時 beforeunload 警告
- 境界ライン（HR）はクリック選択＋ダブルクリック／Delete で削除可能
- position:sticky で右カラム固定、内部でスクロール
- 右側スライドでは非表示（面積確保）

### アノテーション UI 整理
- 描画／消しゴムを 1 つのトグルボタンに統合（OFF → 描画 → 消しゴム → OFF）
- サイズセレクトも 1 つに統合（現在ツールに応じてプリセット自動切替）

### バグ修正・軽微改善
- Worker `isAllowed` に access.json フォールバックを追加（admin メールが access.json 側だけにあると 403 になっていた不具合）
- タイムラインのプレイヘッド位置ズレ修正（`f*fw+fw/2` → `f*fw`）
- 各種 EXR 描画バグ修正：チャンネル順ソートを localeCompare から strict ASCII 比較に変更（ピンク色化解消）、Tiled チャンクヘッダ順序修正、Normal 背景を黒扱いに、等

---

## 反映済み beta v0.0.2（2026-07-17）

- アノテーションウィンドウに再生範囲（IN/OUT）機能を追加。＜／＞ボタンで現在フレームを範囲の開始／終了に設定、⌫で解除。設定範囲はタイムラインに青の帯でハイライトされ、ループONなら範囲内でループ再生、OFFなら OUT で自動停止。
- 再生範囲の設定にキーボードショートカット追加：, （Shift無しの＜キー）= IN、. （Shift無しの＞キー）= OUT、X = 範囲解除。Adobe Premiere など動画編集ソフトと同系統の割当て。
- アノテーションウィンドウと REEL のループ再生を既定 ON に変更（従来は既定 OFF）。ボタンで切替可能。
- REEL にも再生範囲（IN/OUT）機能を追加。シーケンス全体（全クリップ連結）のフレーム番号ベースで IN/OUT を指定でき、クリップを跨いだ範囲も可能。＜／＞／⌫ ボタン、キーボード ,／.／X、青帯ハイライト、ループONで範囲ループ・OFFで OUT 停止など動作は fbビューアと統一。ついでにREELプレイヘッドも `f*fw` 基準に統一してタイムラインの目盛りと揃えた。
- タイムラインのプレイヘッドが目盛り・フレーム境界と半フレーム分ズレていたのを修正（`f*fw+fw/2` → `f*fw`）。プレイヘッド・目盛り・範囲マーカーの位置が揃うようになった。

---

## 反映済み beta v0.0.1（2026-07-17）

- パッチノート機能を追加（PATCH_NOTES.md 表示・自動表示なし）
- バージョン表記を beta v0.0.1 から始まる形式に変更
- （それ以前のコミット群は beta v0.0.1 の初回リリース内容として `PATCH_NOTES.md` に集約済み）
