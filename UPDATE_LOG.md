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
- 監査ログ閲覧 UI を追加：新規 `admin-audit.html`（運営 operatorEmails 登録者のみアクセス可能・管理者でも閲覧不可）で、Worker が Firestore `laynaAudit` コレクションに自動記録した R2 の書込・削除・拒否・エラーイベントを閲覧可能に。フィルタ（日付範囲・メソッド・ステータス・PID・メール・パスの部分一致）と CSV エクスポートに対応。
  - Worker (`worker/laycat-r2-api.js`)：`firestoreCreateDoc(collection, data)` ヘルパを新設し、audit 関数を修正。PUT/POST/DELETE と 4xx/5xx イベントは `laynaAudit` コレクションに `ctx.waitUntil()` で fire-and-forget 書き込み（レスポンスをブロックしない）。GET 200 は console.log のみ（ボリューム抑制）。フィールド：ts / method / path / key / pid / email / ip / ua / status / dur / extra。
  - `access-console.html`：opArea 先頭に「📋 監査ログ」カードを追加。カードは常時表示、ボタン活性は運営（operatorEmails）登録者のみ、それ以外には「未登録のため閲覧不可」の案内文を表示。`admin-audit.html` を新規タブで開く。Firestore rules に `laynaAudit/{docId}` を追加（read=operatorEmails のみ、write=false → Worker の SA でルール bypass 書込）。
  - **監査ログのアクセス権限は「運営（operatorEmails）のみ」に限定**（管理者/adminEmails では閲覧不可）：セキュリティ最優先の設計で、最上位権限だけが監査ログを見られる。
  - Beta 反映前に **Firebase コンソールで Firestore セキュリティルールを更新する必要あり**（access-console 表示のルールに `laynaAudit` セクションが追加されている）。

---

## 反映済み beta v0.0.5（2026-07-23）

### A. EXR 連番シーケンス対応（パッチノート掲載）
- **EXR 連番シーケンス対応（ローカルフォルダ運用のみ）**：`＋ 動画` から複数 EXR を選択すると連番として認識してアップロードできる。命名パターン（`base.001.exr` 等）を自動検出し、同一ベースの連番グループを 1 版にまとめる。混在ファイルやパターン不一致は従来通り 1 件ずつアップ。
  - 実装：`groupExrSequence(files)` で連番判定 → 専用モーダル `openExrSeqUploadModal`（版名／FPS／コメント） → `uploadExrSequence` で全フレームを media/ に保存 → 版データは `type:'exr_seq'` + `frames:[{file,cache,name,frame}]` + `fps` で持つ。
  - R2 プロジェクトでは非対応（トースト警告して個別アップに促す）。
  - タスクページのタイルには紫の `SEQ Nコマ` バッジを表示。
  - レビュー画面に連番再生バーを追加：▶ 再生 / ⏸ 停止（FPS で自動送り・末尾でループ）・±1F ボタン・フレームスライダ・現在フレーム表示。
  - **アップロード時に全フレームの JPEG キャッシュを事前生成**：`thumbnails/<seqId>_<frame>.jpg` として保存し、`frames[i].cache` に参照を持たせる。再生時はキャッシュ JPEG を優先で使用し、EXR 都度パース（数百 ms）を回避（数 ms）。キャッシュが揃うまで進捗バーは「アップロード中」表示のままにして、完了時のトーストにキャッシュ生成成功数（例：`キャッシュ 47/47`）を表示。
  - オンメモリキャッシュも継続（LRU 60 フレーム）：一度取得した URL を短期記憶して再スライド時のフレッシュ取得を省略。
  - 削除時は各フレームの実 EXR とキャッシュ JPEG の両方を `storage.delMedia` で除去。
