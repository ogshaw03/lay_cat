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

---

## 将来対応（TODO）

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
