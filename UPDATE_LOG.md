# LayCAT アップデートログ

このファイルは開発中の全変更を記録するログです。
`PATCH_NOTES.md` はここから取捨選択して更新されます（運用方針は `CLAUDE.md` の「パッチノート運用」を参照）。

---

## 未反映（次のパッチノート候補）

<!-- 以降、コミット単位で `- (short-hash) 日本語要約` を追記していく -->
- アノテーションウィンドウに再生範囲（IN/OUT）機能を追加。＜／＞ボタンで現在フレームを範囲の開始／終了に設定、⌫で解除。設定範囲はタイムラインに青の帯でハイライトされ、ループONなら範囲内でループ再生、OFFなら OUT で自動停止。
- 再生範囲の設定にキーボードショートカット追加：, （Shift無しの＜キー）= IN、. （Shift無しの＞キー）= OUT、X = 範囲解除。Adobe Premiere など動画編集ソフトと同系統の割当て。
- タイムラインのプレイヘッドが目盛り・フレーム境界と半フレーム分ズレていたのを修正（`f*fw+fw/2` → `f*fw`）。プレイヘッド・目盛り・範囲マーカーの位置が揃うようになった。

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

## 反映済み beta v0.0.1（2026-07-17）

- パッチノート機能を追加（PATCH_NOTES.md 表示・自動表示なし）
- バージョン表記を beta v0.0.1 から始まる形式に変更
- （それ以前のコミット群は beta v0.0.1 の初回リリース内容として `PATCH_NOTES.md` に集約済み）