- **EXR 連番のレビュー画面 UI を mp4 と統一**：独自の下部スライダを廃止し、video で使っているタイムライン（canvas 版・フレーム目盛り・IN/OUT 範囲マーカー・プレイヘッド）と同じ UI をそのまま使うよう統合。プレイ／−1F／＋1F／ループ／IN／OUT／解除／fps セレクタ／タイムラインスクラブ すべて mp4 と同じ操作で使えるようになる。実装は `isPlayable = isVideo || isSeq` として `curFrame`/`dispFrame`/`seekRT`/`setupDuration`/`drawTimeline` を seq 対応、seq の再生は setInterval で FPS 毎にフレーム送り。範囲設定＆ループも video と同じ挙動。
- **EXR 連番のレイヤー切替が再生後に beauty に戻る不具合を修正**：`drawTo(layer)` が seq の場合は `v.exrView.layer/exposure/gamma/depth` を更新した上で `renderSeqFrame(seqFrame)` に委譲するよう修正。フレームごとに `getExrParsed` → `drawLayerToCanvas` で選択レイヤーを描画するので、レイヤー切替 → 再生してもそのレイヤーで再生し続ける。
- **EXR 連番のキャッシュ戦略を「アップロード時全 F 保存」から「再生時 1F 先だけプリフェッチ」に変更**：Adobe After Effects の RAM プレビューに近い方式。`uploadExrSequence` は EXR 実体保存のみに簡素化（アップ時間短縮）。`renderSeqFrame` は描画時に非同期でメモリキャッシュ（LRU 60 F）に格納し、成功時に 1F 先を `noPrefetch:true` でプリフェッチ（連鎖しない）。キャッシュキーにレイヤー・露出・ガンマ・depth を含めるので、設定変更で正しくキャッシュ無効化される。
- **EXR 連番タイムラインにキャッシュ済みフレームの青ライン表示を追加**（REEL 準拠）。`drawTimeline` に seq 用の下段 1.5px 青ラインを追加し、現在の表示設定でキャッシュ済みのフレームだけ塗る。`renderSeqFrame` の成功時に `drawTimeline` を呼び直して即座に更新。レイヤー切替や露出/ガンマ変更でキャッシュが無効化されると自動的にラインが消える。
- **EXR 連番のショートカットキー（Space / ← → / , . / X）を有効化**。`onKey` および `fbKeyUpSpin` のガードが `isVideo` に固定されていて seq では効かなかったのを `isPlayable = isVideo || isSeq` に変更。
- **EXR 連番のスクラブ中は 1F 先プリフェッチをスキップ**。`renderSeqFrame` のプリフェッチ条件を `!ropts.noPrefetch && !scrubbing` に変更し、スクラブ中に非同期の EXR パース＋描画が JS スレッドを取り合うのを防ぐ。ドロップ時（`onpointerup`）で `scrubbing=false` 後の再呼び出しで通常通りプリフェッチが走る。
- **EXR 連番：任意で「🎞 全キャッシュ」ボタンを追加**（アノテウィンドウ上部）。旧「🖼 サムネ更新」ボタンはレビュー画面から撤去。現在のレイヤー・露出・ガンマ設定で全フレームを順次デコードしてメモリキャッシュに投入。処理中は「キャッシュ中 N/M（クリックで中断）」表示、もう一度クリックで中断可能。LRU 上限（通常 60 F）は「全キャッシュ」実行時のみ `frames.length` に一時拡張されるので、全部溜まる。完了後は再生・スクラブが完全に途切れなく動く（AE の "Fully Cached" 相当）。

