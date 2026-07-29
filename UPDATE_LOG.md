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
- (dev v2026.07.29.004) サブミット作成 → ショット選択 UI を縦並び行表示に刷新
  - 旧：16:9 大サムネのタイルグリッド（サムネクリック→工程チップ展開→工程クリックで選択の 2 段階操作）でスクロール量が大きかった。
  - 新：進捗の縦並び (`.shot-row` 相当) と同じ密度の 1 行表示。行内に工程チップ（工程色ドット付き）を最初から横並びで表示し、1 クリックで即選択。
  - CSS: `.pk-list` / `.pk-row` / `.pk-th` / `.pk-nm` / `.pk-stages` / `.pk-chip`（工程色ドット `.pk-dot` 付き）を新設。旧 `.pk-grid` / `.pk-shot` は撤去。
  - EP 区切りやメンバー絞り込みなど既存機能は据え置き。

- (dev v2026.07.29.003) サブミット一覧：サムネイル下のカット番号バッジを読みやすく（9.5px→11.5px, weight 600, --text3→--text2）。

- (dev v2026.07.29.002) サブミットタブ：サムネイル下にカット番号（ショット名）バッジを表示
  - `.subl-item .thumbs` のセルを `.tc` container（flex column）にラップし、`.th`（サムネイル）＋ `.tc-lbl`（ショット名）を縦並びで表示。
  - ショット名が無い場合は工程名でフォールバック。省略時は ellipsis で切って `title` にフル文字列。
  - サブミット作成モーダルの一覧側 (`subShowList`) にも同じ変更を適用（一貫性）。

- (dev v2026.07.29.001) サブミットタブ：誰が提出したかバッジを表示
  - サブミット一覧タイル（renderProjSubmits）と右スライドドロワー（fillSubmitDrawer）に「提出」バッジを追加。`sb.byEmail` 優先で名簿引きし、メンバーカラーのドット + 名前を表示。
  - CSS に `.mp-badge.mp-s`（青系）を追加。既存の作業／チェックバッジ（緑・アンバー）と同じ視覚言語で並ぶ。

- (dev v2026.07.28.028) タスクタブ並べ替え：孤児コード掃除
  - `.task-tab.dragging` CSS ルールを撤去（`.dragging-collapse` の `opacity:0!important` で完全に打ち消されていた dead code）。
  - `tab.classList.add/remove('dragging','dragging-collapse')` を `('dragging-collapse')` 単独に簡略化。
  - CSS コメントから旧 HTML5 D&D 時代の「drag image 生成のため」「setTimeout 経由」記述を撤去。

- (dev v2026.07.28.027) タスクタブ並べ替え：判定ルールを「隣タブの端」に再変更
  - v026 で「visible → openTasks index 変換」の根本修正が入って左飛び現象は解消したので、v023 で試した「端」ルール（少しでも隣タブに乗った時点でスワップ）を再導入。
  - 中央ルール（v025）より反応が良く操作感が軽い。ヒステリシスは狭いが、v026 の変換修正でドロップ位置自体は正しくなるので実害なし。

- (dev v2026.07.28.026) タスクタブ並べ替え：別プロジェクトのタブが混ざったときのドロップ位置ズレ（＝EP01 が最左に飛ぶ現象）の根本修正
  - `state.openTasks` は全プロジェクトのタブを保持するが、`dragCtx.insertIdx` は現プロジェクトの visible index。それを直接 splice していたため、別プロジェクトのタブが openTasks に混ざっていると位置がズレ、EP01 を EP2 と入れ替えるつもりが最左に飛ぶ現象になっていた。
  - visible index → openTasks index に変換してから splice するように修正。`insertIdx==0` なら現プロジェクト先頭タブの直前、それ以外なら `visWithout[vi-1]` の直後に挿入する。他プロジェクトのタブは元の位置に据え置き。

- (dev v2026.07.28.025) タスクタブ並べ替え：判定ルールを v022（中央 vs 中央）に戻す
  - v023 の「端」ルールはヒステリシスが数 px しかなく、ドロップ位置が不安定（EP1 を EP2 と入れ替えるつもりが最左に飛ぶなど）になっていたため撤回。
  - v022 の「ゴースト中央が視覚上の隣タブの中央を跨いだらスワップ」ルールに戻す。ヒステリシスが約 1 タブ幅で効いて安定する。

- (dev v2026.07.28.024) タスクタブ並べ替え：ゴーストが画面 top-left に飛ぶ現象への防御コード
  - `dr = rects[draggedIdx]` が undefined になるケース（tabs.indexOf(tab) が -1 を返す render 差し替え中など）に備えて、`draggedIdx<0` で早期リターン。undefined 参照 → `undefined+'px'` → CSS 無視 → ゴーストが (0,0) に描画される問題を防ぐ。
  - ゴースト生成時に `tab.getBoundingClientRect()` を再取得してその位置に浮かせるように変更。pointerdown 時に測った dr が古くなっていても正しい位置から浮かぶ。

- (dev v2026.07.28.023) タスクタブ並べ替え：閾値を「隣タブの端」に変更（少し乗った時点でスワップ）
  - v022 の「中央同士がすれ違ったらスワップ」を、「ゴースト中央が隣タブの端を跨いだらスワップ」に変更。
  - 右方向は 1 つ右のタブの LEFT エッジ、左方向は 1 つ左のタブの RIGHT エッジが閾値。ゴーストが少しでも隣タブに乗った時点で切り替わるようになり、操作感が軽くなる。
  - `visualMidAt` を `visualRectAt` に変更し `{left, right}` を返すヘルパーに。

- (dev v2026.07.28.022) タスクタブ並べ替え：判定ルールを「中央同士がすれ違ったらスワップ」に統一（左ずれ解消）
  - v017〜v021 で色々試したがどれもズレるパターンが残っていたため、判定を「ゴースト中央が視覚上の隣タブの中央を跨いだらスワップ」ルールに変更。ヒステリシスが自然に効いて、ゴーストがまだ隣タブの中央を越えていないうちは元位置に戻らない。
  - `visualMidAt(p, K)`：現在の K 状態で reorder 位置 p にあるタブの視覚 mid を返す。K++ 判定は 1 つ右のタブの視覚 mid、K-- 判定は 1 つ左のタブの視覚 mid と比較する `while` ループ。
  - v021 の「視覚用と実位置用の 2 系統分離」は撤去。1 系統に統一したので、視覚上ゴーストが乗っている位置がそのまま実挿入位置になり「左ずれ」自体が発生しなくなる。

- (dev v2026.07.28.021) タスクタブ並べ替え：見た目と実位置の判定ロジックを分離
  - v017〜v020 で色々試したが可変幅タブの境界計算に完璧を期しても常にズレるケースが残るため、視覚のスライド（applyShift 用の insertIdx）と実際のドロップ位置を切り離す。
  - **視覚用の insertIdx**: 現状の Chrome 準拠「reorder 時の ghost 中央中点」ロジックを維持（applyShift 用）。
  - **実位置用の insertIdx**: onEnd 内で改めて「ghost 中央 vs 元 rects[i].mid」のシンプルなルールで再計算する。DOM 順に見て ghost 中央が元 mid より左になった最初のタブ、その compact index が挿入位置。視覚とわずかに食い違うことがあっても、常に「ゴーストが乗ってるタブより左に入る」と予測可能に。

- (dev v2026.07.28.020) タスクタブ並べ替え：可変幅タブでもドロップ位置が正確になるよう境界計算を修正
  - v019 の `(mids[k]+mids[k+1])/2` は uniform 幅前提で、dragged タブが他より広い/狭い場合に境界がずれて、特に幅の広いタブが「右→左」以外の並べ替えで 1 スロット左に落ちる現象になっていた。
  - 境界を「reorder 時の slot K の ghost 中央の中点」= `L(K) + w_dragged/2 + (compactW[K]+g)/2` に変更。dragged 自身の幅と compact 側の幅を使って正確に計算するので、可変幅でも Chrome と同じ「隣タブの半分に乗ったらスワップ」感覚が成立する。

- (dev v2026.07.28.019) タスクタブ並べ替え：ドロップ位置が常に 1 スロット左にずれる不具合を修正（境界を Chrome 準拠に）
  - v018 で「元 rects の mid」を境界にしたが、それだと**ゴーストが隣タブを完全に覆うまで**スワップが起きず、ユーザー感覚（半分オーバーラップでスワップ = Chrome 準拠）と常に半タブ分ずれていた。
  - 境界を「隣り合う slot 中央の中点」= `(mids[k] + mids[k+1])/2` に変更。uniform 幅前提で slot K の中央 = `rects[K].mid`（K=draggedIdx 含む）なので、ゴーストが隣タブの半分に乗った時点でスワップが起きる。

- (dev v2026.07.28.018) タスクタブ並べ替え：ドラッグ開始直後に右側タブが急激にスライドする不具合を再修正
  - insertIdx 判定基準を「compact 化された座標の mid」から「元の rects の mid」に変更。
  - applyShift の初期状態は `+dw` を戻して視覚上は元の並びを維持しているのに、判定側は compact 座標（flexbox 詰め後の座標）と比較していたため、ゴーストが元位置から数ピクセル動くだけで隣タブの compact mid を跨いでしまい右側が急激にシフトしていた。
  - 元の rects の mid を境界に使うことで、視覚位置と挿入判定が一致し、正しくゴーストが隣タブの元位置を越えた時点でシフトが起きるようになった。

