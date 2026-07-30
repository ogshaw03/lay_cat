# CLAUDE.md

このリポジトリで作業する際の方針メモ。

## 言語
- ユーザーへの応答・思考・コミットメッセージ・PR は**すべて日本語**（関数名やファイルパスなど固有名詞はそのまま引用可）。

## ファイル役割
- `laycat.html` … Beta（本番）。他ユーザーが利用中。**ユーザーの明示指示があるまで触らない**。
- `laycat_dev.html` … Dev（開発）。**通常の開発コミットはこちらだけ編集**。
- `PATCH_NOTES.md` … 確定パッチノート。Claude から勝手に書かない（ユーザー指示のみ）。
- `UPDATE_LOG.md` … dev コミット単位のログ（後述の 3 セクション構成）。
- `docs/` … 設計メモ。
- アセットは単一 HTML の自己完結性のため **base64 データ URI でインライン埋め込み**。

## APP_VERSION
- Dev（`laycat_dev.html`）は日付ベース `YYYY.MM.DD.NNN`。**dev コミットごとに末尾番号を +1**、日付が変わったら `.001` にリセット。
- Beta（`laycat.html`）は `beta v0.0.X`。**パッチノート更新のタイミングでのみ上げる**。

## Beta 反映（ユーザー明示指示のみ）
1. `laycat_dev.html` を `laycat.html` にコピー（cp）。
2. `laycat.html` の `APP_VERSION` を新しい `beta v0.0.X` に。
3. `PATCH_NOTES.md` に新バージョンを追記（`UPDATE_LOG.md` の未反映から抜粋）。
4. `UPDATE_LOG.md` の未反映を「反映済み beta vX.Y.Z」に移動。
5. `laycat_dev.html` の `APP_VERSION` は日付ベースのまま。

## フォント
- **`Syne` は使わない**（読みづらいため廃止）。新規追加も禁止。
- 標準変数：
  - `--font-head: 'Space Grotesk','Noto Sans JP',sans-serif` … 見出し（太字で "可愛い" ユーザー好み）
  - `--font-body: 'Noto Sans JP',sans-serif` … 本文
  - `--font-code: 'Space Grotesk','Noto Sans JP',sans-serif` … 数値／コード（`font-variant-numeric:tabular-nums` 併用）
  - `--font-ui: system-ui,-apple-system,...,'Noto Sans JP',sans-serif` … 可読性優先の特定箇所のみ
- `--font-ui` は現状 `.fb-title`（アノテ窓の動画タイトル）のみ。**全体を OS フォントに寄せない**（「可愛い雰囲気が消えた」というフィードバック実績あり）。

## UPDATE_LOG.md の 3 セクション構成
1. **未反映（次のパッチノート候補）** … Beta 未反映。新規追加はここに積む。
2. **反映済み・パッチノート記載なし** … Beta 反映済みだが `PATCH_NOTES.md` に載せない項目（バグ修正・運営限定変更など）。
3. **反映済み beta vX.Y.Z** … パッチノート記載済みのアーカイブ。

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
- **main への push はコミットのたびに自動で OK**（Dev/Beta ファイル分離済みなので `laycat_dev.html` 変更は Beta ユーザーに影響しない）。
- ユーザーが「反映しないで」「保留」「main には出さないで」と明示した場合のみ push を止める。
- Beta 反映はユーザーの明示指示のみ。