### B. 同時編集リスク低減 Phase 1/2/3（パッチノート掲載）
- **同時編集リスク低減 Phase 1：サブミット JSON 分割保存**を実装。従来 `project.json` 内の `submits[]` 配列に全サブミットを詰めていた構造を、`submits/<subId>.json` の個別ファイル + `project.json.submitIds`（ID インデックス）に分割。別々のサブミットを並行編集しても衝突しなくなる。実装：`storage.loadSubmit / saveSubmit / delSubmit / loadAllSubmits`、暗号化封筒 `encryptSubmit / decryptSubmit`、保存時分割ヘルパー `saveProjectSplit`（変更検知＝`_saveCache.submit[pid][sid]`）、ロード時 hydrate（`_hydrateSubmits`）を追加。旧形式（`submits[]` 生データ）は次回保存で自動的に分割形式へ移行。R2 は Worker の `/purge` でまとめて掃除、フォルダは delProject 時に `submits/` ディレクトリを再帰削除。
- **同時編集リスク低減 Phase 2：ショット JSON 分割保存**を実装。ショット単位（＝プロジェクトルート以外の `type='section'` で子が全て `review` のノード）で `shots/<shotId>.json` に「ショット本体 + 配下の全タスク」のフルデータを格納、`project.json` は骨格のみ（`nodes` は `versions/comments/_vtomb` を抜いた軽量版 + `shotIds` インデックス）に。別々のショットを並行編集しても衝突しなくなる。実装：`storage.loadShot / saveShot / delShot / loadAllShots`、`encryptShot / decryptShot`、`_isShotNodeForSave` / `_skeletonNode` ヘルパー、`saveProjectSplit` にショット分割を統合、`_hydrateShots` で並列ロード → nodes[] に Object.assign で復元。v:4 マーカーで新形式判定、v<4 のプロジェクトは boot 時に検出して初回移行モーダル `offerPhase2Migration` を表示（ユーザーが「移行を実行」→ persist で全プロジェクト再保存 → 自動分割）。delProject 時に `shots/` ディレクトリも掃除。
- **同時編集リスク低減 Phase 3：ショット／サブミット単位の楽観ロック（_rev）＋ 3-way マージ**を実装。同じショットを 2 人が同時に編集しても、保存直前にリモートを再読して `_rev` が進んでいたらファイル単位でマージし双方の追記（版・アノテ・コメント・工程追加）を保持。実装：`_loadedRev[pid]` に `{project, shots:{sid:rev}, submits:{sid:rev}}` を保持、`_hydrateShots/_hydrateSubmits/loadProject` がロード時に `_rev` を bucket に記録（`readProjectData` からの再読では上書きしないよう `recordRev:false` オプション付き）、`_saveShotWithLock/_saveSubmitWithLock` が保存直前に `loadShot/loadSubmit` で再読 → `remoteRev>knownRev` なら `_mergeShotFileInto/_mergeSubmitInto` で union し `_applyShotFileIntoDB/_applySubmitFileIntoDB` で DB にも反映してから書き込み → `_rev` を +1。`saveShot/saveSubmit/saveProject` を修正して暗号化封筒の外側に `_rev` を露出（次回起動時に読める）。同時に **Issue A**（暗号化プロジェクト解錠時にショット/サブミット個別ファイルがハイドレートされず版・コメントが空に見える不具合）と **Issue I**（暗号化かつ旧形式 v<4 のプロジェクトが分割移行モーダルに載らない不具合）を修正：`renderProjectLock` の submit で `decryptProject` 成功後に `_hydrateShots/_hydrateSubmits` を呼び、`res.data.v<4` なら `_migrationNeeded` に追加して `offerPhase2Migration()` を起動。マージが発生した保存には「ほかの人の更新をショット/サブミット単位で取り込みました」トーストを表示。
- **同時編集リスク低減 Phase 3 Issue C：baseline チェック軽量化**。`storage.readProjectData(id,{skeletonOnly:true})` オプションを追加し、v:4（Phase 3 楽観ロック済み）プロジェクトの persist 内 baseline チェックでは shots/submits の並列ハイドレートをスキップして骨格 project.json のみ読み込む経路に切替。他者が追加した骨格ノードのみ `_unionSkeletonIntoDB` で DB に取り込み、既存ノードの版・アノテ・コメントは shots 単位の楽観ロックが吸収するので触らない。10 プロジェクト × 30 ショットのケースで persist 毎の I/O が「300 ファイル並列読込」→「10 ファイル」に削減される。v<4（未移行）プロジェクトは従来通りフル 3-way マージ経路。

---

## 反映済み beta v0.0.4