- (dev v2026.07.28.017) タスクタブ並べ替え：ドロップ位置が思っていた場所より左に入る不具合を修正
  - `insertIdx` の計算にカーソル X (`e.clientX`) を使っていたため、タブの右寄りを掴んだ場合 `offsetX` が大きくなり、視覚上ゴーストがまだ左に居るのに挿入位置が右へ進んで「思ってた場所より左に入る」現象になっていた。
  - 判定基準を「ゴーストの中央 X」= `e.clientX - offsetX + width/2` に変更。掴んだ位置に依らず、視覚的なゴーストの中央が他タブの中央線を越えたところで挿入位置が変わるようになった。

- (dev v2026.07.28.016) タスクタブ：クリックで切り替わらないことが結構ある不具合を修正
  - v015 で追加したドラッグ終了時の `stopClick`（1回限りの click 抑止リスナー）が、`render()` で古いタブ要素が DOM から外れると click が発火せず居残り、次の別タブへのクリックを食べてしまっていた。
  - `setTimeout(remove, 250)` で必ず解除する保険を追加。ドラッグ由来の click は 250ms 以内に来るので誤動作しない。

- (dev v2026.07.28.015) タスクタブ並べ替え：HTML5 D&D をやめて pointer events で書き直し（🚫 チカチカを根本解決）
  - v012〜v014 で試したどの手を打っても、HTML5 D&D 仕様上 dragstart → 最初の dragover が preventDefault されるまでの数フレーム、ブラウザが標準の「ドロップ不可」カーソル (🚫 / 点線四角) を必ず一瞬描いてしまうことが判明。
  - `tab.draggable=true` + dragstart/dragover/drop/dragend/dragleave の HTML5 D&D 実装を全撤去し、`pointerdown`/`pointermove`/`pointerup`/`pointercancel` の pointer events で自前実装に置き換え。ブラウザは一切ゴーストもカーソルも描かず、我々の ghost 要素と `document.body.style.cursor='grabbing'` だけで完結する。
  - 5px 移動しきい値でクリックとドラッグを区別。ドラッグ終了直後の click イベントは 1 回だけ capture フェーズで抑止して誤アクティブ化を防止。

- (dev v2026.07.28.014) タスクタブ並べ替え：🚫/点線四角の三度目の修正（ゴースト画像と strip dragover 両方）
  - `setDragImage(new Image(data:URL))` は dragstart 時に画像がロード完了していない場合ブラウザが「ソースタブそのもの」をフォールバックゴーストにしてしまい、薄い枠付きのタブがマウスに追従して見えていた。
  - オフスクリーンの `<div>` (1x1, opacity 0, position:fixed で -9999px) を DOM に付けてから `setDragImage` に渡す方式に変更（ロード待ちなしで確実に「見えないゴースト」を成立させる）。
  - strip 側の dragover にも残っていた `types.includes('application/x-laycat-tab')` 判定を撤去し、`dragCtx` の有無だけで判定するように統一。

- (dev v2026.07.28.013) タスクタブ並べ替え：🚫 カーソル問題の再修正（判定を dragCtx ベースに）
  - v012 では document dragover/drop で `dataTransfer.types.includes('application/x-laycat-tab')` を判定していたが、一部ブラウザ（Chromium 系のセキュリティ制限）では dragover 中に custom MIME 型が types に現れないため preventDefault が呼ばれず 🚫 が残っていた。
  - 判定を「`dragCtx` が set されているか」に変更。dragCtx はタブ D&D 中しか生きないので、これ自体が「タブ D&D 中」の判定として機能する。

- (dev v2026.07.28.012) タスクタブ並べ替え：ドラッグ中にカーソルに 🚫 や点線四角が出るのを修正
  - strip 外に出ると誰も `preventDefault()` を呼ばないため、ブラウザ標準の「ドロップ不可」カーソルが出ていた。
  - document レベルの `dragover` で、タブ D&D 種別（`application/x-laycat-tab`）を検知して `preventDefault()` + `dropEffect='move'` を呼ぶよう変更。実際に strip 外で drop された場合は同じく document レベルの `drop` が preventDefault だけ返して「何もしない = キャンセル」を実現。
  - ゴースト非表示用の setDragImage を空 canvas から 1x1 透明 GIF (base64) に変更。空 canvas は一部ブラウザで小さな枠として見えていた。

- (dev v2026.07.28.011) タスクタブ並べ替え：ドラッグ中に上下も動いてしまうのを左右だけに固定
  - ブラウザ標準のドラッグゴーストは 2D 自由に動くのでカーソルに合わせて上下追従してしまっていた。
  - `dataTransfer.setDragImage()` に 1x1 の透明キャンバスを渡して標準ゴーストを非表示化。代わりに dragged タブのクローンを `body` 直下に `position:fixed` で配置し、`top` は strip の Y に固定・`left` のみカーソル X に追従で更新する独自プレビューを表示（Chrome タブと同じ挙動）。
  - `document` レベルで dragover を捕捉し ghost.left を更新。dragend / drop 両方で ghost とリスナーを解放。

- (dev v2026.07.28.010) タスクタブを D&D した際に「動画・画像ファイルをドロップしてください」トーストが出る不具合を修正
  - window レベルの `dragover`/`drop` は `dropCtx()` で判定していたが、`dropCtx` に「Files 種別しか受けない」チェックが無かったため、タブ D&D（`application/x-laycat-tab`）でも `preventDefault` → drop 到達 → files.length=0 → 無関係なトースト発火。
  - `dropCtx` 内で `dataTransfer.types` に `'Files'` が含まれない D&D を早期リターンして無視するように修正。

- (dev v2026.07.28.009) タスクタブ並べ替え：一番左のタブをドラッグ開始した瞬間に右側タブが動く不具合を修正
  - v008 では初期 `applyShift(draggedIdx)` にも 200ms transition が付いていたため、`.dragging-collapse` で flexbox が瞬時に詰めた直後、右側タブが「詰まった位置 → 元位置 (+dw)」へアニメーションしてしまっていた。
  - `applyShift(insertIdx, animate=true)` に `animate` 引数を追加。dragstart の初期スナップだけ `animate=false` を渡して transition なしで即座に配置する。以降の dragover での更新は従来通りアニメーション付き。

- (dev v2026.07.28.008) タスクタブ並べ替え：ドラッグ中の半透明タブが他タブと重なる不具合を修正
  - v007 では dragged タブが opacity 0.35 のまま元スロットに残っていたため、他タブが shift でその上に重なってしまい「重なって見づらい／半透明のタブが残っている」状態だった。
  - 修正：dragstart 直後（`setTimeout(0)` で drag image 生成後）に `.dragging-collapse` クラスを付与して dragged タブの幅を 0 に潰す。flexbox が他タブを自然に詰めるので、その上に compact index ベースの `translateX(+dw)` を重ねて挿入プレビューを実現。
  - `applyShift` / dragover / drop のロジックを compact 配列（dragged を除いた並び）基準に統一。挿入位置 `insertIdx` はそのまま `state.openTasks.splice` に使えるように単純化（従来の `insertIdx--` 調整を撤去）。

- (dev v2026.07.28.007) タスクタブ並べ替え：ドラッグ中もリアルタイムに他タブがスライドするよう改良
  - v006 の FLIP アニメは drop 後のみだったが、Chrome のタブと同じく **ドラッグしている最中に他タブがスライドして道を開ける** 挙動に変更。
  - dragstart で全タブの初期位置をスナップショット (`dragCtx`)。strip 全体で dragover を捕捉して、カーソル X 位置から挿入位置 `insertIdx` を再計算。挿入位置が変わったら各タブに `translateX(±dw)` を `transform 200ms` transition 付きで適用。
  - dragged 前のタブ：新挿入位置以降なら右へ、それ未満なら 0。dragged 後のタブ：新挿入位置未満（compact 済み index）なら左へ、それ以上なら 0（一度左に詰めてから右へ戻る差分がキャンセル）。
  - drop で `state.openTasks` を並べ替えて render。他タブは既に visual final position に居るのでスナップは起きない。dragleave で strip 外に出たら shift をリセット。

- (dev v2026.07.28.006) タスクタブ並べ替えに Chrome 風 FLIP アニメーション追加
  - drop 時に「並べ替え前の各タブ位置を記録 → render → 新位置との差分を translateX で逆補正 → 次フレームで transition ON にして 0 まで戻す」FLIP パターン。
  - `transform 240ms cubic-bezier(0.25,0.8,0.3,1)` で自然なスライド。`transitionend` で inline style を掃除。

- (dev v2026.07.28.005) タスクタブを D&D で並べ替え可能に
  - HTML5 D&D API で各 `.task-tab` を draggable 化。`dataTransfer` に `application/x-laycat-tab` として元 id を積み、dragover でマウス X 位置から前/後を判定してタブに `drop-before`/`drop-after` ライン（3px の accent 色）を表示、drop で `state.openTasks` 配列を並べ替えて `render();syncHash()`。
  - openTasks は既に localStorage 永続化されているので、リロード後も並び順が保持される。
  - タブ内 `.tt-close` ボタンに `stopPropagation` はあるので、閉じるボタンをドラッグしても親タブの D&D は発火しない設計。



---

## 反映済み beta v0.0.6（2026-07-28）

