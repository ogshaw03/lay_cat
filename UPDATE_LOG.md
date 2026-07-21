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

（現在なし）

---

## 反映済み・パッチノート記載なし（Beta 反映済み・PATCH_NOTES.md 未記載）

- 再生範囲（OUT）到達時のクランプ精度を向上：timeupdate（100〜200ms間隔）ではプレイヘッドが範囲外に1F以上はみ出してからループ/停止していたが、requestAnimationFrame で毎フレーム監視するよう変更し、OUT に到達した瞬間にクランプするように改善（アノテウィンドウ・REEL 両方）。
- 上記の追加バグ修正：ループ再生の2回目以降で監視 rAF が再スケジュールされず、OUT を素通りしていた不具合を修正。ループ時は監視を継続、停止時は監視終了。
- 運営向けメンテナンス中バナー（画面上端のオレンジ帯）を半透明＋クリックスルーに変更。バナー背後の LayCAT UI が見えるようになり、メンテ告知は残しつつ通常操作を邪魔しないように改善。オレンジの濃さは .15 に薄めて背景をより見せる形に。
- プロジェクトデータの保存先として Cloudflare R2（Workers プロキシ経由）を選択できるように準備。新規プロジェクト作成モーダルに「ローカルフォルダ / Cloudflare R2」のラジオを追加し、R2 選択時は Worker エンドポイント URL を入力する形。既存プロジェクトはローカルのまま（併用）。ストレージ抽象化（loadProject/saveProject/putMedia/delMedia/getURL/loadReels/saveReels/delProject）に R2 分岐を追加、`r2:<projectId>|<path>` という新プレフィックスで参照。Firebase ID トークンを Worker に渡して認可。`docs/R2_SETUP.md` と `worker/laycat-r2-api.js` を追加。※ Cloudflare 側のセットアップ（バケット作成・Worker デプロイ）が完了するまでは実利用不可。
- 上記に付随する Worker 修正：`isAllowed` に access.json フォールバックを追加。LayCAT 本体は「access.json → Firestore で上書き」の順で判定するのに Worker 側は Firestore 単体前提だったため、admin メールが access.json 側にしか無い状態で 403 forbidden になっていた不具合を修正。Firestore と access.json の adminEmails/allowedEmails/allowedDomains を合算して判定するように変更。`laynaAccess/invited` の emails マップ形式にも対応。
- **R2 プロジェクト接続 UI を追加**：ホーム画面に「☁ R2 プロジェクトに接続」ボタン。ダイアログにプロジェクトID を入力→Worker 経由で `_access.json` を GET して認可確認→プロジェクトデータを取得して REG に追加。既存のフォルダ接続フローと並列。プロジェクト設定モーダルには R2 プロジェクトの「プロジェクトID 表示＋コピーボタン」「Owner 表示」を追加（招待時にID共有する用）。フォルダ運用プロジェクトには影響なし。APP_VERSION: 2026.07.17.157
- **プロジェクト接続 UI を統合＋R2 プロジェクト一覧タイル表示**：ホーム画面の接続系ボタン2つ（⇄プロジェクトを接続／☁R2プロジェクトに接続）を1つに統合。新モーダル `openConnectModal()` で（1）Worker `/api/r2/mine` から取得した参加可能な R2 プロジェクトをタイル一覧で表示（サムネ・名前・ロールバッジ・接続済みバッジ）（2）ローカルフォルダピッカーボタン。タイルクリックで確認ダイアログ→接続。共通処理を `connectR2ProjectById(pid)` に切り出し。Worker 側に `/api/r2/mine` エンドポイントを追加（バケット全 _access.json を LIST → 自分がメンバーのプロジェクトを列挙）。フォルダ運用への影響なし。※ Worker コード変更のため、再デプロイが必要。APP_VERSION: 2026.07.17.158
- **R2 プロジェクトメンバー方式アクセス制御を実装**（R2 プロジェクトのみ対象・フォルダ運用は影響なし）：
  - Worker：全 R2 操作の前に `projects/<pid>/_access.json` を読み、owner または members に含まれない場合は 403。laynaAccess の adminEmails は常時許可（admin エスカレーション）。_access.json が存在しない場合は初回 PUT のみブートストラップ許可（自分を owner として指定必須）。ACL キャッシュ 30 秒。
  - LayCAT：R2 プロジェクト作成時に作成者を owner に自動セットし _access.json を即 PUT。persist で root.owner/members の変更を検知して _access.json を同期。既存のメンバー管理 UI からの変更も自動的に反映される（persist 経由）。
  - フォルダ運用プロジェクトには一切影響なし（storageBackend==='r2' の分岐で制御）。
  - APP_VERSION: 2026.07.17.156
  - ※ Worker コード変更のため、Cloudflare ダッシュボードで再デプロイが必要。
- **Worker のセキュリティ強化**：（1）ファイルサイズ上限を実装（PUT の content-length で検査、超過は 413 payload-too-large。デフォルト JSON=10MB / メディア=500MB / 絶対上限=2GB、環境変数で上書き可能）。悪意ユーザーによる無料枠枯渇攻撃を防ぐ。（2）監査ログを実装（全リクエストで method/path/email/status/duration を console.log。Cloudflare Workers Logs で追跡可能）。事故発生時の追跡・振り返り用。※ Worker コード変更のため、Cloudflare ダッシュボードで再デプロイが必要。

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