- タスクタブがブラウザリロードで消える不具合を修正。ハッシュ復元経路でも `openTasks` / `expanded` を localStorage から復元、URL の対象がタスクなら自動でタブに追加。加えて未解決 ID（暗号化解錠前・R2 非同期取り込み中）を `state.openTasks` から破壊的に削除しないよう堅牢化。close ボタンと「すべて閉じる」も表示中タブのみを対象。
- mp4 動画アップロード直後のコーデック警告オーバーレイ誤表示を根本対処。`uploadVersion` 内で元 File／サムネ Blob からその場で blob URL を作って `storage.urlCache` に投入。renderBody / openReview（FB オーバーレイ）で同期 src 設定。ローカル・R2 どちらの運用でも一瞬フラッシュも起きない。1.2s 遅延と canplay での自動 clearBadge も併設。

---

## 反映済み・パッチノート記載なし（Beta 反映済み・PATCH_NOTES.md 未記載）

- **【2026-07-24 Beta v0.0.5 再反映（バグ修正＋UX 小改善のみ・バージョン据え置き）】** 以下は laycat_dev.html → laycat.html にコピー済みだが PATCH_NOTES.md には記載せず beta v0.0.5 のまま：
  - **REEL の下部クリップ帯に各クリップのサムネイル画像を表示するよう追加**。各 `.clip` ブロックの上部に `.cth` サムネ枠（`v.thumb`／`node.thumbnail` 由来）を差し込み、`.track` の min-height を 96px に拡張。サムネは `background-size: contain` で枠内に全体表示（はみ出しなし）。
  - **REEL の再生範囲（IN/OUT）を動くように修正**：再生中に IN/OUT を設定した場合に監視ループを即時起動、クリップ末尾で range OUT を跨がないよう `ended` ハンドラで判定、ループ時にクリップを跨ぐ範囲でも再生が継続するよう明示的に `play()` を再発火、`tick()` ループでも毎フレーム冗長チェック（単体 rAF ウォッチャーの取りこぼしを吸収）。
  - **「クリア」ボタンの動作を変更**：全アノテ削除 → 現在フレームのアノテのみクリアに（他フレームの未送信内容は保持）。通常アノテウィンドウ・REEL の両方に適用。
  - **矢印↑↓ でアノテ／コメントが付いているフレーム間ジャンプ**のショートカットを追加（↑=次、↓=前）。通常アノテウィンドウは版内のフレーム、REEL は全クリップを通したグローバルフレームで動作。
  - **動画初回再生時にタブミュート解除案内トースト**を表示（ページ読み込みごと 1 回）：「音が出ないときは、タブを右クリック →「サイトのミュートを解除」でオンにできます」。ブラウザ側からタブミュートの解除は不可能なため案内のみ。REEL popup と main window の両方に同時表示できる `toastIn(doc,msg,ms)` ヘルパを新設。