### A. 3D マネキン刷新（パッチノート掲載）
GLB モデル差し替え／Maya 準拠カメラ／複数選択マニピュレータ／Two-bone IK＋ポールベクター／腕・脚別 IK トグル／IK コントローラー統合（W/E で位置＋姿勢）／腰移動時の足接地維持／F=選択に寄る／ギズモサイズ ± ／自由回転範囲拡大 など、`mannequin_3d.html` の主要機能を一新。

### B. アノテ／コメント UX 改善（パッチノート掲載）
ペン／消しゴム別ボタン化＋アイコン化、投げ縄／範囲選択、シェイプ（四角／丸／矢印）、担当バッジ、工程順序表示、描画＋コメントを 1 ノートに集約、コメントログにスクショサムネ表示、送信の体感速度改善、コメント編集フィールド位置修正、UI 内 D&D 誤動作防止、空白クリック解除／矩形選択。

### C. 内部安定性・バグ修正（パッチノートには記載なし）
以下は Beta には反映済みだが `PATCH_NOTES.md` には記載しない：
- **JSON 読み込みタイミング整合強化**（v036/v037）：3-way マージの `_mergeShotFile3` 追加、`_saveShotWithLock` に楽観ロック baseline、`refreshFromFolders` 後の rev 同期、`_applyShotFileIntoDB` の `_deepMergeInPlace` 化（Object.assign で外部参照が孤児化する不具合修正）、削除同期での baseline ガード。
- **3D マネキン中間トライアル**：v041-v043 のスケール計算調整（Box3 ベース → ボーンベース）、v053-v056 のランタイム正中線試作→撤去（テクスチャ方式に切替待ち）、v052 の複数選択 2 回目大回転修正、v047 の IK apply でキャラ増殖修正＋URL に APP_VERSION 付与でキャッシュ破棄、v059 の IK ポール方向 kind ベース補正（肘が前に折れる不具合修正）。
- **intro.html に 3D マネキン紹介セクション追加**：顔の向きガイドの次、および「他のツールには無い」セクションに 3D ポーズ diff-block 追加。

### D. 詳細な dev コミット履歴（参考）
<details>
<summary>dev v2026.07.24.023 〜 v2026.07.24.065 の詳細（クリックで展開）</summary>

- (intro) 3D マネキン紹介セクションを intro.html に追加
  - 顔の向きガイドの次に「ポーズは、3D マネキンで指示。」セクションを新設。IK ハンドルでポーズを作ったスクショ (`mann_intro_ik.png`) を掲載。既存 feature-row の左右交互パターンを維持するため、以降のセクション（Shots View / Progress / Cloud / Review Queue / Reel）の reverse を全て反転。

- (dev v2026.07.24.065) 3D マネキン：IK コントローラーで移動＋回転を統合／tip 関節ボールの重複解消
  - **症状**：IK ON 中も手首・足首の位置に FK 用の関節ボール（joint proxy）と IK ハンドル（■）が重なって表示され、どちらをつかむべきか分かりづらかった。また IK ハンドルは translate 専用で、手首/足首の姿勢を変えるには一旦 IK OFF にして FK 回転する必要があった。
  - **修正**：
    - IK ON にした kind の tip ボーン (`leftHand` / `rightHand` / `leftFoot` / `rightFoot`) の joint proxy を非表示にして、選択・範囲選択の対象からも外す (`updateIKSuppression`)。IK ハンドル 1 つだけが選択対象に。
    - IK ハンドル選択時の TC モードを `userPreferredMode` に従うよう変更（W=移動 / E=回転 で切替可）。`setUserMode` も IK ハンドルに対して mode 反映するように更新。
    - `objectChange` で IK ハンドルが rotate ドラッグされた場合、`target.quaternion` を `tipTargetWorldQuat` に反映して solveIK が tip の世界回転として保持するように。
    - `setIKEnabled` / `refreshIKTargetsFromCurrentPose` / `syncIKTargets` で target Mesh の quaternion も tip 世界回転に同期し、rotate ハンドルとして正しい初期姿勢を表示。
  - APP_VERSION を 2026.07.24.065 に。

- (dev v2026.07.24.064) 3D マネキン：IK トグルを腕・脚で分離
  - **UI**：「両手・両足を IK でドラッグ」の 1 個から「両腕を IK でドラッグ」「両脚を IK でドラッグ」の 2 個に分割。
  - **状態管理**：`ikEnabled` を `{ arm: false, leg: false }` に変更。`setIKEnabled(kind, on)` シグネチャに変更。
  - `syncIKTargets` / `tickIK` / pointerdown IK ハンドル当たり判定 / `applyPreset` を per-kind 判定に更新。ON にした kind のチェーンだけ target/pole 表示・毎フレーム再ソルブ・当たり判定対象に。
  - APP_VERSION を 2026.07.24.064 に。

- (dev v2026.07.24.063) 3D マネキン：IK ON 中のプリセット反映＋足裏フラット固定（腰移動で足首が回らない）
  - **プリセット (初期ポーズ等) が IK ON 中に効かない不具合修正**：`applyPreset` 後に IK target が古い位置のままだったため、次フレームで tickIK が「新ポーズを古い target 位置に引き戻す」動作をしていた。プリセット適用後に `refreshIKTargetsFromCurrentPose()` を呼び、target/tipTargetWorldQuat/pole 位置を新ポーズに合わせて更新するようにした。同時にボーン位置（腰など translate 済みの可能性あり）も bindMap.offset にリセット。
  - **足裏フラット固定**：IK 有効時に tip ボーン（足首・手首）の world quaternion をスナップ、`solveIK` の末尾で `tip.local = parentWorldInv * savedWorld` を計算して局所回転を再設定する。これで腰を移動しても親（lowerLeg / lowerArm）の回転変化が tip の見た目回転を変えず、足裏が地面に対してフラットのまま維持される。
  - **FK で tip を回した後の追随**：`tc.dragging-changed` の drag 終了イベントで、操作対象がチェーン内ボーンなら該当チェーンの target 位置・tipTargetWorldQuat・pole を再取得する。FK で足を回した後もその向きで固定が続く。
  - APP_VERSION を 2026.07.24.063 に。

- (dev v2026.07.24.062) 3D マネキン：Maya の W=移動 / E=回転 マニピュレータ切替＋腰の移動対応
  - **W/E キーで TC モード切替**：`userPreferredMode` を導入。`W` で translate、`E` で rotate。単独ボーン選択時のみ即反映（IK ハンドル・ポール・複数選択の proxy は用途固定のまま）。
  - **単独ボーン選択時は W で移動できる**：これで腰（root/hips）を選んで W を押せば移動マニピュレータが出て、ドラッグで胴体を並進移動できる。IK ON なら v061 の tickIK でチェーンが再解決されて足元は地面に残る。
  - **ボーンクリック時に強制 rotate していた挙動を撤去**：`userPreferredMode` を尊重するため、pointerdown の bone-click で `tc.setMode('rotate')` する処理を削除（`updateSelectionUI` 側でモード決定）。
  - HUD／ヘルプに W/E 表記追加。
  - APP_VERSION を 2026.07.24.062 に。

- (dev v2026.07.24.061) 3D マネキン：IK ON 中は target を世界固定・毎フレーム再ソルブ（腰を動かしても足が固定される）
  - **症状**：IK ON でも腰などの親ボーンを FK で動かすと足が一緒に持ち上がっていた。
  - **原因**：`syncIKTargets` が毎フレーム tip 位置を target に書き戻していたため、target が親の動きに追随してしまい、続くソルバも「変化なし」で処理を終えていた。
  - **修正**：
    - IK ON 中は `syncIKTargets` を早期 return し、target を世界固定に。
    - `tickIK()` を追加し、IK ON の毎フレームで各チェーンを target 位置に再ソルブ。腰・胸などの親ボーンが FK で動いても手足を target 位置にキープ（Maya の IK 挙動）。
    - IK ON トグル時に target を現在の tip 位置にリセット（FK やプリセットでずれた位置を初期化）。
    - ユーザーがチェーン内ボーン（upperArm/lowerArm/hand 等）を TC で直接ドラッグ中はソルブをスキップして FK 編集を尊重。
  - APP_VERSION を 2026.07.24.061 に。

- (dev v2026.07.24.060) 3D マネキン：TransformControls の自由回転（XYZE）ピッカー球を拡大
  - **症状**：軸リング（radius 0.5）の内側で自由回転（グリグリ回す）をしようとしても、少しでもリング寄りに来ると軸回転に吸われて自由回転が発動しにくい。
  - **原因**：TransformControls の XYZE ピッカーは既定で `SphereGeometry(0.25)` と軸リング内側の中央にしか無い。
  - **修正**：`tc._gizmo.picker.rotate` を traverse して XYZE の球を検出し、radius 0.42 の SphereGeometry に差し替え。リング内側の広い領域が自由回転になり、リング上の細い帯だけが軸回転になる。
  - デバッグ用に `window.__mannequin.tc` も expose。
  - APP_VERSION を 2026.07.24.060 に。

- (dev v2026.07.24.059) 3D マネキン：IK 初期ポール方向を kind ベースで補正（肘が前に折れる不具合修正）
  - **原因**：VRoid の bind pose がほぼ T ポーズで、腕の rmVec が rtDir とほぼ平行になり pole の垂直成分が微小 → 従来 fallback `(0,0,1)` を使っていた。character が +Z を正面としているため pole=+Z は「正面」を意味し、肘が正面（前）に折れていた。
  - **修正**：チェーン定義に `kind: 'arm'|'leg'` を追加。腕は自然に「後ろ」に折れる（-Z）、脚は「前」に折れる（+Z）を default pole に。垂直成分が閾値 1e-3 未満なら default を採用、有効値が取れた場合でも default と内積が負なら反転する（VRoid 微小 A-pose での誤検出防止）。
  - デバッグ用に `window.__mannequin.ikChains / solveIK / setIKEnabled` を expose。
  - APP_VERSION を 2026.07.24.059 に。

- (dev v2026.07.24.058) 3D マネキン：IK にポールベクター（bend 方向制御）追加
  - 各 IK チェーンに◇ポールハンドル（`OctahedronGeometry` wireframe）を追加。初期位置は肘・膝のワールド位置から現 bend 方向へ 0.3m 外側。
  - `solveIK` が pole ハンドル位置を root→tip 軸に垂直な成分に分解して bend 平面を動的に決定（handle 位置が軸に近すぎるときは前回の poleDir を fallback）。
  - ポールハンドルは pointerdown で tip ハンドルより先に当たり判定して TC を translate モードで attach。ドラッグすると肘・膝の折れ曲がる向きが変化。
  - 肘/膝 → ポールを繋ぐダッシュ線を毎フレーム更新（視覚ガイド）。
  - IK ON 時にポール位置を「現 elbow + 0.3m*bendDir」にリセットして、前回の残留位置を避ける。
  - snapshot / headless render では tip ハンドルに加えてポールハンドル・ポール線も非表示。
  - APP_VERSION を 2026.07.24.058 に。

- (dev v2026.07.24.057) 3D マネキン：Two-bone IK 実装（両腕・両脚）
  - **チェーン**：`leftArm(shoulder→elbow→wrist)` / `rightArm` / `leftLeg(hip→knee→ankle)` / `rightLeg` の 4 チェーン。init 時に各ボーンの aim direction（子ボーンのローカル位置）・骨長・初期 bend 方向（pole）を計算。
  - **ソルバ**：Two-bone IK。target までの距離 D から三角形の余弦定理で root/mid の角度を求め、pole 方向で bend 平面を決定。`aimBoneAt` で親フレームに変換した world 方向にボーンの aim ベクトルを合わせるように quaternion を計算・set。
  - **UI**：サイドバー「IK（逆運動学）」セクションにチェックボックスを追加。ON にすると両手・両足に色付き Box ハンドル（左腕=cyan / 右腕=magenta / 左脚=green / 右脚=orange）が現れる。クリック→TransformControls が translate モードに切替、Move ギズモで引っ張ると肩・肘・股・膝が自動追従。
  - **FK と共存**：IK ハンドル以外のボーンをクリックすると TC は rotate モードに戻り FK 選択に復帰。IK 非ドラッグ中は target が tip ボーンの現在位置に追随するので、FK でポーズを変えても target が置いてきぼりにならない。
  - **snapshot / headless render** では IK ハンドルを非表示にしてアノテスクショに写らないよう対策。
  - APP_VERSION を 2026.07.24.057 に。

- (dev v2026.07.24.056) 3D マネキン：ランタイム正中線を削除（テクスチャ方式に切り替え待ち）
  - v053〜v055 のランタイム正中線描画は体の凹凸に完全追従できないため撤去。今後はテクスチャ入り GLB に差し替える方針。
  - 削除範囲：`midLine` / `midlineGeo` / `updateMidline` / `MIDLINE_CHAIN` / `MIDLINE_THICKNESS` と 3D／headless 両方の tick 呼び出し。
  - APP_VERSION を 2026.07.24.056 に。

- (dev v2026.07.24.055) 3D マネキン：正中線を体表面に貼りつけ（前面カメラ→腹、背面カメラ→背中）
  - v054 では脊柱ボーンを結んだ折れ線が体の内側（中心）を通っていた。前後どちらから見ても表面に見えるよう、キャラクターの前後軸（characterGroup 座標系の +Z）方向にオフセット。
  - カメラの位置と腰ボーンの内積で符号を決め、カメラが前面側なら +前方（腹側）、背面側なら -前方（背中側）へ移動する。ボーンごとに厚み（頭 0.10 / 胸 0.11 / 首 0.05 等）をテーブル化して自然な表面高さに。
  - headless レンダー（アノテ用スクショ）でもアノテ側の cam に対して同ロジックを適用。
  - APP_VERSION を 2026.07.24.055 に。

- (dev v2026.07.24.054) 3D マネキン：正中線をスケルトンに沿った折れ線に変更（ポーズ追従）
  - v053 では characterGroup 下の直線だったため、ボーンを曲げても直立の 1 本線のままだった。
  - 頭頂→首→胸→背骨→腰→両足中点をボーンのワールド位置で結んだポリライン(`THREE.Line`)に変更。tick 毎に `getWorldPosition` で座標を更新するので、ポーズを変えても characterGroup を回転させても体の中心線に「テクスチャのように」追従する。
  - APP_VERSION を 2026.07.24.054 に。

- (dev v2026.07.24.053) 3D マネキン：正中線（体の中心を通る一本線）を追加
  - キャラクター中心の垂直軸に沿って足元 (y=-1) から頭上 (y=+0.75) までピンクの `THREE.Line` を描画。`characterGroup` の子として配置しているため、アノテ側のリング操作でキャラを 3D 回転させても正中線が追従する。`depthTest=false` で常に手前に描画するので体の裏に回っても消えず、シルエット・重心のガイドとして機能する。
  - APP_VERSION を 2026.07.24.053 に。

- (dev v2026.07.24.052) 3D マネキン：複数選択で2回目以降のドラッグが急に大回転する不具合修正
  - **原因**：TransformControls は `pointerDown` の中で `_quaternionStart = object.quaternion` を捕捉してから `mouseDown` event を dispatch する順序。前回のリセットを `mouseDown` ハンドラで行っていたため、TC は「前回のドラッグ後の proxy 回転値」を start として記録してしまい、2 回目のドラッグでは start が identity ではなくなっていた。その結果、objectChange で読み取る proxy.quaternion に前回分の回転が混ざり、delta が実際より大きく計算されて急激な回転が起きていた。
  - **修正**：proxy の identity リセットを `mouseUp`（ドラッグ終了直後）で行うようにした。TC は次回 `pointerDown` で改めて identity を start として捕捉するので、常に正しい delta 計算になる。あわせて mouseUp で proxy 位置も新しい重心へ更新（ドラッグでボーンが動いた結果を反映）。
  - APP_VERSION を 2026.07.24.052 に。

- (dev v2026.07.24.051) 3D マネキン：F キーで選択に寄る／複数選択の逆挙動修正／Alt 中は回転無効／ギズモサイズ ±
  - **F キー = Frame Selected**：Maya 準拠。選択中のボーン群 (無選択なら全ボーン) の重心＋最大半径で bounding sphere を計算し、視線方向を保ったまま `controls.target` と `camera.position` を再配置してビューに収める。
  - **複数選択マニピュレータの逆挙動修正**：これまでは delta を各ボーンのローカル軸に post-multiply していたため、両腕・両脚など軸方向が対になっているボーン群で回転方向が視覚的に反転して見えていた。世界空間で delta を適用し、`newLocal = parentQInv * delta * parentQ * initLocal` で親フレームに変換してからローカルにセットする方式に変更。
  - **Alt 中はボーン回転を無効化**：Alt キー（カメラ操作モード）押下中は `tc.enabled = false / tc.visible = false` にしてリング操作を封じる。カメラを回そうとして誤ってボーンを回してしまう事故を防ぐ。
  - **ギズモサイズ ± ボタン**：選択パネルに `−` / `＋` ボタンを追加。`tc.setSize` を 0.25〜2.5 の範囲で 0.15 刻みで変更、値は localStorage に保存して次回起動時に復元。
  - APP_VERSION を 2026.07.24.051 に。

- (dev v2026.07.24.050) 3D マネキン：複数選択時にもマニピュレーター（共有ピボット）表示
  - **共有ピボット proxy を追加**：複数ボーンを選択したとき、選択重心に空の `Object3D` を配置して TransformControls をアタッチ。ドラッグで proxy の quaternion が変化する。
  - **ドラッグ中は delta を各ボーンにローカル post-multiply**：`mouseDown` で proxy を identity にリセットしつつ各ボーンの quaternion をスナップショット。`objectChange` で `bone.quaternion = init * proxy.quaternion` を各ボーンに適用（＝各ボーンが自分のローカル軸まわりに同じ角度だけ回転）。これで両腕を同時に肘 flex させる等の対称ポーズ調整が可能。
  - APP_VERSION を 2026.07.24.050 に。

- (dev v2026.07.24.049) 3D マネキン：空白クリックで選択解除＋範囲ドラッグで複数ボーン選択
  - **空白クリック = 選択解除**：ボーンが当たらない空白領域をクリックすると現在の選択を解除。
  - **空白ドラッグ = 矩形範囲選択**：ドラッグ開始点にボーンが無ければ画面上に破線矩形を描画し、離した時点で矩形内に投影されているボーン proxy を一度に選択。
  - **Shift 修飾で追加選択**：Shift+クリック／Shift+ドラッグで既存選択を保持したまま追加。
  - **状態管理を Set 化**：単一 `selected` を `selectedSet` に置き換え。1 個選択時は TransformControls + XYZ スライダーを表示、複数選択時は「N 個のボーンを選択中」と件数だけ表示（TC・スライダーは非表示）。
  - **R キーが複数対応**：選択中の全ボーンを bind pose にリセット。
  - HUD／ヘルプ／初期メッセージも新操作系に更新。
  - APP_VERSION を 2026.07.24.049 に。