- **【2026-07-23 Beta v0.0.5 反映 まとめ】** 以下の項目は beta v0.0.5 で反映済みだが PATCH_NOTES.md には記載しない：
  - **アノテウィンドウが開かなくなる不具合を修正**：`isSeq` / `isPlayable` の宣言が openReview 関数内で使用箇所より後方にあり、TDZ（Temporal Dead Zone）で ReferenceError を発生させてウィンドウ全体が開けなくなっていた。宣言を関数冒頭（`isVideo` の直後）に移動して修正。
  - **Slack Incoming Webhook 通知（実験的）を廃止**：ユーザー判断で撤去。プロジェクト設定の Slack Webhook URL 入力欄・テスト送信ボタン、`notifySlackUpload` 関数、`uploadVersion` / `uploadExrSequence` の呼び出し、`slackWebhookRow` 変数を全て削除。既に保存済みの `root.slackWebhook` フィールドはプロジェクト JSON に残るが、参照するコードが無いので実害なし（次回書き出しで整理したい場合は別途 migration）。
  - **プロジェクト作成直後にメンバー登録を強く促すダイアログを追加**：新規プロジェクト作成完了直後に「先にメンバーを登録」モーダルを自動表示（[あとで]／[👥 メンバー管理を開く]）。R2 の場合は「R2 プロジェクトはメンバーに追加した人だけがアクセス可能」、フォルダの場合は「担当割り当て・＠メンション・通知はメンバー名簿を元に動きます」と状況に応じたメッセージ。プロジェクト設定モーダルの⑨プロジェクトメンバーセクションでも、メンバーが 0 件 or 自分だけの状態のときに黄色い警告バナー（⚠️）を出して再訪時にも忘れないようにする。「未登録だと他の人はこのプロジェクトに参加できません」を明示。guide.html STEP 2 にも同趣旨の warn を追加。
  - **プロジェクト設定と工程テンプレート機能を分離**：モーダルタイトルをプロジェクトルートの場合のみ「プロジェクト設定」に、それ以外は「アイテムの設定」に分岐。工程テンプレートを `stageTemplates=[{id,name,stages[]}]` の複数持ちに拡張（テンプレートA/B/…）、カテゴリのアイテム設定と「＋ アイテムを追加」モーダルにプルダウン＋「このテンプレートを適用」ボタンを追加。既存 `root.stages` は `projectStageTemplates` ヘルパーで「テンプレートA」として遅延移行。
  - **プロジェクト設定モーダルを 11 セクションに整理**（何の設定かひと目でわかるように）。番号付き見出し（`.settings-section`）と絵文字アイコン、補足文（`.settings-help`）で整理：①基本情報／②工程テンプレート／③プロジェクトサムネイル／④プロジェクトの進行状況／⑤ステータス定義／⑥工程バッジの色／⑦進捗表示の起点フォルダ／⑧データの保存先／⑨プロジェクトメンバー／⑩パスワード保護／⑪危険な操作。メンバー管理ボタンを「👥 メンバー管理を開く」に文言変更＋ primary スタイルに昇格。
  - **はじめ方ガイド（`guide.html`）に プロジェクト設定 STEP 13 を追加**。STEP 2「＋ 新規プロジェクト」から `#projset` へのジャンプリンクを設置、STEP 13 では設定モーダルとメンバー管理ウィンドウの実スクショ付きで、工程テンプレート／ステータス定義／メンバー管理／その他（サムネ・保存先・パスワード・削除）を順に解説。縦長スクショはセクション別に切り分け（`guide_proj_tpl.png` / `guide_proj_status.png` / `guide_proj_members.png`）。
  - **はじめ方ガイド（`guide.html`）に REEL とサブミットの詳細ステップを追加**、また STEP 5「動画をアップロード」に **ドラッグ&ドロップでも追加可能**（複数ファイル・EXR 連番も対応）である旨を追記。STEP 5 → `#submit` / STEP 6 → `#reel` のジャンプリンクを設置。STEP 11（REEL）／STEP 12（サブミット）を新規追加。STEP 4 に「＋ アイテムを追加」時のテンプレート適用プルダウン説明を追加。ガイド全体の文字数を大幅圧縮。
  - **LP（`intro.html`）から GitHub リンクを削除**。FINAL CTA の「GitHub」ボタンを「はじめ方ガイド」ボタンに置換、フッターの `github.com/ogshaw03/lay_cat` リンクも削除。「単一 HTML」表記も削除、hero desc から特定ツール名（Nuke/ShotGrid）を除去。「他のツールには無い機能」セクションに「📁 フォルダ運用」「🎞 まとめ再生（REEL⇄タスク双方向反映）」の 2 ブロックを追加。
  - **ホーム画面ヘッダのアカウントアイコン左に「📖 はじめ方ガイド」ボタンを追加**：ホーム画面時のみ表示、guide.html を新規タブで開く。intro.html / guide.html の nav 左上ロゴを `laycat_icon.png` 単独表示に整理（テキスト重複解消）。

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
  - 初回作成：`_access.json` が無い場合のみ「新規作成」扱いで PUT を許可(作成者が自動 owner)
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