- (dev v2026.07.24.048) 3D マネキン：Alt+Right ドリーを Maya 準拠（横方向・右で寄る）に
  - OrbitControls の DOLLY は縦（Y）方向ベースで Maya の慣習と異なるため、右ボタンは
    OrbitControls に渡さず自前のポインタハンドラで処理するように変更。
  - Alt+Right ドラッグ時：X 方向で右へドラッグ = 寄る、左へドラッグ = 離れる（Maya 準拠）。
    感度は 1px あたり 0.7% の倍率変化（200px ドラッグで距離 ~1/4）。
  - APP_VERSION を 2026.07.24.048 に。

- (dev v2026.07.24.047) 3D マネキン：連続 apply でキャラ増殖修正＋ URL に APP_VERSION 付与でキャッシュ破棄
  - **連続 apply でキャラが増殖する不具合修正**：`openMannEditor` のクロージャで `prev`（既存マネキン参照）が `const` パラメータとして固定されており、初回 apply で新規マネキンを作った後も `prev` は `null` のままだったため、2 回目以降の apply も「新規追加」分岐に入り続けていた。`prev` を `let` に変え、新規作成後に `prev = target` を代入して以降の apply は同じマネキンの pose 更新に切り替える。
  - **`mannequin_3d.html` の URL に APP_VERSION クエリを付けてキャッシュ破棄**：3D エディタ（`window.open`）・headless iframe（`f.src`）とも同一 URL を使っていたためブラウザ側でアグレッシブにキャッシュされ、`mannequin_3d.html` の更新（カメラ操作 Maya 化・マット質感・正面向き 等）が反映されないケースがあった。`?v=<APP_VERSION>` を付与して dev バージョンが上がるたびに強制リロード。
  - APP_VERSION を 2026.07.24.047 に。

- (dev v2026.07.24.045) 3D マネキン：Maya 風カメラ操作
  - **症状**：3D エディタで「レビューに反映」を押すたびに、更新ではなく新しいマネキンが 1 体ずつ追加されていた。
  - **原因**：`openMannEditor` のクロージャで `prev`（既存マネキン参照）が `const` パラメータとして固定されており、初回 apply で新規マネキンを作った後も `prev` は `null` のままだった。そのため 2 回目以降の apply も「新規追加」分岐に入り続けていた。
  - **修正**：`prev` を `let` に変更し、新規作成後に `prev = target` を代入。以降の apply は同じマネキンの pose 更新に切り替わる。
  - APP_VERSION を 2026.07.24.046 に。

- (dev v2026.07.24.045) 3D マネキン：Maya 風カメラ操作
  - **Alt を押している間だけカメラ操作**：Alt+左=タンブル（回転）、Alt+中=トラック（平行移動）、Alt+右=ドリー（ズーム）。ホイールズームは Alt 無しでも常時利用可能。
  - Alt を押していない Left クリックは従来どおりボーン選択に使われる（カメラ操作とボーン選択の混線を解消）。
  - `blur` で Alt キー押しっぱなしの残留を解除。右クリックの標準メニューを抑止。
  - HUD／ヘルプテキストも Maya 風の表記に更新。
  - APP_VERSION を 2026.07.24.045 に。

- (dev v2026.07.24.044) 3D マネキン：正面向き＋マット質感
  - **正面を向くように 180°回転**：Vroid/VRM 出力の正面 = -Z の慣習と Three.js カメラ (-Z 向き) が同方向のため、そのまま置くと背中が見える状態だった。`modelRoot.rotation.y = Math.PI` で正面 (+Z) にして正面が見えるように。
  - **マット質感**：FBX2glTF が `metallic=0.4 / roughness=0.23` の光沢寄りマテリアルで書き出していたため肌がテカテカに。ロード後に `metalness=0.0 / roughness=0.95 / envMapIntensity=0.4` に上書きしてマットな見た目に。
  - APP_VERSION を 2026.07.24.044 に。

- (dev v2026.07.24.043) 3D マネキン：スケール計算をボーンベースに変更（キャラが表示されない不具合の完全修正）
  - **問題**：v041/v042 で GLB モデルに差し替えた後、キャラクターが画面から消えて joint proxy のリングだけが見える状態に。
  - **原因**：`Box3.setFromObject(modelRoot)` を使ったスケール推定が SkinnedMesh に対して機能しない。SkinnedMesh の `boundingBox` はスキニング前の生の頂点座標（VRoid だと `170×26×180` の異常値）を返すため、自動判定で「cm 単位」と誤検出して 1/100 スケールが適用され、キャラが 1.7cm サイズになっていた。
  - **修正**：`Box3` ベースの推定を廃止し、ボーン位置（`J_Bip_C_Head` と `J_Bip_L_Foot` の world Y 差分）で身長を実測。今回のモデルは native 1.51m → 1.7m target で scale=1.123 が適用される。腰と足も同様にボーン位置ベースで X=0/Z=0/地面 y=0 に整列。
  - APP_VERSION を 2026.07.24.043 に。

- (dev v2026.07.24.041) 3D マネキンをカスタム GLB モデル（VRM/Vroid スタイル）に差し替え
  - **プロシージャル人体を GLB モデルロードに置き換え**：`mannequin_3d.html` の手続き型ボーン生成コードを撤去し、`GLTFLoader + DRACOLoader`（DRACO decoder は `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`）で `mannequin_model.glb`（DRACO 圧縮済み・1.6 MB）を読み込むように変更。
  - **VRM Bip 命名を既存フレンドリ名にマップ**：`J_Bip_C_Hips` → `root`、`J_Bip_L_UpperArm` → `leftUpperArm` などのマップテーブル（`VRM_MAP`）で 20 ボーンを既存 UI・プリセット・回転操作にブリッジ。
  - **クリック用 joint proxy 追加**：スキンメッシュ上のボーンは raycast で直接クリックできないので、各ボーンのワールド位置に見える小球（半透明・常に最前面）を追随させ、それを raycast 対象にする。tick 毎に `getWorldPosition` で位置同期。
  - **モデルの自動スケール／位置補正**：bounding box から身長を測って 1.7m にスケール、モデル中心を x=0/z=0、足を地面 y=-1（`characterGroup` の +1.0 と合わせて世界 y=0）に合わせる。
  - **snapshotDataURL / headless render** で joint proxy を非表示にしてスクショに写り込まないよう修正。
  - APP_VERSION（laycat_dev.html 側）を 2026.07.24.041 に。
  - **既知事項**：VRM のバインドポーズは T ポーズではないため、既存プリセット（走り・座り 等）は差分量が合わずポーズが不自然になる可能性があります。実機で確認しつつプリセット値を再調整予定。

- (dev v2026.07.24.040) コメント編集フィールドをスクショの上に配置＋UI 内 D&D で誤アップロードを防止
  - **コメント編集欄がスクショの下に出る問題を修正**：`ed.onclick` が `note.appendChild(ta)` を末尾に付けていたため、`.note-shot` の下にテキストエリアが出現し、視線移動が大きく編集しづらかった。`.note-shot` が存在すればその直前（＝テキスト直下）に textarea + 保存/キャンセル行を差し込むよう変更。
  - **UI 内 D&D でアップロードモーダルが誤って開くのを防止**：レビューページ表示中は window レベルの `dragenter/dragover/drop` を常時受け付けていたため、FB オーバーレイ／サブミット窓／通常モーダル／レビュードロワーが開いている状態でファイルをドロップしても、裏側のショットに対するアップロードモーダルが起動していた。`dropCtx` を「オーバーレイが開いていない」「ドロップ先が既存 dropzone / input / textarea / button / select / a 上ではない」と組み合わせて判定するよう変更し、FB 内で誤って開かないようにした。
  - APP_VERSION を 2026.07.24.040 に。

- (dev v2026.07.24.039) アノテ窓のコメント欄にスクショ表示＋送信の体感速度改善
  - **アノテ窓のコメント一覧にスクショ表示**：`noteBlock` は `opts.shot` が渡っていればフレームアノテのスクショサムネを描画するが、アノテ窓（`renderNotes`）だけ shot を渡し忘れていたため、コメントログにスクショが出ていなかった。`{fileRef:v.file,fps:v.fps||24,isVideo}` を渡すよう修正。タスクページ／リールの同機能と同じ見た目に。
  - **送信の体感速度改善**：`sendCurrent` / `submit` / `reelSubmit` が `await persist()` 完了を待ってから UI 更新していたため、R2 プロジェクトではネットワーク待ちで数百 ms〜秒単位の遅延を体感していた。`persist()` は `_persistChain` で直列化されているため、UI を先に更新して save は fire-and-forget にしても連続送信は順番どおり実行される。失敗時は toast で通知。送信ボタンのクリックから DOM 反映までがほぼ即時に。
  - APP_VERSION を 2026.07.24.039 に。

- (dev v2026.07.24.038) 同一フレームの描画＋コメントを 1 ノートに集約して送信
  - **症状**：あるフレームで描画してさらにコメントを書いた状態で「送信」を押すと、描画ノートとコメントノートが**別々の 2 ノート**として保存されていた（コメントログにも 2 行出る）。
  - **原因**：v032 で「コメントに勝手にスクショが付くのを防ぐ」ため、`buildFrameNotes` がテキストを**常に独立ノート**として push する実装になっていた。描画のあるフレームでも例外なく分割していたため、意図に反する分裂が起きていた。
  - **修正**：`buildFrameNotes` を「現在フレームに描画ノートが有ればそこにテキストをマージ、無ければ単独コメントノートを push」に変更。
    - 描画＋コメント → 1 ノート（スクショ付き・テキスト付き）
    - コメントのみ → 単独ノート（スクショ無し・従来どおり）
    - 描画のみ → 単独ノート（従来どおり）
  - APP_VERSION を 2026.07.24.038 に。

- (dev v2026.07.24.037) アノテ送信の消失バグ修正（参照孤児化 + 削除同期の暴発）
  - **症状**：動画データにコメント／描画アノテを送信しても、`refreshFromFolders`（30 秒／タブ復帰）や他タブとの同時編集をきっかけに、送信直後のアノテが消える／保存されないケースがあった。
  - **原因 1（参照孤児化）**：`_applyShotFileIntoDB` が `Object.assign(ex, rn)` で node を上書きしていたため、`ex.versions` の配列参照が新しいオブジェクト（マージクローン）に差し替わっていた。外部で `v = ex.versions[j]` を保持していたコード（送信フロー・アノテ描画中の参照など）が孤児化し、その後の `v.review.notes.push(...)` などが DB に到達せず消失していた。
  - **原因 2（削除同期の暴発）**：v036 で追加した「clean 時に remote に無いノードを local から削除」処理が、R2 の eventual consistency で自分の書き込みが remote に反映されるまでの一瞬に、自分が直前に追加した新ノードを削除してしまう可能性があった。
  - **修正 1**：`_deepMergeInPlace(target, source)` を新設し、配列は `length=0` + `push` で in-place 置換、id 付き配列は既存インスタンスを再利用してマージ、入れ子オブジェクトも再帰的に in-place マージするようにした。外部参照（`ex.versions[j]` 等）が全て生き続けるため、送信ノートが確実に DB へ届くようになった。
  - **修正 2**：削除同期に `baselineIds` ガードを追加。baseline スナップショットに存在しなかったノード（＝直近で自分が追加、まだ remote に伝播しきっていない可能性）は削除対象から除外。
  - APP_VERSION を 2026.07.24.037 に。

- (dev v2026.07.24.023) アノテ UI 改善（ペン/消しゴム分離・担当バッジ・投げ縄選択・工程順序）
  - **ペン／消しゴムを別ボタン化**：paintBtn の 3 状態循環をやめ、`penBtn(✎)` と `eraserBtn(⌫)` の独立 toggle に。両方アイコンのみ・active 状態で判別。既存の `paintBtn` / `drawBtn` / `eraserBtn` 参照は penBtn への alias で互換維持。
  - **アノテ窓のトップに担当者／レビュアーバッジ**：ステータスバッジの右に「担当: ...」「レビュー: ...」チップを表示。ショット単位の assignee/reviewer を参照。
  - **投げ縄（lasso）選択ツール追加**：`◇` ボタンで有効化。フリーハンドで囲んで現在フレーム＋現在レイヤーのペンストロークを選択（過半数の点が polygon 内で判定）。選択後は選択枠+4 隅ハンドル+上端回転ハンドル+情報バーを描画。
    - 選択枠内をドラッグ = 移動、四隅 = 拡縮、上端ハンドル = 回転、Delete = 削除、Esc = 選択解除
    - pending + committed（送信済み）両対応。committed 変更時は `n.edited=true` と `committedDirty=true` を立てて自動保存に載せる
  - **全工程未着手ショットの先頭工程表示**：`repOf` が `stageRankCmp`（LAY/ANIM ハードコード順）で再ソートしていたのを廃止し、`childrenOf` の工程設定順（`section.stages` 由来）をそのまま採用。全工程未着手のショットは先頭工程が代表となり、その名前（例：lay）と担当者バッジがショットタイル・行に表示される。工程バッジは動画無しの時は半透明で控えめ表示、未着手バッジも別途出す。
  - APP_VERSION を 2026.07.24.023 に。
  - 原因：`autoRefresh` → `refreshFromFolders` → `_unionRemoteIntoDB` → `_mergeNodeInto` が 3-way マージ用の「local 優先・空欄のみ remote で補完」実装。他ユーザーがショットの status / assignee / reviewer を変更しても local 側の値が空でない限り上書きされず、タブ復帰しても見た目が変わらなかった。
  - 修正：`_mergeNodeInto(a, b, opts)` に `preferRemote` オプションを追加。`preferRemote=true` の場合は remote に値があれば local を上書き（scalar 8 種類 ＋ 配列 4 種類）。
  - `refreshFromFolders` は「未保存変更が無い（`_saveCache.proj[id]` と現在の projectData が一致）」プロジェクトのみ `preferRemote:true` で呼び出す。編集中のプロジェクトは従来通り union のみで保守的に取り込む。
  - 取り込み後は `_saveCache` を新しい状態で更新し、次回リフレッシュも `clean` 判定が通るようにする。
  - 効果：他ユーザーがステータスを変更 → 30 秒以内 or タブ復帰時に自分の画面にも反映されるように。
  - APP_VERSION を 2026.07.24.022 に。
  - APP_VERSION を 2026.07.24.021 に。
  - `eyeAxis` を pivot→camera 方向に変更し、ring basis を u=worldUp×axis / v=axis×u に。
  - これで「ドラッグ CCW = キャラも CCW」に一致（右手則で軸が視点向きなら CCW が正）。
  - APP_VERSION を 2026.07.24.020 に。
  - 原因：`isFront` を「点までのカメラ距離が pivot 距離以下」で判定していたため、E リング（pivot 平面上の円）は全点が pivot より遠くなり、全部背面扱いで消えていた。yaw/pitch/roll の赤道点も同様に非表示だった。
  - 修正：判定を「offset · (pivot→camera 方向) ≥ -0.001」に。E リング（offset ⊥ 視線）は全点 dot=0 で常に表示、yaw/pitch/roll は真の背面のみ非表示。
  - APP_VERSION を 2026.07.24.019 に。
  - **E ジンバル追加**：TransformControls の "E" 相当。カメラ視線軸まわりの WORLD 回転（画面平面上ロール）。黄色・外側の環として描画。ドラッグは左乗算（`q_new = R_world(eyeAxis) × q_start`）で世界軸まわりの回転を実現。
  - **半径統一**：yaw / pitch / roll をすべて 0.70 に統一（青のロールが 0.82 で浮いていた問題を解消）。E は 0.90 で外側に配置。
  - **背面リング非表示**：iframe が各リング点に `front` フラグ（`isFront = 点までのカメラ距離 ≤ pivot までのカメラ距離`）を付与して返す。アノテ側は front セグメントのみ描画・hit test も背面はスキップ。TransformControls の depth-tested な見た目に近づく。
  - **ドラッグ中は 400×400 で軽量描画**：`_mannScheduleRender(p, 400)` を rotation drag 中に使用。ドラッグ終了で 600×600 の高解像度に再描画。3D シーンの再レンダー + toDataURL コストが約 40% 削減。
  - `p.eyeAxis` を render 応答から取得して保持（世界軸情報）。
  - APP_VERSION を 2026.07.24.018 に。
  - **回転を quaternion 累積に**：viewYaw/Pitch/Roll の固定 Euler（YXZ）廃止 → `viewQuat` を保持。各ドラッグは `viewQuat_start * R(local_axis, angle)` の右乗算（INTRINSIC）で、TransformControls の rotate/local と完全一致。
    - これにより、pitch を先にかけてから yaw ドラッグしても、yaw はキャラの傾いた縦軸まわりに回る（以前は常に world Y だった）。
  - **リング hover ハイライト**：mann ツール中はマウス位置でリング判定 → `mannHoverAxis` を更新して該当リングを太く鮮やかに描画（TransformControls の hover と同じ）。
  - **旧データ互換**：`_mannEnsureQuat` で viewYaw/Pitch/Roll を YXZ intrinsic の quaternion に自動変換。
  - **`_mannRender` は `charQuat`（[x,y,z,w]）を送信**：iframe 側は charQuat 優先で `characterGroup.quaternion.copy` に反映、Euler は互換のため残す。
  - **レビューに反映で 3D エディタが閉じないように**：`sendResult('apply')` は `window.close()` を呼ばず、ボタンに「✓ 反映しました」を 0.9 秒表示するだけ。連続で apply 可能（Photoshop のようにポーズ調整 → プレビュー反映のループ）。cancel は従来通り閉じる。
  - **openMannEditor の複数呼び対応**：`_mannActiveHandler` / `_mannActiveEditor` を track し、新しい editor を開く際に古いハンドラを解除＋古い窓を閉じてリスナー重複を防ぐ。apply では handler を残す（連続 apply 対応）。
  - `cloneDrawItem` は viewQuat を保存対象に。APP_VERSION を 2026.07.24.017 に。
  - mannequin_3d.html の `computeGizmoRings`：ヨーリングの basis v を `+zAxis` → `-zAxis` に。Three.js R_Y(+t) が +X→-Z なので、リングを X→-Z 順に張ることで「ドラッグ方向 = 実際の回転方向」に一致させる。
  - ピッチ・ロールは元々一致していたので変更なし。
  - APP_VERSION を 2026.07.24.016 に。
  - **回転がキャラクター基準に**：mannequin_3d.html に characterGroup（(0, 1.0, 0) をピボットに）を導入し、root ボーンをその中へ移動。headless render は camera を動かさず、`characterGroup.rotateY(yaw) → rotateX(pitch) → rotateZ(roll)` の順に intrinsic YXZ を適用（顔の向きガイド／3D エディタ TransformControls と同じ順序）。カメラは pose.camera 位置に固定。
  - **リング視覚化を正確に**：iframe が現在の character 軸を PNG 座標に投影した 3 リング polyline を返す（`computeGizmoRings` を Three.js の `Vector3.project(cam)` で 64 点ずつ生成）。アノテ側は polyline を canvas に描画するため、ヨー後にピッチリングが character の局所垂直方向に来る等、character 基準の 3 軸が正しく表示される。
  - **ドラッグを接線ベース化**：クリック点で polyline の接線を取得し、ドラッグ量を接線に投影して回転量に変換（3D エディタの TransformControls と同じ体感）。1 リング周長 ≒ 360° 相当の感度。
  - **ヒットテストも polyline に**：エリプス近似を廃し `_nearestOnPolyline` で 3 リングとの距離を比較して最も近いリングを採用。優先順位：コーナー > 中央ハンドル > リング > 本体。
  - **レビューに反映で回転がリセットされる問題を修正**：openMannEditor の onMsg で prev が存在するとき、pose のみ差し替えて viewYaw/Pitch/Roll は保持し、必ず `_mannScheduleRender(prev)` を走らせて回転が入った img と gizmoRings を再生成。新規作成時も 0 回転で 1 度 render を走らせて gizmoRings を取得。
  - **ドラッグ方向**：本体自由回転を +dx→+yaw／+dy→+pitch（顔の向きガイドと同じ convention）に統一。
  - `_mannRender` は `{img, rings}` を返す形にリファクタ。`cameraYaw/Pitch/Roll` は互換のため受理するが送信側は `charYaw/Pitch/Roll` に統一。
  - APP_VERSION を 2026.07.24.015 に。
  - **ヨー方向を修正**：緑リング／本体ドラッグの水平方向をカメラ位置計算の符号と合わせ、右ドラッグでキャラが右向きに回るように反転。
  - **ロール軸（青リング）を追加**：viewRoll を新設。青い円は画面平面上に常に円で表示、中心からの角度差でロール量を決定。3 軸で完全な 3D 回転が可能に。
  - **本体ドラッグ = 自由回転**：リング外の本体クリック時は yaw + pitch を同時に動かす（顔の向きガイドと同じ挙動）。
  - **中央ハンドル = 移動**：本体中心の白丸を掴めば移動、それ以外の本体は自由回転に分離。
  - **ヒットテストの優先順位**：コーナー > 中央ハンドル > 3 リング（最も近いもの）> 本体（自由回転）。
  - **ロールを headless render に反映**：mannequin_3d.html の headless モードは `cameraRoll` を受け取り、camera の up ベクトルを view 方向まわりに roll だけ回転させて lookAt する。
  - **3D エディタのボーン回転にも TransformControls（Rotate ジンバル）を導入**：Three.js `TransformControls` を rotate/local モードで scene に配置。ボーン選択時に自動 attach、非選択時 detach。ドラッグ中は OrbitControls を無効化。`objectChange` イベントで右パネルスライダも同期。snapshot 生成時はジンバル非表示。
  - `cloneDrawItem` に viewRoll を追加。
  - APP_VERSION を 2026.07.24.014 に。
  - **🎭 3D ボタンの挙動変更**：ツール toggle をやめ、押すと即 3D エディタが開く。同フレーム＋同レイヤーに既存があれば再編集モード、無ければ新規。反映後は自動で `tool='mann'` に切替＋対象を選択状態に。
  - **何もない場所のクリックは新規作成しない**：選択解除のみ（新規は必ず 3D ボタン経由）。
  - **回転マニピュレータ（ジンバル）を導入**：Shift+ドラッグの代わりに、マネキンの周囲に 2 リングを描画。
    - 緑リング（水平の楕円）＝ヨー（左右回転）。楕円の縦扁平は現在のピッチ角に応じて変化。
    - 赤リング（垂直の楕円）＝ピッチ（俯仰回転）。楕円の横扁平は現在のヨー角に応じて変化。
    - リング上をドラッグでその軸のみを回転（1 画面幅 or 高さ ≒ 360°）。
    - 選択中は鮮やか、非選択は半透明で描画。
  - **Delete/Backspace で選択中マネキンを削除**（mann ツール中のみ・入力欄フォーカス中は素通し）。
  - `mannHitTest` の優先順位を再定義：コーナー > ジンバル > 本体。
  - `selectedMann` 状態を追加。ツールを mann から抜けると自動解除。
  - **表示バグ修正**：レビューに反映で 1 回目が表示されず 2 回目で表示される問題。原因は `new Image()` の非同期デコード完了前に drawAll が走っていたため。`_mannLoadAsync` を追加して push 前に画像デコード完了を待つ設計に変更。加えて `_mannRedrawCbs` に登録された全レビュー窓へ onload で再描画通知（複数窓・複数レイヤーでも自動追従）。
  - **🎭 3D をツール化**：ボタンを toggle 化し `tool='mann'` で有効。有効時のみキャンバスでマネキン選択操作が可能（描画ツールを邪魔しない）。カーソルは move。
  - **アノテ内インライン編集**（案 B）：
    - 何もない場所をクリック → その位置に新規マネキンを配置（3D エディタを開いて反映後、クリック地点に登場）
    - マネキン本体をドラッグ → 移動
    - 四隅ハンドル（紫の小四角）をドラッグ → 拡縮
    - **Shift + ドラッグ → 3D 回転**（水平＝ヨー左右／垂直＝ピッチ俯仰）
    - ダブルクリック → 3D エディタを開いてポーズ再編集（直前ポーズを LocalStorage 経由で自動ロード）
    - ツール選択中は選択枠（紫の点線）＋四隅ハンドル＋操作ヒントを描画
  - **3D 回転の裏側**：`mannequin_3d.html?headless=1` を隠し iframe に常駐させ、ドラッグ中は throttle して `postMessage {cmd:'render', pose, cameraYaw, cameraPitch}` を送信 → 新 PNG が返り次第 `p.img` を差し替えて `drawAll()`。UI・OrbitControls を無効化した headless モードを mannequin_3d.html に追加（Three.js scene は共通）。
  - `mannequin` アノテに `viewYaw` / `viewPitch` フィールドを追加。`cloneDrawItem` はまだ含めていない（次コミットで追加予定）が、pending の in-memory 編集はできる。
  - `cleanup()` で `_mannRedrawCbs.delete(_mannCb)` を呼び、アノテ窓を閉じた後にゾンビコールバックが発火しないように。
  - 新規 `mannequin_3d.html`：別ウィンドウで開く 3D ポーズエディタ。Three.js（0.160 CDN + importmap）＋ 手続き型ヒューマノイド（Cylinder+Sphere+Box プリミティブ）＋ OrbitControls。
  - 21 ボーン（root/spine/chest/neck/head、左右 shoulder/upperArm/lowerArm/hand、左右 hip/upperLeg/lowerLeg/foot）。ボーンクリックでハイライト＋右パネルに XYZ 回転スライダ（初期ポーズからのデルタ・度単位）。プリセット 6 種（T ポーズ／A ポーズ／立ち／座り／走り／手を振る）。
  - 「レビューに反映 →」ボタンで 600×600 の透明 PNG スナップショット + ポーズ JSON（各ボーンのオイラー角＋カメラ位置）を postMessage で opener に返す。「キャンセル」でも postMessage を送って呼出側の onMsg を確実に解除。
  - `laycat_dev.html`：
    - アノテーションツールバーに `🎭 3D` ボタンを追加（顔の向きの右）。押すと popup で mannequin_3d.html を開き、応答を待って pending に `{kind:'mannequin', cx, cy, w, img, pose, f, layer}` を追加。
    - 同フレーム＋同レイヤーに既存 mannequin があれば「再編集モード」：LocalStorage 経由でポーズを渡して開き、返ってきたら差し替え。
    - `paintStrokeList` に `kind==='mannequin'` の分岐を追加し、base64 PNG を Image デコード（`_mannIMG` キャッシュ）→ 正規化中心 `(cx,cy)`＋正規化幅 `w` で描画（縦横比維持）。
    - `eraseFromList`：マネキン矩形を消しゴムでクリックすると削除。
    - `cloneDrawItem`：mannequin フィールドを保存対象に含める（DB シリアライズ・undo 復元対応）。
  - Phase 1 の割り切り：中心固定・拡縮/移動 UI なし（次 Phase）。3D 側は CDN 依存（後続でインライン化検討）。IK・接地拘束は未実装（現在は FK スライダのみ）。
  - 参考：`docs/MANNEQUIN_3D_MEMO.md`ヘッダの通知ベル右に「テーマ切替」ボタン（月／太陽アイコン）を追加。`:root[data-theme="light"]` で明色パレットに切替、localStorage `laycat_theme` に永続化。既定はダーク。`<head>` の早期スクリプトで保存済みテーマを最速反映して FOUC を防止。
- 層① サービス層のロールを 3 択（運営／管理者／メンバー）→ 2 択（運営／メンバー）に統一。「管理者(adminEmails)」ロールを廃止：
  - `access-console.html`：tiers() から admins を削除し、UI の管理者リスト・「→管理者」ボタン・add role の管理者オプションを撤去。setRole の 'admin' ターゲットは互換のため受け取っても 'member' として扱う。旧 adminEmails データは setRole の次回保存で自動的に allowedEmails に統合される（べき等）。isAuditor は isEditor と同義に。RULES の isStaff() から adminEmails 参照を削除
  - `worker/laycat-r2-api.js`：isAdminEmail を廃止、isStaffEmail（operatorEmails のみ）に統合。互換のため `const isAdminEmail = isStaffEmail` で旧関数名も生存。checkProjectAcl の admin エスカレーションは「運営エスカレーション」に改名（reason: 'operator'）
  - `admin-audit.html`：既に operatorEmails 判定なので変更なし
  - `docs/ROLES_MODEL.md`：新規作成。3 層（サービス／プロジェクト／契約）のロールモデル全体像を整理
  - 廃止理由：「運営」との差が「監査ログ可否」だけで薄い中間層になっていた。サブスク運営時の「ユーザー招待管理」は層③（契約層）のオーナー／管理者で行う設計に統一するため、層①では不要と判断
- R2 バケット LIST 露出問題を解決：Firestore メンバーシップ表（`laycatMemberships/{emailKey}/projects/{pid}`）を導入し、`/api/r2/mine` の実装を Firestore クエリベースに切替。
  - Worker (`worker/laycat-r2-api.js`)：
    - `firestoreSetDoc` / `firestoreDeleteDoc` / `firestoreListIds` / `memberKeyFromEmail` / `upsertMembership` / `deleteMembership` / `syncMembershipsForProject` / `purgeProjectMemberships` / `listMyMemberships` ヘルパを新設
    - `_access.json` PUT 時：body を保持して置換後、`syncMembershipsForProject(oldAccess, newAccess)` で追加／削除された人だけを Firestore に反映（`ctx.waitUntil` で fire-and-forget）
    - `_access.json` DELETE 時／`/api/r2/purge/projects/<pid>/` 時：`purgeProjectMemberships` で該当 pid の全メンバーシップを削除
    - `/api/r2/mine`：Firestore を LIST → 自分の pid 配列を取得 → 各 `_access.json` を並列 GET（旧実装のバケット全走査は廃止）。運営が `?bucketScan=1` を付ければ旧経路にフォールバック可能（緊急用）
    - 新規 `POST /api/r2/rebuild-memberships`：既存プロジェクトの全 `_access.json` を走査してメンバーシップを Firestore に流し込む初回移行用。運営 or 管理者のみ、べき等
    - `isStaffEmail(env, email)` ヘルパを新設（既存 `isAdminEmail` は adminEmails のみ、こちらは operatorEmails or adminEmails）
    - `checkProjectAcl` の返り値に `access` フィールドを追加（PUT/DELETE ハンドラで diff 計算に再利用）
  - `access-console.html`：
    - opArea に「🔄 R2 メンバーシップ再構築」カード（Worker エンドポイント URL 入力 → POST /api/r2/rebuild-memberships）を追加
    - Firestore rules に `laycatMemberships/{key}/projects/{pid}` セクション（read=各ユーザーの自分の emailKey のみ、write=false → Worker SA で bypass）
  - `docs/SECURITY_MEMO.md`：R2 プロジェクト階層のフラット構造問題を「対応済み」に更新
  - Beta 反映前に **Firebase コンソールで Firestore セキュリティルール更新 → Worker 再デプロイ → 運営が「🔄 R2 メンバーシップ再構築」ボタンを 1 回押す** の 3 手順が必要
- 監査ログ閲覧 UI を追加：新規 `admin-audit.html`（運営 operatorEmails 登録者のみアクセス可能・管理者でも閲覧不可）で、Worker が Firestore `laynaAudit` コレクションに自動記録した R2 の書込・削除・拒否・エラーイベントを閲覧可能に。フィルタ（日付範囲・メソッド・ステータス・PID・メール・パスの部分一致）と CSV エクスポートに対応。
  - Worker (`worker/laycat-r2-api.js`)：`firestoreCreateDoc(collection, data)` ヘルパを新設し、audit 関数を修正。PUT/POST/DELETE と 4xx/5xx イベントは `laynaAudit` コレクションに `ctx.waitUntil()` で fire-and-forget 書き込み（レスポンスをブロックしない）。GET 200 は console.log のみ（ボリューム抑制）。フィールド：ts / method / path / key / pid / email / ip / ua / status / dur / extra。
  - `access-console.html`：opArea 先頭に「📋 監査ログ」カードを追加。カードは常時表示、ボタン活性は運営（operatorEmails）登録者のみ、それ以外には「未登録のため閲覧不可」の案内文を表示。`admin-audit.html` を新規タブで開く。Firestore rules に `laynaAudit/{docId}` を追加（read=operatorEmails のみ、write=false → Worker の SA でルール bypass 書込）。
  - **監査ログのアクセス権限は「運営（operatorEmails）のみ」に限定**（管理者/adminEmails では閲覧不可）：セキュリティ最優先の設計で、最上位権限だけが監査ログを見られる。
  - Beta 反映前に **Firebase コンソールで Firestore セキュリティルールを更新する必要あり**（access-console 表示のルールに `laynaAudit` セクションが追加されている）。


</details>

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

- **【2026-07-28 Beta v0.0.6 再反映（バージョン据え置き）】** 以下は laycat_dev.html → laycat.html にコピー済みだが PATCH_NOTES.md には記載せず beta v0.0.6 のまま：
  - **3D エディタのプリセット UI 撤去**（dev v2026.07.28.001）：サイドバーの `<h3>プリセット</h3>` セクションと `.presetGrid` の HTML/CSS を削除。「初期ポーズ」ボタン（ヘッダ）は残置。`PRESETS` オブジェクト・`applyPreset` 関数は「初期ポーズ」用に温存。
  - **投げ縄アイコンを Photoshop 風ロープループに差し替え**（dev v2026.07.28.002/.003）：従来の破線楕円＋尻尾から実線ロープ＋短い縄尻に変更。`LASSO_SVG` のみ変更、ロジックは無変更。
  - **`MANN_VERSION` 定数を追加してmannequin_3d.html のキャッシュを独立に破棄可能に**（dev v2026.07.28.004）：dev/beta 共有ファイルの `mannequin_3d.html` を更新した場合、APP_VERSION 据え置きだと URL クエリ `?v=<APP_VERSION>` が変わらずブラウザに強制リロードさせられなかった。新たに `MANN_VERSION`（現在 `'2'`）を追加し、URL を `?v=<APP_VERSION>&mv=<MANN_VERSION>` に。mannequin_3d.html を触るたびに MANN_VERSION を +1 すれば、APP_VERSION を bump せずにキャッシュを破棄できる。今回の投げ縄アイコン差し替え・プリセット撤去も、次回 laycat.html をリロード（HTML 自体の TTL は短いので通常のページ再訪で反映）した後の 3D エディタ／アノテ窓オープンで自動的に新 mannequin_3d.html が取得される。

- **【2026-07-24 Beta v0.0.5 再反映（バージョン据え置き）】** 以下は laycat_dev.html → laycat.html にコピー済みだが PATCH_NOTES.md には記載せず beta v0.0.5 のまま:
  - **EXR データ系レイヤーはデフォルトガンマ 1.0（リニア）で表示**：Depth / Normal / Motion Vector / Position / UV / Cryptomatte を `_isDataLayer(name, lay)` で判定し `_defaultGammaForLayer` を通す。切替後はスライダで自由に調整可能。レイヤー切替時／リセットボタン／初回ロードのいずれでも適用（保存済み gamma が明示的にある場合はそれを優先）。
  - **EXR Z (Depth) の Auto 黒白点を p1/p99 パーセンタイルベースに**：far-clip の巨大値や sky sphere の Infinity で実オブジェクトの階調が潰れる問題を解消。初期黒点＝p1（下位 1%）／初期白点＝p99（上位 1%）／スライダ可動範囲上限を `p99 * 1.2` にクランプ。Nuke Read ノードの Auto Levels と同等の挙動。
  - **EXR Cryptomatte の数字サフィックス付きレイヤー（`crypto_object00` / `01` / `02` …）を全て非表示化**：無ナンバー版（`crypto_object`）だけを表示。00 も 01+ と同じ扱い（本体と内容が同一なので重複）。`_cryptoRank(name)` / `_shouldHideCryptoLayer(name)` ヘルパを新設し、レイヤーセレクタと「🎨 全レイヤー」タイルモーダルの両方でフィルタ。
  - **「🎨 全レイヤー」タイルモーダルでも各レイヤー適切なガンマで描画**：レビュー画面と同じ「本来の見た目」でタイル一覧できるように。
  - **チェック待ちタブ「⧉ まとめてタブに追加」ボタンを選択中の担当者タブに限定**：以前は全担当者のチェック待ちカット全てが対象になっていた。ボタン件数と title / toast にも対象担当者名を表示。
  - **バッジ全般の文字ウェイトを細くして CJK 太字の潰れを解消**：10-11px の小さいバッジで日本語が font-weight 700 だと画数の多い文字が潰れて読みにくかったため全体調整。`.mp-badge`（作業/チェック担当）名前 600 → 500、`.chk-done-chip` / `.sc-chip` / `.proj-badge` 700 → 500、`.pm-badge` / `.tl-stage` / `.draft-chip` 700 → 600。


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
