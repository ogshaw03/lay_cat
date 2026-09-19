# LayCAT アップデートログ

このファイルは開発中の全変更を記録するログです。
`PATCH_NOTES.md` はここから取捨選択して更新されます（運用方針は `CLAUDE.md` の「パッチノート運用」を参照）。

セクション構成（LayCAT 本体）：
- **未反映（次のパッチノート候補）** … まだ Beta（`laycat.html`）に入っていない項目。
- **反映済み・パッチノート記載なし** … Beta には反映済みだが `PATCH_NOTES.md` には記載していない項目（バグ修正・運営限定変更・実験機能など）。次回パッチノート更新時に載せ替え候補になる。
- **反映済み beta vX.Y.Z** … `PATCH_NOTES.md` に記載済みの項目（バージョンごとにアーカイブ）。

pmboard（進行管理ボード）は本ファイルの下部「pmboard アップデートログ」セクションに分けて記録する。同じ 3 セクション構成を採用。

---

# LayCAT 本体アップデートログ

## 未反映（次のパッチノート候補）

<!-- 以降、コミット単位で `- (short-hash) 日本語要約` を追記していく -->

- (dev v2026.09.19.041) **既存コード・UI 文言の「作業ページ」を「ショットページ」に一括置換**（v.040 の階層モデル簡素化に合わせて既存表記も更新）：
  - `laycat_dev.html` 内 57 箇所（コメント／UI 文字列／ツールチップ／エラー案内など）を sed で一括置換。pmboard 側は元々該当なし。
  - **既存プロジェクトデータへの影響**：v.035 でレガシー shot section も既に「ショットページ相当」の UX（サイドバー展開なし・クリックで currentStage review 直行）に統一済みなので、UI 表記の統一だけで既存データもそのまま新モデル通りに見える。データ構造の物理変換は行わない（安全のため）。
  - メモリ [[naming-shot-page]] の「明示指示で一斉置換」条件に合致したための実施。
  - APP_VERSION：2026.09.19.040 → 2026.09.19.041

- (dev v2026.09.19.040) **階層モデルを 2 種（フォルダ／ショットページ）に簡素化**：
  - **背景**：従来「エピソード／ショット／作業ページ」の 3 階層想定だったが、運用実態と合わない。任意深さの**フォルダ**＋末端の**ショットページ**の 2 種に統一。
  - **`_emptyProjectGuide` / `_emptyFolderGuide`**：3 択・可変数の add ボタンを **常に 2 択（フォルダ／ショットページ）** に統一。全レベルで同じガイド。
  - **サイドバー「＋」**：親ノードの位置に関係なく常に 2 択モーダル。in-root/in-episode 判定を廃止。
  - **`openAddModal`**：3-way selector や role 分岐を撤去。常に 2 択（フォルダ／ショットページ）＋既定は「フォルダ」。工程セクション（旧レガシー shot の子 review 群を追加する UI）は DOM 生成は残すが常に非表示。ショットページ作成時は Simple B 単一 review（`currentStage=root.stages[0]`）で作成。
  - **既存 role/kind フィールド**：互換のため残置（旧データの解釈用）。`roleOf`／`ROLE_META` の細分化も内部的には残るが、UI 表示は 2 種で統一。
  - APP_VERSION：2026.09.19.039 → 2026.09.19.040

- (dev v2026.09.19.039) **左サイドバーツリーで複数選択（Ctrl/Shift+クリック）と範囲選択、選択纏め DnD 移動**：
  - **選択**：通常クリック=単一＋ナビゲート／Ctrl・Cmd+クリック=個別トグル＋anchor 更新／Shift+クリック=anchor から現在の表示順で範囲全選択。
  - **視覚**：選択行に `.multi-sel`（薄い青塗り＋左 3px アクセント縦線）。`active`（現在ページ）とは併存可能。
  - **範囲判定**：`renderTreeNode` が `_treeVisibleOrder` に描画順で node id を push。範囲は visible order 上のスライス。
  - **DnD への影響**：ドラッグ元が選択中に含まれる場合、選択全体を表示順で纏めて移動（新親配下 append or 兄弟位置に splice）。含まれない場合は単一。
  - **保存**：既存 DnD 経路と同じく `persist()`（v.033 versions 保護ガード通過）。
  - APP_VERSION：2026.09.19.038 → 2026.09.19.039

- (dev v2026.09.19.038) **左サイドバーのツリーで Maya アウトライナ風の DnD 階層移動を実装**：
  - **操作**：ノードを掴んでドロップ位置を選ぶ：
    - 行の**上 28%**：直前に並べる（`box-shadow` 上ライン表示）
    - 行の**下 28%**：直後に並べる（下ライン表示）
    - 行の**中央 44%**（section 型のみ）：そのフォルダの中に入れる（枠強調＋薄い塗り）
  - **ガード**：
    - プロジェクト root（`parentId===null`）は動かせない
    - 自分自身／自分の子孫への drop は無効（循環防止 `_isDescendantOrSelf`）
    - 別プロジェクト間の移動は禁止（`rootOfId` で判定）
    - フィルタ検索中は DnD 無効（表示ノードだけの部分ビューなので誤操作防止）
  - **移動処理**：`node.parentId` を新親に更新し、`DB.nodes` の順序を splice で再構築（`childrenOf` が DB.nodes の並びを使うため順序管理が必須）。完了後 `persist()`（v.033 のガードで shot.json の versions は保護、レイアウト変更のみ保存）。
  - **視覚**：ドラッグ中の元行は `opacity:.4`、ドロップ位置は accent カラーのラインまたは薄い塗りで表示。
  - APP_VERSION：2026.09.19.037 → 2026.09.19.038

- (dev v2026.09.19.037) **進捗タブの起点フォルダ選択を「配下の全フォルダをプルダウン列挙」に変更、自動検出を廃止**：
  - **背景**：v.036 で拡張した自動検出（EP フォルダ推定）は構造依存で汎用性を欠く、というユーザー判断。ユーザーが明示的にフォルダを選ぶ方式に切替。
  - **`pmProgressParents(root)`**：自動検出ロジック（`kind:'episode'` 判定・孫持ち判定・Simple B 判定）を全て廃止し、`return [root]` の 1 行に簡素化。ユーザーの明示指定（`root.shotsParentIds`）は `shotsParentsOf` 側で従来通り優先されるので、この変更でも既に設定済みのプロジェクトは動作継続。
  - **UI（`renderProjProgress`）**：従来の「ショット親フォルダ：xxx（自動）」表示＋設定ボタンを撤去し、代わりに **フォルダ選択プルダウン**を配置。プロジェクト直下（root）＋配下全 section 型ノードを階層インデント付きで列挙。変更で `root.shotsParentIds=[選択id]` を保存＆再描画。
  - **`hasStages` 判定・ロールヒント表示**は自動検出前提だったので撤去（プルダウン選択の結果でユーザーが自分で把握できる）。
  - **既存プロジェクト**：自動検出だけに頼っていたプロジェクトは、初回ロード時に `pmProgressParents` が `[root]` を返す＝プロジェクト直下扱いに。EP フォルダを使ってた場合はプルダウンから該当 EP を選び直せば復旧。
  - APP_VERSION：2026.09.19.036 → 2026.09.19.037

- (dev v2026.09.19.036) **進捗表示の起点フォルダ（EP）自動検出を Simple B にも対応**：
  - **背景**：v.035 以前は `pmProgressParents` が「孫（工程）を持つ子」だけ EP と見なしていたので、`root → EP → Simple B ショット（review 型・子なし）` 構造では EP が検出できず、手動で `shotsParentIds` 設定が必要だった。
  - **修正**：EP 判定条件を「その子が review 型（Simple B ショット）または孫を持つ section（レガシー shot）」に拡張。両モデル混在プロジェクトでも EP を漏れなく拾えるように。
  - **効果**：新規プロジェクトを Simple B で作って EP フォルダを添えても起点フォルダの手動設定が不要。既存の明示設定（`shotsParentIds` / `shotsParentId`）は引き続き優先。
  - APP_VERSION：2026.09.19.035 → 2026.09.19.036

- (dev v2026.09.19.035) **工程フォルダ概念を UI から削除**（サイドバー・ショット section ページの双方）：
  - **背景**：`arch-hierarchy-shot-stage` メモリの通り「ショットは 1 ページ、工程はプルダウン」方針に完全に寄せる。従来レガシー multi-stage shot は section 直下に review 子ノードが並び、サイドバー展開＝工程一覧、shot section クリック＝工程タイル表示という 3 段階だったが、これを廃止。
  - **サイドバー（`renderTreeNode`）**：レガシー shot container（section 直下が全て review）を検出したら、
    - 配下の工程 review 子は**展開しない**（`kids=[]` にする）
    - アイコンは folder → film に切替（ショット扱い）
    - クリックで `currentStage`（無ければ先頭工程）の review へ直接 `go`
    - バッジは全工程の版数合計を表示
  - **ページ描画（`renderProjectHome` の後段）**：cur が legacy shot container のときは工程タイル（renderSectionBody）ではなく `renderReviewBody(currentStage review)` に自動転送。ショットページが直接開く。
  - **Simple B ショット**（review 型ショット）は無変更で従来通り動作。
  - APP_VERSION：2026.09.19.034 → 2026.09.19.035

- (dev v2026.09.19.034) **REEL クリップタイルをドラッグ＆ドロップで並べ替え可能に**：
  - **追加**：各 `.clip` タイルに `draggable=true` を付与。dragstart で source 記録、dragover でカーソル位置に応じて `reel-drop-before` / `reel-drop-after` インジケータ表示、drop で `reelUI.clips` の splice → 現在再生中クリップの id を追跡して cur 更新 → `reelRender` + `scheduleReelPersist`。
  - **CSS**：`.clip{cursor:grab}` / `:active{cursor:grabbing}` / `.reel-drag-src{opacity:.4}` / drop 位置に `inset box-shadow` で青ライン表示。
  - **互換**：既存の ◀▶ ボタンによる隣接入替は残す。あわせて ◀▶ にも `scheduleReelPersist` を呼ぶよう修正（従来は保存されず F5 で戻っていた副次バグを解消）。
  - APP_VERSION：2026.09.19.033 → 2026.09.19.034

- (dev v2026.09.19.033) **shot.json 保存時にデータ損失防止ガード（A）と自動バックアップ（B）を追加**（v.029/v.030 事故の再発防止・コード級フェイルセーフ）：
  - **背景**：v.029/v.030 で `persist()` が全 REG プロジェクトの shot.json を空 versions で上書きし、動画メタ・FB・レビュー履歴を全消失させた事故を受け、CLAUDE.md／メモリの運用ルールだけでなくコード側にも物理的な安全網を追加。
  - **A. `_shotSaveGuardWarn(pid,sid,newFile)`**：`_saveShotWithLock` の書込み直前で、既存 shot.json の各 review ノードと新ペイロードを比較。`versions.length` が減少（特に N>0 → 0）または review 自体が消えている場合は **書込みを拒否**。console.error + toast で通知。呼び出し元には `{ok:false, guardBlocked:true, warnings:[...]}` を返す。
  - **B. `_shotSaveBackup(pid,sid)`**：`_saveShotWithLock` の書込み直前に、既存 shot.json 全体を `shots/backup/{sid}.bak.json` にコピー。1 shot 1 ファイル（毎回上書き）で容量非圧迫、直前の書込み前状態が常に手元にある。事故時は `.bak.json` を手動リネームすれば復旧可能。ベストエフォート（バックアップ失敗しても save 本体は続行）。
  - **配置**：`_saveShotWithLock` の 3-way マージ後 → nextRev 決定後 → **ガード（A）**→ 通過なら**バックアップ（B）**→ `storage.saveShot` の順。
  - **影響範囲**：既存の正常な保存フローには影響なし（versions が保持される限り透過）。書込み拒否は明示的なデータ損失を伴う save のみ発火。
  - APP_VERSION：2026.09.19.032 → 2026.09.19.033

- (dev v2026.09.19.032) **hotfix：`renderTreeNode` で `node.versions` が undefined のとき `TypeError: Cannot read properties of undefined (reading 'length')` で全画面が起動失敗する不具合**：
  - **症状**：boot → applyHash → render → renderSidebar → renderTreeNode の経路で「起動に失敗しました: Cannot read properties of undefined (reading 'length')」がトースト表示され、動画も UI も何も出ない。
  - **原因**：review 型ノードで `.versions` が初期化されないケース（旧データ・v.029 系の参加処理で読み込んだノード等）があり、renderTreeNode の `node.versions.length` が undefined 参照でクラッシュしていた。
  - **修正 A（表示側の防御）**：`renderTreeNode` を `Array.isArray(node.versions)` チェックしてから `.length` を読むように変更。undefined でも 0 として扱い、クラッシュしない。
  - **修正 B（正規化）**：`normalizeNodes` で `n.type==='review'` のノードに対し `n.versions=[]` と `n.comments=[]` を必ず配列で保証。以降の全経路（読込・マージ・破損データ）で安全側に初期化。
  - APP_VERSION：2026.09.19.031 → 2026.09.19.032

- (dev v2026.09.19.031) **v.029／v.030 の「共有トップ 1 回指定・参加可能プロジェクト一覧」機能を revert**：
  - **理由**：ネットワークドライブを IP 直指定（`\\192.###.###.###\...`）で picker に渡すと Windows が「このプログラムを使用してこの場所を開けません」で拒否。ドライブレター割当を強いる運用は本来の "picker 不要化" の趣旨と噛み合わないため、機能ごと撤収。
  - **revert 対象**：storage の `getRootHandle` / `setRootHandle` / `clearRootHandle` / `scanRootProjects` / `_resolveFromRoot`、`projRoot` と `hasFolderConfigured` のフォールバック追加、REG エントリの `folderPath` / `folderName` 追加、ホーム画面の「🔗 共有フォルダ…」ボタンと「共有フォルダ配下のプロジェクト」セクション、`openSharedRootModal`、`_renderSharedProjectsSection`、member 抽出／フィルタロジック。すべて v.028 の状態に戻す。
  - **副作用なし**：v.028 以前のプロジェクトデータや REG は無変更。既存の個別 handle 登録は影響を受けない。IDB `handles/root_top` が過去に保存されていた場合は無害な残置（今後の read はされない）。
  - APP_VERSION：2026.09.19.030 → 2026.09.19.031

- (dev v2026.09.19.028) **ショットページ右カラムの順序を「使用アセット → PMMEMO → NOTE」に変更**（ユーザー要望）。APP_VERSION：2026.09.19.027 → 2026.09.19.028

- (dev v2026.09.19.027) **メッセージ／動画に付く工程バッジがヘッダのプルダウン選択と一致しない不具合を修正**：
  - **症状**：レガシー multi-stage ショットでメッセージ送信・動画アップロードすると、常に先頭工程（例：LAY）のバッジが付き、ヘッダのプルダウン（例：anm_sec）と食い違っていた。
  - **原因**：投稿／アップロード時のタグ付けが `getShotCurrentStage(cur)` を呼んでいたが、レガシーでは `currentStage` は shot section にしか無いため review 側では未定義 → `root.stages[0]` にフォールバックしていた。
  - **修正**：新ヘルパ `getShotStageForTag(cur)` を追加。レガシー shot container なら `cur.name`（今表示している review 名＝現在工程）、Simple B なら `getShotCurrentStage(cur)` を返すよう場合分け。`shotCommentInput` の投稿処理と upload の 3 か所（`version.stage` / upload comment `_cm.stage` / 連番 upload の `version.stage`）を `getShotStageForTag` に差し替え。
  - APP_VERSION：2026.09.19.026 → 2026.09.19.027

- (dev v2026.09.19.026) **PMMEMO を「ショットページ内での操作」でも再読込するように**：
  - v.025 では初期表示（render 時）だけで、NOTE 入力・動画再生など render を伴わない操作では PMMEMO が最新化されなかった。
  - `buildShotPmMemoPane` に `#scroll` の `pointerdown` / `keydown` リスナーと `visibilitychange`（visible）リスナーを追加。300ms debounce で `notes/{sid}.json` を再読込。パネルが DOM から外れたら次回イベントでリスナー自動解除。
  - APP_VERSION：2026.09.19.025 → 2026.09.19.026

- (dev v2026.09.19.025) **ショットページ右カラムに PMMEMO 欄を追加**（pmboard の SHOT メモを読取表示）：
  - **背景**：pmboard で書いた SHOT メモを LayCAT のショットページからも見られるようにしたい、というユーザー要望。
  - **配置**：右カラムの上から「**PMMEMO → 使用アセット → NOTE**」の順に。`buildShotPmMemoPane(container,shot,root)` を実装。
  - **データ**：`notes/{shotSectionId}.json`（pmboard v.026 で導入したファイル）を `_loadShotPmMemo` で非同期読取り。memo フィールドを `white-space:pre-wrap` で表示。空／未記入時は「（メモは未記入）」のイタリック薄色 placeholder。
  - **編集**：LayCAT 側は **閲覧のみ**（書込みは pmboard 側に集約、双方の書込み競合を避ける）。
  - **shot ノード解決**：既存の `_hdrIsLegacyContainer` を再利用（レガシー shot section なら shotSec、Simple B なら cur 自身）。pmboard 側 `saveShotMemo` は shot section の id で書くので、この解決で一致する。
  - APP_VERSION：2026.09.19.024 → 2026.09.19.025

- (dev v2026.09.19.024) **REEL タイムスライダのズーム中、再生バーが範囲外に出たら追従スクロール**：
  - **背景**：v.021 で `.ftl` にホイールズームを入れたが、拡大したまま再生していると再生バーが可視範囲を出て見えなくなる。追いかけて欲しいというユーザー要望。
  - **実装**：`drawFTL` 冒頭で「ズーム中 かつ 再生中 かつ スクラブ／パン中でない」ときに、プレイヘッド `gOffset(reelUI.cur)+dispF()` の位置を判定。右端を超えていたら `ftlStart=playFrame-visible*0.05` で先頭寄せ（ページ送り）。左端より前なら同様に頭を合わせる（seek で戻したときも自然に追従）。
  - **配慮**：`RV.scrub` / `_ftlPan` が真のときはユーザー操作を優先して自動追従を止める。全体表示（zoom=1）のときは何もしない。
  - APP_VERSION：2026.09.19.023 → 2026.09.19.024

- (dev v2026.09.19.023) **「🔊 音が出ないときは…」のタブミュート解除ヒントを廃止**：`_maybeShowTabMuteHint` を no-op に変更。fb ビューア／REEL 双方の呼び出し箇所からトーストが出なくなる。呼び出し側コードはそのまま残置（今後同種の通知を復活させる余地）。APP_VERSION：2026.09.19.022 → 2026.09.19.023

- (dev v2026.09.19.022) **REEL タイムスライダの中ボタンドラッグで横パンできるように**：
  - v.021 でズームを実装したが、ズーム中に見たい範囲が横にずれたときの移動手段が dblclick リセット→再ズームしかなかった、というユーザー要望。
  - `.ftl` の pointerdown で `e.button===1`（中ボタン）を検知したらスクラブに入らずパンモード開始。開始時の cursor X と ftlStart を保存し、pointermove で `dx/W*visible` 分だけ `ftlStart` を逆方向に更新（コンテンツを掴んで動かす感覚）。pointerup でパン終了、`releasePointerCapture` で解除。カーソルは `grabbing` に切替。
  - 左ボタン（button===0）は従来どおりスクラブ動作を維持。
  - Windows の中クリックオートスクロール抑止のため `auxclick` も preventDefault。
  - APP_VERSION：2026.09.19.021 → 2026.09.19.022

- (dev v2026.09.19.021) **REEL タイムスライダ（`.ftl` キャンバス）にホイールズームを追加**：
  - **背景**：クリップ数が多いとスライダ上の目盛り・マーカー・プレイヘッドが密集して細かい位置合わせが困難。中ボタンくるくるで拡大縮小したいというユーザー要望。
  - **ズーム状態**：`ftlZoom`（1=全体表示、最大 40）、`ftlStart`（左端の全体フレーム位置）を openReel の閉包に保持。
  - **描画**：`drawFTL` を可視範囲ベースに書き換え。`_gx(g)=(g-ftlStart)*fw` ヘルパで全描画（クリップ矩形／フレーム目盛り／FPS 目盛り／ノートマーカー／pending/drafts／キャッシュ帯／再生範囲／プレイヘッド）を全体フレーム→画面 X に変換。`fw=W/visible`。
  - **スクラブ**：`gFromX` も `ftlStart+(x/W)*visible` に更新。ズームインしても正確にシークできる。
  - **入力**：`.ftl` の wheel イベントで `deltaY<0`＝ズームイン、`>0`＝ズームアウト。カーソル位置のグローバルフレームを中心に維持。`{passive:false}` で `preventDefault`。
  - **リセット**：`.ftl` ダブルクリックでズームを全体表示に戻す。
  - APP_VERSION：2026.09.19.020 → 2026.09.19.021

- (dev v2026.09.19.020) **REEL タイムラインをマウスホイール（中ボタンくるくる）で横スクロール**：
  - v.019 は中ボタン **ドラッグ** で実装したが、ユーザー要望は「くるくる（ホイール）」だったので変更。
  - `.tlwrap` の `wheel` イベントで `deltaY` を `scrollLeft` に流し込む（`Math.abs(dy)>Math.abs(dx)` のときのみ縦→横変換、水平方向 delta 主体のトラックパッド操作は既定挙動保持）。`preventDefault` 用に `{passive:false}`。
  - 中クリック自体は Windows のオートスクロールカーソル抑止のため `mousedown` / `auxclick` で `preventDefault`。
  - v.019 の中ボタンドラッグロジックは撤去。
  - APP_VERSION：2026.09.19.019 → 2026.09.19.020

- (dev v2026.09.19.019) **REEL タイムラインを中ボタンドラッグで横スクロール可能に**：
  - REEL 下部のクリップタイル帯（`.tlwrap`）を「タイムライン」と呼称。中クリック（button===1）押下 → mouse move で `scrollLeft` を更新するドラッグスクロールを実装。押下時 `preventDefault` で Windows のオートスクロールカーソルを抑止、`auxclick` も抑制。押下中は `cursor:grabbing` に切替。
  - APP_VERSION：2026.09.19.018 → 2026.09.19.019

- (dev v2026.09.19.018) **REEL 側の Shot メニューにも「全ショット通し確認」項目を追加**：
  - v.017 ではショットタブのヘッダにボタンを置いたが、REEL 画面を開いたまま追加もしたいというユーザー要望。
  - REEL iframe 内 Shot メニューに `▶ 全ショットを通し確認（最新動画を追加）` を追加。押下で `reelUI.projectId` から `rootOf` してその root を `reelAddAllShots` に渡す。プロジェクト束縛が無い場合はトースト警告。
  - APP_VERSION：2026.09.19.017 → 2026.09.19.018

- (dev v2026.09.19.017) **全ショットの最新動画をショット順に REEL で通し確認する機能を追加**（全体確認用）：
  - **背景**：プロジェクト全体の最新カットを一気に流し見したい、というユーザー要望。
  - **追加**：ショットタブのヘッダに「▶ 全ショットを REEL で通し確認」ボタン。`reelAddAllShots(root)` を実装。`shotsOf(root)`（ショットタブと同じ並び）を走査、各ショットの `latestVideoVersionUnder` を取得して順に `reelAddClip`。動画なしのショットは静かにスキップ、件数をトースト通知。
  - APP_VERSION：2026.09.18.016 → 2026.09.19.017

- (dev v2026.09.18.016) **アセットタブにユーザー定義カテゴリを追加**（キャラ／BG／プロップなど自由に分類）：
  - **データ**：`root.assetCategories = [{id,name}]` を新設。順序＝表示順。`asset.categoryId` でアセットが参照する。カテゴリ未指定・削除済みカテゴリを参照するアセットは「未分類」セクションに集約。
  - **タイル表示**：カテゴリごとにセクション化。見出しバー（カテゴリ名＋件数＋操作）と `border-bottom` の区切り線で視覚的に分離。空カテゴリも表示（プレースホルダ）。
  - **カテゴリ操作**：セクション見出しに「名前変更／↑／↓／削除」ボタン。削除時は配下アセットが未分類に移動（アセット自体は消えない）。並び替えは配列順を直接操作。ヘッダ右に「＋ カテゴリ追加」を追加（prompt で名前入力）。
  - **詳細ドロワー**：「名前」の下に「カテゴリ」プルダウンを追加。既存カテゴリ／未分類／「＋ 新規カテゴリを作成…」の 3 種。プルダウンから直接新規作成もできる。
  - **ヘルパ**：`getAssetCategories` / `getAssetCategory` / `createAssetCategory` / `renameAssetCategory` / `deleteAssetCategory` / `moveAssetCategory` を追加。`createAsset` に `categoryId:null` を初期セット。既存アセットは categoryId が無いので自動的に「未分類」表示。
  - **タイル生成の共通化**：以前インラインだったタイル DOM 組立を `_buildAssetTile(a,root)` に切り出し。
  - APP_VERSION：2026.09.18.015 → 2026.09.18.016

- (dev v2026.09.18.015) **他ユーザーの status 変更が autoRefresh で反映されない不具合を修正**（F5 が必要だった件）：
  - **原因**：`refreshFromFolders` → `readProjectData` 内で `_hydrateStatuses` が `remote.nodes[*].status` を最新 status.json から埋め直しているが、続く `_unionRemoteIntoDB` の scalar マージループが status キーを意図的に除外（v.056 D-5 の「status.json が権威源」との判断）。この設計だと F5（`loadProject` で parsed が DB になる経路）でしか status が反映されない。
  - **修正**：`refreshFromFolders` の `clean` 分岐で、`remote.nodes` → `DB.nodes` へ status を明示的に同期する処理を追加。null/'' への「未着手戻し」も authoritative なので remote 側にキーがあれば尊重、remote 側でキーが消えていれば DB も未着手に戻す。
  - **影響**：ショット単位ステータス（v.014）／レガシー review ステータスの両方で、他ユーザー変更が autoRefresh の 30 秒ポーリング（またはタブ復帰時）で反映されるようになる。
  - APP_VERSION：2026.09.18.014 → 2026.09.18.015

- (dev v2026.09.18.014) **ステータスを「ショット単位」に統一（レガシー multi-stage ショットも 1 ショット 1 ステータスに）**：
  - **方針**：ショットは 1 個のステータスで管理。工程ごとに分けない。「そのショットは 1 つなので工程で分ける必要がない」というユーザー方針。
  - **データレイヤ**：既存の `status/{sid}.json` 分離を維持（shot.json 埋め込みには戻さない）。レガシー shot section も同スキーマで `status/{shotSectionId}.json` を持てるように。`nodeStatus(node)` にショット section の明示 status 短絡を追加（`if(node.type==='section'&&node.status)return node.status`）→ 子（review 工程）の集約より優先。
  - **書込パス**：`buildFullReviewPage` のヘッダ・ステータスプルダウンの対象を、`_hdrIsLegacyContainer ? shotSec : cur` に変更。ショットタブのタイル／リストのステータスバッジ／インラインプルダウンも `sh`（ショット自身）を対象に統一。
  - **マイグレーション**：起動時に `_migrateShotLevelStatusFromCurrentStage(pid)` を実行。各レガシーショットについて `sh.status` が未設定なら、`sh.currentStage` が指す工程 review の status を setStatus 経由でショット section 側にコピー（audit source: `migrate-shot-level`）。currentStage 未設定や現工程未着手は skip（副作用なし・idempotent）。件数分だけトーストで通知。
  - **旧 `status/{reviewId}.json` の扱い**：残置（読取フォールバック用）。後日別ステップで削除する予定（β 方針）。
  - **pmboard 側**：この変更で LayCAT 側は 1 ショット 1 ステータスになるが、pmboard 側の表示は未対応。pmboard の hydrate はショット section の status もそのまま `.status` に載るため、既存の nodeStatus 系がショット section を読むように pmboard を追加更新する必要がある（別途相談）。
  - APP_VERSION：2026.09.18.013 → 2026.09.18.014

- (dev v2026.09.18.013) **ログ右上の工程バッジ（現在工程）の文字が背景と同色で見えない不具合を修正**：
  - **原因**：CSS で `.log-stg-badge.cur{background:currentColor;color:var(--bg)!important}` としていたが、`currentColor` は上書き後の `color` を参照する（`!important` の `color:var(--bg)` に置き換わった後の値）ため、背景も文字も同じ暗色（`var(--bg)`）になっていた。
  - **修正**：CSS 側の色指定を廃止し、JS 側で inline に `if(isCurrent){badge.style.background=color;badge.style.color='var(--bg)'}` と明示セット。他工程は従来どおり枠のみ＋工程色文字。
  - APP_VERSION：2026.09.18.012 → 2026.09.18.013

- (dev v2026.09.18.012) **ログの工程バッジのクリック（switchStageInTab による別工程ページへの差替）を廃止**：
  - **背景**：バッジをクリックすると別工程ページに差し替わり、スクロール位置が保持されて中途半端な位置に見える不便があった。ユーザー要望で「工程ページに飛ぶ動線」を消すことに。
  - **修正**：`if(hasSiblings){ badge.onclick=... }` ブロックを削除。CSS の `.log-stg-badge` から `cursor:pointer` を外し `pointer-events:none` を追加してホバーもクリックも起きないように。バッジは表示のみで機能を持たないラベルに。
  - **影響**：レガシー多工程ショットでもバッジ経由の遷移は不可に（Simple B ではもともとバッジは非クリック）。工程切替は右スライドの工程プルダウンや作業タブ経由でのみ行う。
  - APP_VERSION：2026.09.18.011 → 2026.09.18.012

- (dev v2026.09.18.011) **ショットページのログ：他工程アイテムの透過（.other-stage → opacity .72）を廃止**：
  - **背景**：Simple B モデルで v.stage タグが焼き付けられているため、工程プルダウンで切替すると過去の動画が「他工程」判定になって暗く表示される、というユーザー指摘。
  - **修正**：`.log-item.other-stage` の opacity ルール 2 行を削除し、`itemEl.classList.add('other-stage')` の付与も除去。工程の区別は右上バッジのみで行い、動画そのものは常にフル明度で表示。
  - APP_VERSION：2026.09.18.010 → 2026.09.18.011

- (dev v2026.09.18.010) **動画log-headの「⬇ アノテ込み書出」右にあるゴミ箱ボタンと工程バッジの重なりを解消**：
  - `.log-item:has(.log-stg-badge) .log-head { padding-right:96px }` を追加。工程バッジ（`position:absolute;top:8px;right:8px`）がある行だけヘッダ右にバッジ幅ぶんの余白を確保して、右端に並ぶ操作ボタンとの重なりを防ぐ。
  - APP_VERSION：2026.09.18.009 → 2026.09.18.010

- (dev v2026.09.18.009) **ショットページ「使用アセット」ヘッダから 🧩 絵文字を削除**（ユーザー要望）。テキストは「使用アセット」のみに。APP_VERSION：2026.09.18.008 → 2026.09.18.009

- (dev v2026.09.18.008) **アセット詳細ドロワーの変更をタイル／ショットページに即反映**：
  - **背景**：右スライドでサムネを設定してもアセットタブのタイル・ショットページの使用アセットパネルに反映されない、というユーザー指摘。ドロワー内のみ `fillAssetDrawer()` で再描画していたため。
  - **修正**：サムネ登録／削除／使用ショット追加／解除の各ハンドラで `fillAssetDrawer()` を `render()` に差し替え。`renderBody` が `state.drawer` を検知して `fillAssetDrawer` を再実行するので右スライドは開いたまま新しいサムネで再構築される。
  - APP_VERSION：2026.09.18.007 → 2026.09.18.008

- (dev v2026.09.18.007) **ショットページ右カラム（NOTE の上）に「使用アセット」パネルを追加**：
  - **UI**：`buildShotAssetsPane(container,shot,root)` を実装。`shot.assets[]` の各アセットをサムネ 16:9 タイル＋名前で `auto-fill minmax(88px,1fr)` グリッド表示。件数バッジ付きヘッダ「🧩 使用アセット (n)」。空状態は「紐付けなし。アセットタブから設定できます。」
  - **タイル動作**：クリックで `openAssetDrawer(a.id)` → 右スライドでアセット詳細を開く。紐付け編集はアセットタブ側に集約し、ショットページ側は閲覧＋詳細遷移のみ（責務分離）。
  - **配線**：`buildFullReviewPage` の `if(noteCol){ buildTaskNotePane(...) }` 直前に、shot ノード（legacy container なら shotSec、Simple B なら cur）を渡して `buildShotAssetsPane` を呼ぶ。
  - APP_VERSION：2026.09.18.006 → 2026.09.18.007

- (dev v2026.09.18.006) **アセットタブを新設**（プロジェクトタブ「ショット」の右）：
  - **用途**：3D モデル・素材などの外部アセットを LayCAT 側で登録し、どのショットで使うかを紐付ける。
  - **データモデル**：`root.assets = [{id,name,folderPath,thumb,memo,usedInShots,createdAt,updatedAt}]` を新設。ショット側にも `shot.assets = [assetId]` を持たせ、双方向で同期（`assetLink` / `assetUnlink` / `deleteAsset` で常に両側を更新）。
  - **保存方針**：**アセット実体は LayCAT プロジェクトフォルダに含めない**。`folderPath` に外部フォルダの絶対パスをテキストで保持するだけ。サムネのみ既存の `storage.putMedia('thumbnails',...)` 経路に流し、他 thumb と同じ `resolveThumbs` で表示。
  - **UI**（アセットタブ）：ショットタブと同じ `pm-grid` / `pm-tile` を流用。ヘッダに件数チップ＋「＋ アセット追加」ボタン。タイル本体クリックで詳細ドロワーを開く。空状態は「アセットがありません。右上の "＋ アセット追加" から作成してください。」
  - **詳細（右スライドドロワー）**：`kind:'asset'` を追加し、`buildDrawerShell` を再利用。名前（インライン編集）／サムネ（画像アップロード・削除）／フォルダパス（テキスト＋コピー）／メモ（textarea）／使用ショット（チップ表示、× で解除、プルダウンで追加）。`fillDrawer` に asset 分岐を追加。
  - **タブ配線**：`VALID_TABS` に `'assets'` を追加（`buildProjectTabsHead` / hash パーサ / 検証 3 箇所）、タブ配列の `ショット` の右に `['assets','アセット']` を挿入。`renderProjectHome` のルーティングに `renderProjAssets` 分岐を追加。
  - **URL ハッシュ同期**：v.006 段階では詳細ドロワーの hash 保存は未対応（asset kind は syncHash 側に未接続）。タブ選択の hash 同期は既存 `VALID_TABS` 経由で自動対応。
  - APP_VERSION：2026.09.18.005 → 2026.09.18.006

- (dev v2026.09.18.005) **hotfix：v.004 でヘッダ書き換えを追加した際、同じ関数内で既に宣言済みの `_shotKids` を再宣言してしまい `SyntaxError: Identifier '_shotKids' has already been declared` で全画面が真っ白になる不具合を修正**。新規変数を `_hdrShotKids` / `_hdrIsLegacyContainer` / `_hdrShotName` にリネームして衝突解消。挙動は v.004 と同じ。

- (dev v2026.09.18.004) **作業ページ左上のヘッダを「ショット名 + 現在工程プルダウン」に再構成**：
  - **背景**：ユーザー要望「ショット名テキストを配置してその右に工程プルダウン」。あわせて（a）プルダウンを一度開いてカーソルを外に出すと白く抜ける、（b）プルダウンの選択肢テキストに `— ステータス` が付いていて冗長、の 2 点も同時に修正。
  - **h1 構成の再構築**（`buildFullReviewPage` 冒頭）：
    - `.tt-shot-name`（ショット名テキスト）を先に追加 → 続いて `stageSwitcher`（工程プルダウン）を右に配置。
    - ショット名の判定：レガシー shot container（`type=section` で直下が全て `review`）なら親 section の name、Simple B（cur 自身が review＝ショット）なら `cur.name` を採用。
    - プルダウン非表示ケース（工程 1 つのみ）は工程名テキスト（`.tt-stage-name`）をショット名の右に併記。
  - **プルダウン選択肢を工程名のみに**（`buildStageStripInline` レガシー分岐）：`r.name + ' — ' + st.label` → `r.name`。ステータスは同じヘッダ内の別バッジ／別プルダウンで既に表示されているため二重。
  - **白抜けバグ修正**（`.stage-strip-inline .ss-sel`）：`background:transparent` を廃止し、通常状態から `var(--bg2)` を明示。`:hover / :focus / :active` は `var(--bg3)`。Windows Chrome で `<select>` を開いてカーソルが要素外に出ると、透過越しに OS デフォルトの白背景が露出していたのを解消。
  - APP_VERSION：2026.09.18.003 → 2026.09.18.004

- (dev v2026.09.18.024) **工数タブの表示単位を「時間（h）」から「日（日）」に変更**：
  - **背景**：ユーザー要望「何日動いてるかがみたい」。作業区間の総和を h ではなく日で見せた方が、「このショットは何日かけて進行中か」を直感的に把握できる。
  - **修正**：`renderEffortPane()` 内の `hours = totalMs / 3600000` を `days = totalMs / 86400000` に変更。変数名 `hours` → `days`、フォーマッタ `fmtHours` → `fmtDays`、単位表記 `h` → `日` に統一。
  - **表示**：総稼働日数 / 平均 per shot / 最長ショット / ショット数（統計カード）、およびリストの数値表記をすべて「◯.◯日」形式（1 桁小数固定）。
  - **セクション見出し**：「ショット別稼働時間（長い順）」→「ショット別稼働日数（長い順）」に変更。
  - **算出方式は据え置き**：`workSegments[]` の合算という定義は同じで、単位換算だけを変えた（1 日 = 24h 相当）。
  - APP_VERSION：2026.09.18.023 → 2026.09.18.024

- (dev v2026.09.18.023) **工数タブを実データで実装**：ステータス履歴の作業区間から自動算出し、ショット別合計時間を降順表示。冗長ショット検出用。
  - **算出**：各ショットの各工程の `workSegments[]`（`{start, end}`）を舐めて `(end - start)` を合算。end が null（作業中）の場合は今日まで。単位は「時間（h）」。
  - **集計単位**：ショットごとの合計時間。工程は現在工程のラベルを併記。
  - **並び**：時間降順（冗長度の高いショットが上位）。
  - **統計カード**：総稼働時間 / 平均 per shot（稼働ショットのみで計算） / 最長ショット（ショット名付き） / ショット数。
  - **リスト**：ショット名＋現在工程バッジ / 進捗バー（最長ショットを 100% とした比率） / 時間表示（1 桁小数）。
  - **リロード**：loadAndRender 完了時に `renderEffortPane()` を呼ぶ。
  - APP_VERSION：2026.09.18.022 → 2026.09.18.023

- (dev v2026.09.18.022) **ズームで実際に日付密度を変える（タイムラインを未来方向に延ばす方式）**：
  - **v.021 の行密度アプローチは無意味だと指摘**：ショットが縦に詰まっても意味が無い、日付の密度が変わらないと。
  - **修正**：
    - **CSS の行密度変化を削除**（元の 34px 行に戻す）
    - **タイムラインを scale に応じて未来に延長**：pane を必要日数（`paneInner / SCALE_PX[scale]`）で埋められるように、`DATA.timeline.days` と `.end` を書き換え。元の日数は `_baseDays` にキャッシュしておき、モード切替の基準に。
    - **`.gantt` 幅 = `shotColW + effectiveDays × SCALE_PX[scale]`**：常にペイン下限を満たし、必要なら横スクロール。
  - 結果：
    - **日**：40px/日 × baseDays（30日なら 1200px）。ペイン超えなら横スクロール。日付が広く見える。
    - **週**：20px/日 × effectiveDays（ペインが 1000px なら 50 日分）。バーは baseDays の範囲内で表示、右側は未来の空日付。日付密度中程度。
    - **月**：8px/日 × effectiveDays（ペインが 1000px なら 125 日分）。日付がずらっと並び全体俯瞰しやすい。
  - APP_VERSION：2026.09.18.021 → 2026.09.18.022

- (dev v2026.09.18.021) **ズームで「ページの中で小さくなるだけ」問題を解消。ペイン下限は復活させつつ、行密度で視覚差を出す**：
  - **原因**：v.020 の「常に日数×スケール px」で幅を決めるアプローチでは、週／月モードで gantt が pane より狭くなり、**右側に空白**ができて「小さくなるだけ」の不快感が出ていた。
  - **修正**：`finalW = max(paneInner, targetPx)` に戻して常にペイン下限を保証。**日モードは data 量が多い時に自動で横スクロール**、週／月モードは常にペインを埋める。
  - **視覚差の作り方**を横幅ではなく **行密度** に変更：
    - **月モード**：行高 22px、実績／予定バー 8px 高さ、日ラベル非表示 → **多くのショットが 1 画面で見える**（全体俯瞰用）。
    - **日モード**：行高 44px、バー 14px 高さ、日ラベル大きめ（`data-scale="day"` セレクタで CSS 制御）。
    - 週モード：デフォルト 34px 行（従来）。
  - APP_VERSION：2026.09.18.020 → 2026.09.18.021

- (dev v2026.09.18.020) **ズームでペイン幅への clamp を廃止し、常に「日数 × スケール px」で幅を決定**：
  - **原因**：v.018 では `finalW = max(paneInner, targetPx)` としていたので、週／月モードで `targetPx < paneInner` の場合、pane 幅にクランプされて視覚的にデフォルト（週）と同じになっていた。console ログの `finalW: 1065` = paneInner に張り付いていた。
  - **修正**：`finalW = shotColW + max(200, trackPx)` に変更。ペインより小さくなる時は右側に余白ができるが、その代わり週／月モードで **バーの見た目が実際に縮む**（bars は % ベースで .gantt の幅に追従）。
  - 最小トラック 200px の下限を残し、`月モード × 短い timeline` で異常に細くなるのを防止。
  - APP_VERSION：2026.09.18.019 → 2026.09.18.020

- (dev v2026.09.18.019) **工程ズーム デバッグログ + window 公開**：applyGanttScale に console.log を仕込み、`window.applyGanttScale` として公開。原因特定用。 (2026.09.18.018 → 019)

- (dev v2026.09.18.018) **ズームを CSS `max()` から JavaScript の inline pixel width に切替（確実に幅が変わるように）**：v.016〜v.017 は CSS の `min-width` / `width:max(100%, calc(...))` を使っていたが、環境によって幅が変化しない事象があった（原因不明・CSS 変数と `max()` の相互作用による可能性）。
  - **修正**：`applyGanttScale()` で `pane.clientWidth - 40px（padding 分）` と `shot-col-w + SCALE_PX × days` を比較し、大きい方を **pixel 値の `gantt.style.width` として直接設定**。CSS の間接参照を排除。
  - `window.resize` イベントでも幅を再計算するので、ウィンドウ幅変化にも追従。
  - APP_VERSION：2026.09.18.017 → 2026.09.18.018

- (dev v2026.09.18.017) **ズームが効かなかった問題を修正（min-width の適用先変更）**：v.016 は `.gantt-hdr` と `.gantt-body` の 2 箇所に `min-width` を付けていたが、ブラウザによってはグリッドコンテナへの min-width が期待どおりに拡張されず、日／週／月を押しても実際の幅が変わらなかった（ヘッダの文字サイズだけ変化）。
  - **修正**：`.gantt` 自身に `width: max(100%, calc(var(--shot-col-w) + var(--track-min-w)))` を設定。子要素（.gantt-hdr / .gantt-body / .gantt-row）はブロック要素として自動追従。
  - APP_VERSION：2026.09.18.016 → 2026.09.18.017

- (dev v2026.09.18.016) **日 / 週 / 月 のズーム機能を実装**：
  - ヘッダの「日 / 週 / 月」ボタンをクリックすると Gantt の 1 日あたり幅を切替：
    - **日**：40px/day（詳細ビュー、1〜2 週間分にフォーカス）
    - **週**：20px/day（デフォルト・従来）
    - **月**：8px/day（月単位で全体を俯瞰）
  - **実装**：CSS 変数 `--track-min-w = SCALE_PX × days` を `.gantt` にセットし、`.gantt-hdr` / `.gantt-body` の `min-width` を `calc(ショット列幅 + トラック最小幅)` に。バーの `left`/`width` は % ベースのままなのでコード変更なしで縮尺追従、はみ出しは `.pane` が横スクロール。
  - **ヘッダ密度**：月モードは日セルの数字を非表示にして幅を稼ぐ（`data-scale="month"` セレクタで制御）。日モードは日セルの文字を大きめに。
  - **ヘッダ Shot ラベルを sticky-left 化**：横スクロール時も左端に固定。
  - **設定保存**：`localStorage['pmboard_scale']` に保存、次回リロードで復元。
  - APP_VERSION：2026.09.18.015 → 2026.09.18.016

- (dev v2026.09.18.015) **スクロール時の日付ヘッダ上の隙間解消 + ショット列の幅をドラッグでリサイズ可能に**：
  - **日付ヘッダの上の隙間**：`.pane` の `padding:16px 20px` によって sticky が padding-top 分下がって浮いていた。padding を `0 20px 16px` に変更し、pane の擬似要素 `::before` で 16px スペースを描く（スクロールで一緒に流れて消える）。これで sticky ヘッダが pane の viewport top ぴったりに固定される。
  - **ショット列リサイズ**：CSS 変数 `--shot-col-w`（default 220px）で列幅を管理。`.gantt-hdr` の `.lbl`（Shot ラベル）に `.col-resizer` を追加、ドラッグで CSS 変数を更新（120px〜520px）。TODAY マーカ計算も CSS 変数対応。設定は `localStorage['pmboard_shotColW']` に保存され、次回リロードで復元。
  - APP_VERSION：2026.09.18.014 → 2026.09.18.015

- (dev v2026.09.18.014) **pmboard からショットのステータス変更ができるように + 日付ヘッダのスクロール固定**：
  - **ステータス変更**：ショット行の「現在の工程」チップの隣に「現在のステータスチップ」（色付き pill）を追加。クリックで status メニュー → 選択で LayCAT と同じ `status/{stageId}.json`（v:1 スキーマ）に書き込み。書き込む source は `'pmboard'`、`history[]` を append、`_rev++`。メモリ側の `st.currentStatus` / `st.isDone` / `st.history` も同期更新して即再描画。
  - **未設定 → 未設定に戻す**メニュー項目もあり、null で書き戻せる。
  - **スクロール時の日付ヘッダ固定修正**：`.gantt` が `overflow:hidden` だったせいで `.gantt-hdr` の `position:sticky` が `.gantt` 自身に効いてしまい、`.pane` の縦スクロールで日付が上に隠れていた。`overflow:visible` に変更して sticky が `.pane` の viewport top に対して効くように。
  - APP_VERSION：2026.09.18.013 → 2026.09.18.014

- (dev v2026.09.18.013) **担当者ドーナツの解決ロジックを 3 段フォールバックに強化**：
  - **原因**：v.012 は「現在の工程の `assignee`」だけを見ていた。ユーザーは全ショットに担当を振ってあるはずなのに「未割当」が残るとのフィードバック。ショット単位に振っている、または他工程に振っているケースを取りこぼしていた。
  - **修正**：`resolveShotAssignee(shot, cur)` を追加し、優先順位付きで担当を解決：
    1. 現在の工程の `assignee`（最も具体的）
    2. shot section 自身の `assignee`（ショット単位で振っている場合）
    3. 何らかの工程の `assignee`（工程ごとにばらばらでも拾う）
  - **デバッグログ**：未割当と判定されたショットがあれば `[pmboard] unassigned shots:` を console に出力。ショット名・現在工程・現在工程 assignee・section assignee・全工程 assignee を含む。実データの原因特定用。
  - APP_VERSION：2026.09.18.012 → 2026.09.18.013

- (dev v2026.09.18.012) **サイドバーに「担当者分布」ドーナツを追加**：
  - 各ショットの「現在の工程」の assignee を集計してドーナツ＋表で表示。「担当の割合が確認したい」というニーズに対応。
  - **メンバー色**：`root.members[i].color` を優先。未指定なら名前ハッシュから 10 色パレット（`#4a90d9` 等）で割当。
  - **未割当バケット**：assignee が未設定のショットは「未割当」（グレー）で末尾に。
  - **工程フィルタと連動**：工程分布ドーナツクリックで `stageFilter` が入っている時は「その工程を現在工程とするショットの担当者」だけを集計。ドーナツ上部に「工程「X」 N ショット」ラベル。
  - **並び順**：担当者名の 50 音順（`localeCompare('ja')`）。
  - APP_VERSION：2026.09.18.011 → 2026.09.18.012

- (dev v2026.09.18.011) **フィルタ「工程」「ステータス」を「現在工程」ベースに変更（バーの絞込が効くように）**：
  - **原因**：v.010 のデバッグログ確認で、ソート自体は機能していた（`['lay_pri', 'lay_anm', 'anm_sec']`）ことが判明。真の問題は **フィルタの semantics**：以前は `shot.stages.some(st => st.reviewNode.name === stage)` で「その工程を持つか」判定していたので、全ショットが同じ工程セットを持つ場合はどの工程を選んでも全通過してしまっていた。
  - **修正**：フィルタを **shotCurrentStage() の現在工程一致** で判定するよう変更。工程分布ドーナツクリックの絞込と同じルールに統一。
  - **ステータスフィルタも同修正**：`shot.stages.some(st => st.currentStatus === status)` → `shotCurrentStage(shot).currentStatus === status`。以前は他工程のステータスで通ってしまいステータス分布と食い違っていた。
  - APP_VERSION：2026.09.18.010 → 2026.09.18.011

- (dev v2026.09.18.010) **工程設定リストを DATA.shots ベースに切替 + デバッグログ追加**：
  - **原因調査**：v.009 でも「工程ソートが機能しない」というフィードバック。`renderStageList`（工程設定）は `projectStageNames()` を優先し、それが `root.stages` / `stageTemplates` を返した場合はそのまま表示（ソートなし）していた。root.stages がステールで実データと違う順の可能性。
  - **修正**：`renderStageList` を **常に DATA.shots からアグリゲート → `stageOrderCmp` でソート** に変更。projectStageNames は shots が空の時だけの最終フォールバック。
  - **デバッグログ追加**：`console.log('[pmboard] stage order:', sortedNames, ...)` を出すので、ブラウザ Devtools の Console でどの順に並んでいるかが確認できる（実データと比較して食い違いを特定するため）。
  - APP_VERSION：2026.09.18.009 → 2026.09.18.010

- (dev v2026.09.18.009) **工程ソートを `DATA.shots[i].stages` の並び（＝ショット行が既に正しく表示している順）を最優先に**：
  - **原因**：v.008 まで `_buildStageOrderIndex` は `root.stages` / `stageTemplates` / `section.stages` を走査していたが、ユーザー指摘のとおり「ショットの列には正しい順で工程が出ている」＝ `DATA.shots[i].stages` の並びこそが真実の workflow 順だった。それを Priority 1 に据えるだけで最短で解決。
  - **修正**：Priority 1 として **全ショットの `.stages` を先頭から走査し初出順で index を振る** ように変更。Priority 2 でプロジェクト設定系（root.stages / stageTemplates / section.stages）をフォールバック追記。
  - **メモ更新**：`DATA.shots = shots` の直後に `invalidateStageOrderMemo()` / `invalidateStageColorsMemo()` を呼び、shots ベースの並びで再計算されるように。
  - APP_VERSION：2026.09.18.008 → 2026.09.18.009

- (dev v2026.09.18.008) **工程ソートの参照ソースを拡張（`root.stageTemplates` / 各 shot の `section.stages` も併用）**：
  - **原因**：v.007 の `stageOrderCmp` は `root.stages`（Simple B 用のプロジェクト共通工程セット）だけを参照していた。旧モデルの案件では `root.stages` が空のことが多く、代わりに `root.stageTemplates[0].stages` または各 shot section の `.stages` に工程順が入っている。そのため v.007 も実質フォールバック（`stageRankCmp`）に落ちて、日本語工程名は五十音順になっていた。
  - **修正**：`_buildStageOrderIndex()` を新設し、以下を「初出優先」で連結した名前→index マップを作る：
    1. `root.stages`（Simple B）
    2. `root.stageTemplates[i].stages`（旧モデルの工程テンプレ）
    3. 各 `type:section` ノードの `.stages`（ショット追加時に定義された工程順）
  - `stageOrderCmp` はこのインデックスで比較。含まれない工程だけ `stageRankCmp` フォールバック。
  - rootId ベースでメモ化し、`loadProjectData` で自動リセット。
  - APP_VERSION：2026.09.18.007 → 2026.09.18.008

- (dev v2026.09.18.007) **工程ソートを「プロジェクトの workflow 順（root.stages）」を最優先に切替 ＋ ページ更新時の前回プロジェクト自動復元**：
  - **原因**：v.006 の `stageRankCmp` は LayCAT 本体の関数の完全ポートで、`lay*` / `anm*` の英字プレフィックス以外は「rank 2 の名前昇順」となる。日本語工程名（レイアウト・アニメ・コンポ…）や独自命名では順が期待と合わない。
  - **`stageOrderCmp(a,b)` を新設**：
    1. 両方が `root.stages[]` に含まれる → その配列 index で比較（＝ユーザーが設定した workflow 順そのまま）
    2. 片方だけ含まれる → 含まれる方を先に
    3. どちらも含まれない → `stageRankCmp` フォールバック
  - サイドバー 4 箇所（工程分布ドーナツ表・工程進捗バー・工程設定リスト・フィルタ工程ドロップダウン）、`shotCurrentStage` の secondary 判定、`projStageColorMap` のパレット配布順を **全て `stageOrderCmp` に統一**。
  - **前回プロジェクト自動復元**：`switchToProject()` で `localStorage['pmboard_lastPid']` に保存し、`populateProjectPicker` が URL 引数の次に優先で復元。ページ更新（F5）で直前のプロジェクトが開く。
  - APP_VERSION：2026.09.18.006 → 2026.09.18.007

- (dev v2026.09.18.006) **サイドバー各所の工程順を LayCAT `stageRankCmp` に統一**：
  - **工程分布ドーナツ表・工程進捗（完了率）バー・工程設定リスト（テンプレ無しフォールバック）・フィルタ「工程」ドロップダウン** の並び順を、いずれも `rows.sort((a,b)=>stageRankCmp(a,b))` に統一。
  - 以前は Map 挿入順（＝ショット反復順の初出）で並んでいたため、ANIM が LAY より先に来たり、案件によってバラバラだった。
  - LayCAT の `stageRank`（lay/layout →0, anm/anim →1, その他 →2、同 rank は名前昇順）を使うので、LayCAT のショットタブ・進捗タブと同じ工程順で並ぶ。
  - 「未着手」バケットは末尾に配置（従来通り）。
  - APP_VERSION：2026.09.18.005 → 2026.09.18.006

- (dev v2026.09.18.005) **予定バーが無いショット行にもコピペ可能に（工程名一致で貼付）**：
  - **行選択**：ショット行の空トラック／ショットセルクリックで「行選択」（`DATA.selectedPlan = {shotId, stageId:null}`）。選択中は行のショットセル左端に白いアクセント。
  - **バー選択は従来通り**：バーをクリックすると `stageId` 付きで選択（Del／Ctrl+C で操作可能）。
  - **Ctrl+V の挙動拡張**：
    - バー選択中 → そのバーに上書き（従来）
    - 行選択中 → `clip.stageName` と同名の工程を検索して貼付。バーが無くても新規に `plannedStart/End` をセット。大小文字違いも許容。
    - 該当工程が見つからない場合はヒント「PASTE 不可 工程「X」がこのショットにありません」を 1.5 秒表示。
  - **貼付後**：作成されたバーが自動的に選択状態に切替（連続貼付を想定）。
  - `.gantt-row` に `data-shot` 属性を付与（行選択検索用）。
  - APP_VERSION：2026.09.18.004 → 2026.09.18.005

- (dev v2026.09.18.004) **予定バーの選択・削除・コピペを実装**：
  - **選択**：予定バーをクリック（＝ドラッグせずに mousedown→mouseup）で選択トグル。選択中は白い実線アウトライン＋輝度アップ。トラック外クリックで解除。
  - **削除**：`Del`／`Backspace` キー → 選択中バーの `plannedStart/End` を null に戻し保存 → 再描画（未予定に戻る）。
  - **コピー**：`Ctrl+C`（or `⌘+C`）→ 選択中バーの日付範囲（絶対日付）を `DATA.clipboardPlan` に保存。画面中央上にヒントを 1.2 秒表示。
  - **ペースト**：`Ctrl+V`（or `⌘+V`）→ 他ショットの予定バーを選択してから貼付。同じ日付範囲を上書きして保存＆再描画。
  - **ドラッグとの共存**：mousemove で 4px 以上動いた時だけドラッグ扱い、それ未満は「クリック」として選択トグル。今までのドラッグ編集は全部そのまま動作。
  - ショット予定バー（`.seg-plan[data-shot]`）とカスタム予定バー（`.seg-plan[data-cust-*]`）両対応。
  - APP_VERSION：2026.09.18.003 → 2026.09.18.004

- (dev v2026.09.18.003) **pmboard の工程色を LayCAT 本体と完全統一**：
  - **原因**：pmboard は独自の 5 色 CSS 変数（`--st-layout` 等）＋分類ベース＋project順パレットで色付けしていたが、LayCAT 本体は `STAGE_COLOR_MAP`（4 固定キー）＋`STAGE_PALETTE`（8 色 hex）＋stageRank 順のプロジェクト内割当を使っており、両者の色が食い違っていた。
  - **修正**：LayCAT の `STAGE_COLOR_MAP` / `STAGE_PALETTE` / `stageColorFor` ロジックをそのまま pmboard に移植。
    1. `root.stageColors[name]` 手動指定（最優先）
    2. `LC_STAGE_COLOR_MAP[key]`（lay_pri / lay_anm / anm_pri / anm_sec の 4 固定）
    3. プロジェクト内の全工程名（review ノード名＋currentStage＋root.stages）を stageRank 順に並べて `LC_STAGE_PALETTE` を順番割当（重複回避）
    4. フォールバック：名前 char code 和 % パレット長
  - `projStageColorMap` に memo（rootId ベース）＋ロード毎に `invalidateStageColorsMemo` を呼び出し。
  - APP_VERSION：2026.09.18.002 → 2026.09.18.003

- (dev v2026.09.18.002) **pmboard に LayCAT primary 判定（動画時刻）を追加 — 既存プロジェクトも切り替え不要で一致**：
  - **原因**：v.001 で LayCAT のプルダウン切替時に `sectionNode.currentStage` を書き込むようにしたが、既存プロジェクトで一度も工程切替をしていないショットは currentStage が未設定 → pmboard は secondary（status ベース）にフォールバック → LayCAT の primary（動画ベース）と一致しない事例があった。
  - **修正**：pmboard の buildStages で `k.versions[]`（shots/{id}.json から取得）を走査し、`latestVideoTime`（最新 uploadedAt）を各工程に付与。
  - **`shotCurrentStage` 判定順**を LayCAT `progressData` と完全同一に：
    1. `shot.sectionNode.currentStage`（プルダウンで選択済み）
    2. LayCAT primary：`latestVideoTime` があれば最新の工程
    3. LayCAT secondary：status セット済みの工程のうち `stageRankCmp` で最後
  - 既存プロジェクトでもユーザー操作ゼロで LayCAT と同じ現在工程を pmboard が表示。
  - APP_VERSION：2026.09.18.001 → 2026.09.18.002

- (dev v2026.09.18.003) **作業ページを開いた瞬間に `shot.currentStage` を自動同期**：プルダウンを切り替えずに、ツリー・ハッシュ直リンク・`go()` 経由で工程ページを開いただけの場合でも「プルダウンが指している工程 = 現在の工程」となるよう、`renderReviewBody` の冒頭で `shotSec.currentStage=cur.name` を自動書き込み。
  - shot section（type=section＋直下子が全て review）のときのみ書き込み。無関係な section には触らない。
  - 既に一致していれば何もしない（persist は走らない）。
  - `stageHistory` に `source:'view'` を付けて監査記録。動画なしの既存プロジェクトで、閲覧しただけの工程がショットタブ／pmboard に反映される。
  - APP_VERSION：2026.09.18.002 → 2026.09.18.003

- (dev v2026.09.18.002) **LayCAT のショットタブ・進捗タブでも `currentStage` を最優先で参照**：v.001 でプルダウン切替時に `shot.currentStage` を書き込むようにしたが、LayCAT 側の集計関数（`progressData` / `renderProjShots` の `repOf` / `shotCurrentStage`）は従来通り動画時刻・status ベースで現在工程を決めていたため、プルダウンを変えてもショットタブの表示は変わらなかった。
  - **`progressData` の `perShot` 導出**：Priority 1 として `shot.currentStage` が指す子 review を最優先で採用。無ければ従来の動画時刻→status セット順のフォールバック。
  - **`renderProjShots` の `repOf`**：同様に Priority 1 で `shot.currentStage` を参照。
  - **`shotCurrentStage`（LayCAT 内のユーティリティ）**：Priority 1 で `shot.currentStage` を参照。
  - これでプルダウン → 保存 → ショットタブ・進捗タブ・pmboard の 3 箇所全部が同じ工程を表示。
  - APP_VERSION：2026.09.18.001 → 2026.09.18.002

- (dev v2026.09.18.001) **工程判別を「現在の工程プルダウン」で統一（LayCAT・pmboard 共通）**：LayCAT のヒューリスティック判定（動画時刻・stageRankCmp）と pmboard 側の判定が食い違うのを止めるため、ユーザーがプルダウンで最後に選んだ工程を「現在の工程」の Single Source of Truth に。
  - **LayCAT `switchStageInTab`**：工程プルダウン切替時、対象工程の親（＝shot section）に `currentStage=newStage.name` を書き込み、`stageHistory[{ts,by,from,to}]` にも 1 行追記。旧モデルショットも新モデルショットも同じフィールドで統一。
  - **pmboard `shotCurrentStage`**：Priority 1＝`shot.sectionNode.currentStage` を最優先で参照し、stages 配列から一致する要素を返す。Priority 2＝未設定なら LayCAT secondary（`stageRankCmp` で最後の status セット済み工程）にフォールバック。
  - これにより、LayCAT で工程を切り替えた瞬間から pmboard 側の現在工程・工程分布ドーナツ・ステータス分布絞り込みが完全一致する。
  - LayCAT APP_VERSION：2026.09.17.008 → 2026.09.18.001
  - pmboard APP_VERSION：2026.09.17.019 → 2026.09.18.001

- (dev v2026.09.17.008) **Simple B スコープ検出のバグ修正（pmboard 工程消失の原因）**：
  - **原因**：`buildStageStripInline` と統合ログの `stageSiblings` 抽出で `descendants(shot.id)` を使っていたため、Simple B ショットの親がエピソード／ルートの場合、その配下全ショット（無関係な review）を「兄弟工程」と誤検出。pmboard 側の Simple B ショット判定でも旧モデルショットの review 子まで拾ってしまい、工程が二重集計→一部が消えたように見えていた。
  - **修正 1**：`buildStageStripInline` の兄弟抽出を **shot 直下子だけ** に限定し、`shot.type==='section' で 直下子が全て review` を「shot section」として厳密判定。
  - **修正 2**：統合ログの `stageSiblings` も同じロジックで shot 直下子に限定。Simple B ショットは自身のみ含む。
  - **修正 3**：pmboard 側 `isSimpleShot` に「親が旧モデルショットなら除外」を追加。旧モデル review 子が Simple B と誤判定されないように。
  - APP_VERSION：2026.09.17.007 → 2026.09.17.008

- (dev v2026.09.17.007) **Simple B P5：ショット新規作成で工程フォルダ設定を省略可能に**：
  - ショット追加ダイアログの「⚙ 各フォルダ内に作成する工程」を **省略可** に変更。工程を追加しなければ、ショットは単一 `review` ノード（Simple B ショット）として作成される。
  - 作成時の初期 `currentStage` は `root.stages[0]`（プロジェクト共通の工程セット）が自動セット。
  - 工程を明示的に追加した場合は従来通り `section + review 子` の旧モデルで作成（後方互換）。
  - 親の `stages` を継承していた初期値もクリア（意図せぬ多工程フォルダ生成を防ぐ）。
  - APP_VERSION：2026.09.17.006 → 2026.09.17.007

- (dev v2026.09.17.006) **Simple B P1〜P4：`review` ノードそのものをショットとして扱う軽量統合**：v.005 の `type:'shot'` 新型ノード方針を撤回し、既存の `type:'review'` にオプショナルなショット系フィールドを乗せる方針に変更（数日規模の refactor → 半日規模の実装）。
  - **P1 revert**：v.005 で入れた `type:'shot'` 分岐・`renderShotBody` スタブ・スキーマ長文コメント・`isNewShot` を削除。ルーターは元通り `review/section` の 2 分岐のみ。
  - **P2 currentStage フィールド**：`review` ノードに以下を追加可能（未定義でも動作）
    - `n.currentStage`（`root.stages[]` 内の 1 つ）
    - `n.stageHistory[{ts,from,to,by}]`（工程遷移の監査ログ）
    - `v.stage` / `c.stage`（各 version / comment に「アップ時の工程」タグ）
  - **P2 ヘルパ**：`projStageList(root)` / `getShotCurrentStage(n)` / `setShotCurrentStage(n, newStage)`。
  - **P3 プルダウン差替**：`buildStageStripInline` を 2 モード対応に。
    - 兄弟 review が 2 個以上 = 旧モデル → 従来通り兄弟切替（`switchStageInTab`）
    - それ以外 = 単一 review ショット → `root.stages[]` から `currentStage` を選ぶ → 属性書き換え＆再描画
  - **P4 stage タグ付与**：`triggerUpload` / EXR 連番アップロード / `shotCommentInput` で書き込むオブジェクトに `stage=getShotCurrentStage(node)` を付与。
  - **P4 ログバッジ**：`v.stage`/`c.stage` タグを優先ラベルに、無ければ従来通り所有 review ノード名。表示条件も「兄弟あり」から「stage タグが複数種類ある or 現在工程と異なるタグがある」まで拡張。
  - 既存プロジェクトへの影響ゼロ（`currentStage` / `stageHistory` / `v.stage` / `c.stage` 全て未定義でも動作継続）。
  - Phase 5〜6：新プロジェクト作成 UI の工程フォルダ設定廃止、pmboard の `currentStage` / `stageHistory` 対応。
  - APP_VERSION：2026.09.17.005 → 2026.09.17.006

- (dev v2026.09.17.005) **Option B Phase 1：新ショットモデルの型定義とルーティング基盤**：次案件のセットアップを簡素化するため、`shot=review+子review`（フォルダ管理）から `shot=単一ノード＋工程属性`（統合管理）へ移行するリファクタの土台。
  - **新スキーマ**：`{type:'shot', currentStage, stageHistory[], status, versions[{...,stage}], comments[{...,stage}], stageAssignees{}, stageReviewers{}}`。工程セットはプロジェクト共通 `root.stages[]` を利用（決定事項）。
  - **ヘルパ**：`isNewShot(n)` / `newShotCurrentStage(n, root)`。
  - **shot 判定拡張**：`_isShotNodeForSave` を旧モデル（section+review 子）に加え `type:'shot'` も認識するよう拡張。ストレージ層（shots/*.json 切り出し・マージ）は自動的に対応。
  - **ルーティング**：`cur.type==='shot'` の分岐を `renderBody` に追加、Phase 1 では簡易情報表示のスタブ。
  - **既存プロジェクトへの影響ゼロ**：旧モデル（`section` + `review` 子）は従来どおり `renderReviewBody`。新型ノードが無いプロジェクトはコードパス上何も変化しない。
  - **Phase 2〜**：新規プロジェクト作成での新モデル shot 生成、ページ描画の肉付け、動画・コメント・ステータス・担当のアクション、pmboard 対応、既存プロジェクトの変換ボタン。
  - APP_VERSION：2026.09.17.004 → 2026.09.17.005

- (dev v2026.09.17.004) **工程切替は同じタブ内で完結（現在の工程はタブの状態から検知）**：v.002 で追加した左上プルダウンや、v.003 の統合ログの他工程バッジからの工程切替が、これまで `go(id)` 経由で「新しいタブ」を開く挙動になっていた。→ **`switchStageInTab(newId)`** を新設し、遷移先が同じショット（`parentId` が一致する review）なら **openTasks の当該エントリを置換**して、タブを増やさず中身だけを差し替える。
  - 「現在の工程」＝ `state.currentId`（そのタブが今指しているノード）で従来通り検知。
  - 異なるショットへの遷移は従来どおり `go()` にフォールバック。
  - APP_VERSION：2026.09.17.003 → 2026.09.17.004

- (dev v2026.09.17.003) **作業ページで同ショット全工程の動画・コメント・アノテを統合表示**：v.002 の工程切替プルダウンと合わせて「1 ショット＝1 ページ」的な UI に。データ構造（section の下に review 子が並ぶフォルダ分け）は無変更のまま、UI 側で全工程の情報を統合。
  - **統合ストリーム**：`renderReviewBody` の log 生成を、`cur` の versions/comments だけでなく **同ショット内の全 review ノード** の `versions[]` と `comments[]` を集めて時系列（新しい順）に混在表示するよう変更。
  - **工程バッジ**：各アイテムの右上に工程名バッジ。現在の工程は塗り、他工程は枠のみ＋クリックでその工程ページへ遷移。
  - **他工程アイテムは opacity .72** で軽く沈めて視認性の主従を付ける（hover で戻す）。
  - **アノテーション（`v.review.notes`）とコメント（`node.comments`）は各アイテムの所有 review ノードを `logItem/shotCommentItem` に渡すことで、編集・削除・アノテ表示すべてがそのまま動作**（ID ベースで書き込むため、UI 上で「他工程扱い」でも実データは正しい工程に反映される）。
  - APP_VERSION：2026.09.17.002 → 2026.09.17.003

- (dev v2026.09.17.002) **作業ページ左上に工程切替プルダウンを追加（データ構造はそのまま）**：ショット内に工程が 2 個以上ある時、`renderReviewBody` の h1 見出しを「工程名テキスト」→「工程プルダウン」に置き換え。現在の工程は selected 状態で引き継ぎ、選択で `go(id)` により該当工程ページへ遷移。工程が 1 個だけのショットは従来通りテキスト表示のまま。
  - **`buildStageStripInline(shot, curReviewId)`** を新設（ドロワー用 `buildStageStrip` は `openReviewDrawer` に飛ばすためインライン版とは分離）。
  - CSS：`.stage-strip-inline .ss-sel` を 18px/太字/コード書体にし、既存 h1 と同じ視覚重量に。
  - フォルダ分けのデータ構造（shot=section 配下に review 子）は変えていない。UI 側の改善のみ。
  - APP_VERSION：2026.09.17.001 → 2026.09.17.002

- (dev v2026.09.17.001) **ステータス設定に「☑ クライアント待ち」チェックボックスを追加**：プロジェクト設定 → ステータス定義の各行に、既存の「☑ チェック待ち」の隣に「☑ クライアント待ち」を追加。チェックを入れたステータスは `statuses[i].clientWait: true` として保存され、pmboard 側で「作業が発生していない期間」として実績バーから除外される（クライアント返答待ちの期間を実労働に含めないため）。旧データは全て `clientWait:false` 扱い（後方互換）。 (APP_VERSION：2026.09.16.001 → 2026.09.17.001)

- (dev v2026.09.16.001) **ヘッダーに「進行管理」ボタン追加**：pmboard（進行管理ボード）を別タブで開くボタンをヘッダー右側に追加。ドキュメント（rect）＋横 3 本線のアイコン。`onmousedown` で現在アクティブなプロジェクトの pid を URL 引数として付与するので、そのまま pmboard 側で該当プロジェクトのスケジュールが自動表示される。 (APP_VERSION：2026.09.15.001 → 2026.09.16.001)
---

## 反映済み beta v0.2.0（2026-09-08）

### A. ステータス巻き戻り問題の恒久対策（パッチノート掲載）

- (dev v2026.08.07.045) ステータス巻き戻り問題の恒久対策（scout 徹底解析による重大 4 件のうち 3 件＋関連 #13 を一括修正）
  - **#2（重大）**：`_persistNow` の baseline 更新を修正。従来は保存前に凍結した `ps=JSON.stringify(data)` を `_saveCache.proj[e.id]` にセットしていたが、`saveProjectSplit` 内で `_applyShotFileIntoDB` により DB が書き換わるケースで baseline が乖離。**保存完了時点の `projectData(e.id)` から再ストリンガイズ**して baseline を確保する。これで autoRefresh の `baseline===before` 判定が正しく動作し、**v.074 の「clean 時のみ state 系も remote 採用」経路が復活**。他ユーザーの status 更新が本人にも反映されるようになる。
  - **#3 / #13（重大）**：`autoRefresh` の先頭で `_persistBusy>0` の間は即 return するガードを追加（force=true 経路にも適用）。従来は Alt-Tab／`visibilitychange` で `autoRefresh(true)` が persist 中に割り込み、union-fill が「未着手に戻した」意図を古い remote 値で埋め戻していた。
  - **#10（中）**：`_mergeNodeInto` の preferB+authoritative 分岐で **remote が明示的に clear した null/''** を state 系（`status`/`assignee`/`reviewer`）でも尊重するようにした。`_bHas(k)`（`Object.prototype.hasOwnProperty.call(b,k)`）で「remote がキーを明示的に持っている」ことを確認して assign。従来は `b[k]!=null` フィルタで null が捨てられ、他ユーザーが「未着手に戻す」操作を行っても他の閲覧者の画面に反映されなかった。
  - **未対応**：#1（`_saveShotWithLock` の CAS 不在／R2 Worker 改修が必要）／#4（v<4 プロジェクト専用）／#5〜#9 の中〜軽微は次段で対応検討。

### B. タブロック機能（パッチノート掲載）

- (dev v2026.08.07.042) タブロック機能を追加：`✕ すべて閉じる` で閉じないようにタブを個別ロック可能に
  - タブ内に南京錠アイコン（🔒/🔓）を追加。クリックでロック状態をトグル
  - ロック中は琥珀色（#f2c86b）で強調表示・ツールチップも変化
  - `state.tabLocks`（Set）を新設し、localStorage の `layna_loc.tabLocks` として永続化（40 件上限）
  - **「✕ すべて閉じる」ボタンはロック中タブを除外**して閉じる。ボタン表記も「✕ すべて閉じる（ロック N 件除く）」に自動切替
  - 個別 ✕ ボタンはロック中でも従来通り閉じられる（ロック情報は掃除）
  - CSS：ロック中は常時表示・未ロックは薄め＋ホバー時に濃く
- (dev v2026.08.07.043) タブロックの南京錠アイコンを無彩色化（`filter:grayscale(1)`）＋琥珀色アクセント（#f2c86b）を撤去
  - ロック中の判別は不透明度（`opacity:1` vs `.25`）で行う
  - 絵文字カラーが OS/ブラウザで残るのを grayscale フィルタで抑制、テーマに馴染ませる

### C. ショットタブのクリック挙動改善（パッチノート掲載）

- (dev v2026.08.07.041) ショットタブ：グリッドタイルの挙動を元に戻し、縦並び行のサムネクリックを「タブ追加」に変更
  - **グリッドタイル（`mkTile`）**：v.040 で「タブ追加」に変えたのを **右スライド（`openReviewDrawer`）に戻す**（ユーザー要望）
  - **縦並び行のサムネイル（`th`）**：従来はアノテ窓 modal（`openReview({modal:true})`）を開いていたのを **作業ページ（タブ）追加＝`go(lv.node.id)`** に変更。ツールチップも「クリックで作業ページ（タブ）に追加」に更新
  - 行本体（`it.onclick`）の右スライド開き挙動はそのまま
- (dev v2026.08.07.044) ショットタブ・グリッド表示のタイル動画部クリックを「作業ページ（タブ）追加」に変更（縦並び行のサムネと挙動統一）
  - **動画・サムネ部（`th`）クリック**：`go(lv.node.id)` でタブ追加＋ `stopPropagation`
  - **タイル枠（`tile` 本体）クリック**：従来通り右スライド（`openReviewDrawer`）
  - 選択モード時／Ctrl・Meta クリックは `th.onclick` から早期 return してタイル本体の選択トグルに委譲（挙動は選択モードそのまま）
  - ツールチップも「クリックで作業ページ（タブ）に追加」に

### D. 紹介ページ大幅リニューアル（パッチノート掲載）

- 左固定 TOC（目次）を追加：17 項目ジャンプ・IntersectionObserver によるスクロール連動ハイライト・1280px 未満では自動非表示
- Export セクション（アノテ焼き込み動画書き出し）を新設。イラストを SVG モックから実写風 PNG に差替
- 各 feature-row／diff-block に ID を割り当て
- ヘッダーナビ「EXR」→「独自機能」、アンカー `#exr` → `#differentiators` に変更
- Cloud／Folder セクションを整理、「機能」見出しをシンプル化

---

## 反映済み beta v0.1.0（2026-08-07）

### A. タイムリマップ・ビューア新設（パッチノート掲載）

- (dev v2026.08.07.024) タイムリマップ・ビューア（独立エンジン）を実装 — AE 互換のリニアキーフレーム、タメツメ指示用
  - **エントリー**：動画タイルの版ヘッダに「⧗ リタイム」ボタン追加（比較・REEL 送るの隣）
  - **独立モーダル `openRetimer(node, v)`**：アノテ窓と分離した独自 UI／独自再生エンジン。既存アノテ機能は無変更
  - **データモデル**：`version.timeRemap = {enabled, keyframes: [{t, s}, ...]}`（t=表示F、s=ソースF）。版に紐付いて永続化（persist）
  - **速度計算**：セグメント傾き = 1 で等倍、0 でフリーズ（タメ）、>1 でツメ、<0 で逆再生
  - **キーバインド（AE 準拠）**：`K`＝キーフレーム追加／`Delete`＝選択キーフレーム削除／`Space`＝再生・停止／`← →`＝1F 送り／`Escape`＝閉じる
  - **タイムライン**：キーフレームを黄色ダイヤで表示、セグメントを速度で色分け（オレンジ＝タメ／逆、シアン＝ツメ）
- (dev v2026.08.07.025) 再生バグ修正＋グラフエディタ追加
  - `videoReady` フラグを追加、未 ready で押下したら `pendingPlay=true` で保留し、ready 到達時に自動再生
  - グラフエディタ（AE バリューグラフ・リニアのみ）：X=表示F・Y=ソースF、ドラッグで t/s 同時編集、隣接キーの t を越えないようクランプ
- (dev v2026.08.07.026) ネイティブ `video.play()` + `playbackRate` に切替で軽量化
  - 毎 rAF に `currentTime` 書き換えていた方式を撤去、rAF はドリフト監視のみ

### B. アノテ窓の「動画埋め込み」自動同期（パッチノート掲載）

- (dev v2026.08.07.021) アノテ窓に「動画埋め込み」自動同期を導入（描画のみ→送信せず閉じても消えない）
  - REEL の `reel_emb_` 機構をアノテ窓に移植：ノート ID `anno_emb_<versionId>_<frame>`、noShot=true で管理
  - 描画・消しゴム・投げ縄・図形・head・mann の各操作後に自動同期＋400ms debounce persist
  - 開き直し時は embed ノートから pending を復元、閉じる時は最終同期＋即時 persist
  - 送信時は該当フレームの embed ノートを掃除して重複防止
- (dev v2026.08.07.022) タイムラインの動画埋め込みマーカーを専用色（`#a5652f`）100% 塗りに（コメント付き `#e08a4a` と区別）

### C. NOTE パネル画像機能（パッチノート掲載）

- (dev v2026.08.05.044) タスクページ右カラムの NOTE パネルに画像挿入対応（拡縮／回転／削除）
- (dev v2026.08.06.019) NOTE の画像機能拡張：クリップボードペースト対応＋各画像右上に拡大表示ボタン
- (dev v2026.08.06.020) NOTE 画像の拡大ボタンのアイコンを対角矢印（↗↙）に変更（従来は虫眼鏡＋プラス）

### D. Parsec 等リモート接続時のマウス感度低下を回避（パッチノート掲載）

- (dev v2026.08.07.017) draw/erase ツール中のカーソルを `none` → `crosshair` に変更
  - JS 描画のサイズリングはそのまま。OS の crosshair とリングの二重表示になるが、リモート・ローカル両方でカーソル追従がスムーズに

---

## 反映済み beta v0.0.9（2026-08-05）

- (dev v2026.08.05.035) コメント欄：ハイライト移動時に自動スクロールで追従
  - `paintCurrentHighlight` / `paintReelCurrentHighlight` で、ハイライト対象が別の note に切り替わった瞬間だけ `best.scrollIntoView({block:'nearest',behavior:'smooth'})`。
  - `block:'nearest'` により見えている場合は動かない → 手動スクロール中は邪魔しない、画面外に出ているときだけ滑らかに寄せる。
  - `_lastAtCurEl` / `_lastReelAtCurEl` で前回対象を記憶し、無変化なら scrollIntoView をスキップ。

- (dev v2026.08.05.034) コメントタイル ハイライト：通過中だけ点灯から「直近コメントを持続ハイライト」に変更
  - 旧仕様は `cf >= f && cf < f+dur` で通過中の 1〜数フレームだけ at-cur が付いていたため、再生・スクラブで一瞬光ってすぐ消える演出が悪目立ちしていた。
  - 新仕様：現在フレームより前の f を持つコメントのうち **最大 f を持つ 1 件だけ** at-cur。プレイヘッドが次のコメントに到達するまでその 1 件が光り続ける（DAW／字幕エディタ風の「一つ前のコメント」ハイライト）。
  - アノテ窓（`paintCurrentHighlight`）と REEL（`paintReelCurrentHighlight`）両方に同じロジック。

- (dev v2026.08.05.033) REEL：非ファストスワップ経路でも heavyUI を defer し前クリップ最終フレーム静止を除去
  - fastSwap の条件（`target.readyState>=2` かつ `RV.pendSeek==null` かつ `auto`）を満たさない経路に落ちると heavyUI（`buildLayerPanel`/`reelNotes`/`updUnsent`/`updReelHeaderInfo`）が同期実行され、旧クリップ最終フレームが数十 ms 見えたまま止まる原因になっていた。
  - 非ファストスワップ経路（`target===video` / 非同一 target で priming 未完了）でも activate 後に `reelWin.setTimeout(heavyUI, 0)` で defer するよう変更。動画切替クリティカルパスから DOM 構築を排除。

- (dev v2026.08.05.032) REEL：スクラブで別クリップに戻して再生したときのカクつき対策
  - `loadCur` 非ファストスワップ経路（`target !== video`）で、activate の**前に** target を `pause()` ＋ pendSeek 事前反映するよう変更。
  - 原因：`preloadNext` の priming で target が muted 再生中のとき、activate が opacity=1＋unmute するので一瞬 target が意図せず 0F から再生される（音がプツっと鳴る／フレームがフラッシュする）。さらに pendSeek を activate 後に seek すると「priming 位置 → pendSeek」の余計な描画が挟まる。
  - 対策：opacity 差替え前に target を止め、pendSeek がある場合は同期で `target.currentTime` に反映しておく。activate の瞬間に既に目的フレームで静止している状態にしてから可視化。
  - `seekRTr` は使わず直接 `currentTime` 代入（初期位置の establish には十分、RV.busy/seekF は活用不要）。

- (dev v2026.08.05.031) REEL 連続再生：ループ 2 周目のカクつき対策（先頭クリップも re-priming）
  - `preloadNext` の対象を「cur+1」から「cur+1 or (loop 末尾なら先頭)」に拡張。ループ再生時、末尾クリップの preloadNext が発火する時点で先頭クリップも同時に再 priming される → 2 周目のカクつきが解消。
  - priming の判定を「1 回限り」から「`_primed && currentTime<0.05` で skip、末尾まで再生し切っていれば再 priming」に変更。前回再生で末尾に到達している場合は kick 前に `currentTime=0` に戻して playing 発火を早める。
  - キーフレーム再デコードで発生する seek 遅延（数十 ms）を事前に消化しておくことで、ファストスワップ時の `target.play()` が 1 vsync 内で描画到達しやすくなる。

- (dev v2026.08.05.030) REEL 連続再生：preloadNext を decoder priming 型に強化（対策 B）
  - `getVid` で用意した次クリップ video に対して「muted で play → 'playing' 発火で pause」まで進めて decoder pipeline を温める。`v._primed` フラグで 1 回限りガード、muted のまま実行するため音は出ない。
  - Chrome の VideoDecoder は初回 play 時に初期化コスト（数十 ms）を払う。priming 済みなら以降のファストスワップ時に `target.play()` が 1 vsync 以内で実描画に到達しやすくなる → 動画差替え後の frame 0 静止時間が短縮される。
  - `readyState>=2` なら即 kick、未達なら `canplay` イベント待ち。

- (dev v2026.08.05.029) REEL 連続再生：重い UI 更新をファストスワップ後の次 tick に defer（対策 A / 動画優先）
  - `loadCur` の `buildLayerPanel` / `reelNotes` / `updUnsent` / `updReelHeaderInfo` を `heavyUI()` に括りだし、fastSwap（動画差替＋play 済）成立時のみ `reelWin.setTimeout(heavyUI, 0)` で次 tick に defer。
  - 動画切替クリティカルパスは「activate + play + RV.total/fitAnno」のみになり、DOM 構築系の数十 ms が挟まらない → 旧クリップ最終フレームの静止時間が実質消える。
  - 描画・アノテに必須の軽い state（RV.pending / RV.hist / cta.value / RV.FPS 等）は従来通り同期実行して視覚的整合性を保つ。
  - 割り切り：レイヤーパネル・コメント欄・ヘッダバッジ・ステータスは 1〜2 rAF（16-33 ms）遅れて反映されるが、ユーザーの明示合意あり。

- (dev v2026.08.05.028) REEL 連続再生：v.025〜v.027（rvfc 対策とその後始末）を revert
  - v.025 の rvfc による activate 遅延経路が opacity=0 の video で発火しないケース／各種フラグの後始末不備で、逆に「1 つめクリップがずっと固まる」「複数クリップで飛ばされる」等の挙動不安定を招いていた。v.024（末尾プリエンプト単独）時点まで巻き戻し。
  - あわせて v.026 の preloadNext priming（decoder 温め）と ended 二重発火修正、v.027 の単一クリップ／再アクティブ freeze 対策も revert。全て v.025 の rvfc 経路と絡んでいたため。
  - 今後は rvfc に頼らず、`'playing'` イベントで実描画到達を待つ・fast-swap 経路の見直し・閾値広げ等、別方針で再検討。

- (dev v2026.08.05.024) REEL 連続再生：ended の遅延を待たずに末尾プリエンプトで切替
  - `tick()` rAF ループ内で `video.duration - video.currentTime < 1 フレーム分` を検出したら、`ended` イベントの発火を待たずに `loadCur(true)` を先行発動。
  - `ended` はブラウザ内部の都合で最終フレーム描画から数十 ms 遅れて発火するため、それを待っていた従来は「旧クリップ最終フレームが数十 ms 静止画で見える」現象が残っていた。プリエンプトでほぼ 0 に。
  - `reelUI._preemptFor` に発動済みクリップ index を記録し、同一クリップで多重発動しないようにガード。範囲再生時／scrub 中は ended ハンドラの既存処理に任せる。
  - ループ再生の末尾（最後→先頭）にも対応。

- (dev v2026.08.05.023) REEL 連続再生：旧クリップ末尾の静止時間も短縮＋新クリップの frame 0 保証
  - `loadCur` にファストスワップ経路を追加：auto & キャッシュ済み & pendSeek 無しのときは、`reelHydratePending` / `buildLayerPanel` / `reelNotes` / `updReelHeaderInfo` 等の state 更新の前に `activate`＋`play` を先行実行。ended 発火 → 差替えまでの間、旧クリップ最終フレームが静止画で見える時間を最小化。
  - 先行 play の直前に `target.currentTime=0` を明示（warmRest は 0 に戻すが seeked イベント経由なので保険）。frame 0 から確実に始まる。
  - ファストスワップ済みは後段の `activate`/`play` を skip。RV.total / fitAnno のみ更新して終了。

- (dev v2026.08.05.022) REEL 連続再生：カット切替時のプチ止まりを修正
  - `loadCur` のキャッシュ済みクリップ切替経路で、`activate()`（opacity 差替え）よりも先に `target.play()` を呼ぶ順序に変更。`video.play()` は Promise を返す非同期処理で、実際にフレームが進み始めるまで数十 ms かかるため、opacity 切替後に play すると「新クリップの 0 フレーム目が静止画で数十 ms 見える」＝一瞬止まる現象になっていた。
  - 未キャッシュ経路（`readyState<2`）と `RV.pendSeek!=null`（フレーム指定シーク）は従来通り activate 後に play。二重発行防止の分岐を追加。

- (dev v2026.08.05.021) ショットタブ：sel-bar 表示時のタイル位置ずれを解消＋選択色をより青寄りに
  - sel-bar を `.shot-sel-anchor{position:sticky;top:0;height:0}` で包み、本流には高さを取らせないよう変更。バーは `position:relative` で下に張り出す形で表示 → 初回表示でタイルが下にシフトしない。
  - 選択ハイライト色を `#5cc7ef`（水色寄り）→ `#4a9eff`（青寄り）に。非選択タイルとのコントラストを上げつつテーマの青系統に統一。

- (dev v2026.08.05.020) ショットタブ：sel-bar を sticky に、タブ帯クリックで選択解除、ヘッダ行からもラバーバンド開始可
  - `.shot-sel-bar` を `position:sticky;top:0;z-index:20` にしてスクロールしても常に画面上部に固定。落ち影も強化して浮遊感を付与。
  - `buildProjectTabsHead` の nav に mousedown リスナーを追加し、タブ帯クリックで `state.shotSel=null;renderBody();resolveThumbs()`。各タブボタンの onclick 側でも `state.shotSel=null` を追加してタブ切替時に必ず解除。
  - ラバーバンド開始の除外リストから `.pm-h` / `.pm-eph2` を外し、「ショット — 各ショットの…」の見出し行やエピソード区切り上からも矩形選択を開始できるように。

- (dev v2026.08.05.019) ショットタブ：選択解除ボタンで全タイル真っ黒になるのを修正
  - `.shot-sel-bar` の「選択解除」ボタンの onclick が `renderBody()` のみで `resolveThumbs()` を呼んでいなかったため、再描画された `img[data-ref]` のソースが解決されず `.pm-tile .th` の `background:#000` が透けていた。`resolveThumbs()` を追加。

- (dev v2026.08.05.018) ショットタブ 範囲選択の改善：#scroll 全域で開始可・ドラッグ中も水色ハイライト
  - mousedown ハンドラを `main` から `#scroll` に移動。main の左右パディング（scroll 側 20px）や左端の空白からも開始できるように。`state.projTab==='shots'` で他タブへの副作用を防止。
  - ドラッグ中の `onmv` で交差判定を都度計算し、対象タイル／行に `.sel` を即時付与（`initSel` 分は常時保持）。マウスを離す前から選ばれる範囲が水色でわかる。
  - `.pm-tile.sel` / `.shot-row.sel` / `.rubber-band` / `.shot-sel-bar` の色を `var(--edge)`（薄い水色）から solid `#5cc7ef` にし、非選択との差を強調。

- (dev v2026.08.05.017) ショットタブ：範囲選択（ラバーバンド）＋複数選択＋選択ショットを REEL に一括追加
  - `state.shotSel`（Set of shot IDs）を新設。ショットタブの空白部分から mousedown → ドラッグで矩形描画、離すと矩形と重なるタイル／行を選択に加える（`.rubber-band` オーバーレイ）。Ctrl/Meta/Shift 併用で既存選択を保持したまま追加。
  - タイル／行クリックの挙動：選択が非空 or Ctrl/Meta クリックなら選択トグル、それ以外は従来通り右スライドを開く。
  - 選択中は `.pm-tile.sel` / `.shot-row.sel` で cyan アウトライン＋グロー。
  - 上部に選択ツールバー（選択件数＋「▶ 選択した動画を REEL に追加」＋「選択解除」）を表示。
  - `reelAddSelectedShots()` を新設：選択された各ショットの最新動画を `reelAddClip` で REEL に順次追加、完了時に toast 表示＋選択解除。

- (dev v2026.08.05.016) アノテ窓／REEL：ループ・ズーム・トラックの絵文字を無彩色化、3D は立方体 SVG に
  - `loopBtn` / `ziBtn` / `zoBtn` / `handBtn`（アノテ窓）と `loopBtn` / `ziBtn` / `zoBtn` / `handB`（REEL）に `filter:grayscale(1)` を適用。カラー絵文字（🔁🔍✋）をテーマ色に馴染む無彩色に。
  - 3D ボタン（`mannBtn` / `mannB`）は絵文字 🎭 を廃止し、`currentColor` ストロークの立方体 SVG（正面・側面・上面の 3 面表示）＋テキスト "3D" に置換。
  - `画面操作` ヘルプパネル自体は元々テキスト＋`<kbd>` のみで有彩色要素なしのため変更なし（他のボタン群と自動的に統一される）。

- (dev v2026.08.05.015) アノテ窓／REEL：👁 ボタンのアイコンを大きく（ボタンサイズは据え置き）
  - `eyeBtn`（アノテ窓・line 8701）と `eyeB`（REEL・line 11221）に `fontSize:17px; lineHeight:1` を追加。`line-height:1` にすることでボタン高が padding*2 + fontSize に収まり、既定 (padding+fontSize*1.5) と同程度になる → ボタンサイズは実質据え置き。

- (dev v2026.08.05.014) REEL：新規（Ctrl+N）でコメント欄／アノテ描画／タイムライン装飾もリセット
  - `doNew` に `drawAnno / drawFTL / reelNotes` の呼び出しを追加。旧リールのコメントや描画が残る問題を解消。
  - `reelNotes` はクリップ未選択時「クリップ未選択」を出す既存分岐でリセット動作が完結する。

- (dev v2026.08.05.013) REEL：ループボタンをアノテ窓と同位置（再生コントロール列）に、全クリアを撤去
  - ヘッダ右の `rightActions` から `loopBtn` を撤去し、下部の `ctr`（prev/play/next の並び）に「🔁」ラベルで挿入。アノテ窓の `loopBtn` と同じ配置に統一。
  - 「全クリア」ボタン (`clearBtn`) を撤去。誤操作で全クリップと動画側 reel_emb_ 描画を消してしまう危険操作だったため、日常操作から外す（新規リールを作りたい場合は File メニューの「新規」で代替可能）。
  - `reelUI.clearBtn` の登録と `clearBtn.onclick` ハンドラも削除（`reelPurgeEmbFor` 等の関数は温存）。

- (dev v2026.08.05.012) REEL フローティング窓：✕ ホバーを水色グローから白グローに
  - `cbtn` ホバー時の color/text-shadow を白ベースに変更。

- (dev v2026.08.05.011) REEL フローティング窓：全画面時は枠線なし＋タイトルドラッグで元サイズに戻して追従
  - `setBorderMaximized(true/false)` を追加。全画面時は `border:none` にして境界線を非表示、復元時に border-image を戻す。
  - タイトルバー mousedown で `savedGeom` が有る場合（＝全画面中）は先に元サイズへ復元し、カーソル相対位置を保ったまま新しい left/top に配置してから通常のドラッグへ移行。OS の「最大化状態でタイトルを掴んで動かす → 元サイズで追従」と同じ挙動。

- (dev v2026.08.05.010) REEL フローティング窓：枠線を細く＋外周グローを撤去
  - shell の border を 2px → 1px、box-shadow から cyan/purple グロー 2 段を撤去（暗い落ち影のみ残す）。控えめな主張に。

- (dev v2026.08.05.009) REEL フローティング窓：外枠を水色→紫のグラデ＋外周グロー強化
  - shell の `border` を `1px solid #3a3a42` から `2px solid transparent + border-image:linear-gradient(135deg,#5cc7ef→#7a5cff) 1` に。`--edge-grad` と統一。
  - box-shadow に cyan/purple のグローを追加してメイン画面との境界を明確化。
  - `border-image` は `border-radius` と併用できないため角丸は解除（フラット矩形）。

- (dev v2026.08.05.008) REEL フローティング窓：✕ホバーを赤地から水色グローに
  - `cbtn` のホバー効果を `background:red` から `color:#5cc7ef` + `text-shadow` グロー（cyan 8px+14px）に変更。可愛らしい発光表現に。

- (dev v2026.08.05.007) REEL フローティング窓：✕ボタンの当たり判定拡大＋リサイズ判定を初期サイズに戻す
  - 閉じる `✕` ボタンの `padding` を `0 8px` → `0 16px`、`height:100%` を追加してタイトルバー全高で反応。ホバー時は Windows 風に赤地に。
  - リサイズハンドルのサイズを初期に戻す（辺 12→5px、角 22→16px）。方向は現行の 8 方向（NE/N/NW/W/SW/S/SE/E）を維持。

- (dev v2026.08.05.006) REEL フローティング窓：タイトルバーの十字カーソルを通常に、ダブルクリック全画面を復活
  - タイトルバーの `cursor:move`（十字）を `cursor:default` に、ドラッグ中オーバーレイの cursor も `default` に変更。移動中も通常の矢印カーソルのまま。
  - `dblclick` イベントは drag セットアップと `e.preventDefault()` の影響で発火が不安定だったため、`mousedown` タイムスタンプ差分（380ms 以内）で手動判定に切替。判定時は `toggleMax` を呼び drag セットアップをキャンセル。

- (dev v2026.08.05.005) REEL フローティング窓：右上/左上/上辺リサイズ＋タイトルバー ダブルクリックで全画面
  - リサイズハンドルに NE (22×22)、NW (22×22)、N (辺 6px) を追加。左辺/上辺のオフセットを 22px に揃えて角と干渉しないよう調整。
  - 'n' 方向は height 縮小と top 加算を同時に行う（下端固定で上だけ伸縮）。`rz.t` を保持して復元。
  - タイトルバー ダブルクリックで全画面 ⇄ 復元をトグル。`savedGeom` に直前の位置とサイズを退避し、もう一度ダブルクリックで元に戻る。

- (dev v2026.08.05.004) REEL フローティング窓：マウス放し検知の取り漏らしを修正
  - `onMove` の冒頭で `e.buttons===0` を検出したら `endDrag` を呼ぶよう変更。ブラウザ外で mouseup を取り漏らしても、次の mousemove 時点で確実に終了。
  - 追加保険として `window.blur` / `document.mouseleave` にも `endDrag` を登録。
  - これで「一度判定から外れた後、クリックしていないのに resize が続く」現象を解消。

- (dev v2026.08.05.003) REEL フローティング窓：リサイズ判定を広げ＋iframe イベント奪取を防止
  - リサイズハンドル幅を 5px → 12px（辺）、コーナーは 16→22px に拡大。左辺 (W) と左下角 (SW) も追加。
  - ドラッグ／リサイズ中は透明オーバーレイ (`ovl`) を iframe 上に被せて mouse イベントの捕捉ミスを防止。開始時に表示・終了時に非表示。カーソルは操作種別に合わせて切替。
  - 左辺リサイズ時は width と left を同時に調整（右端固定で左だけ伸縮）。

- (dev v2026.08.05.002) REEL を別ウィンドウからメイン内フローティング iframe に変更（試験）
  - `window.open` ではなくメインドキュメント内の `#reelFloat` div＋iframe として起動。ブラウザ chrome（about:blank URL バー）が原理的に付かなくなる。
  - タイトルバーをドラッグで移動、右下・右辺・下辺の 3 箇所で自由リサイズ（min 640×420、`clampReelSize` の 940×560 で resizeTo 経由の下限保持は継続）。
  - `reelWin` は iframe.contentWindow を包む shim オブジェクトに置換。`.document/.focus/.close/.closed/.confirm/.alert/.prompt/.addEventListener/.requestAnimationFrame/.setTimeout/.clearTimeout/.outerWidth/.outerHeight/.resizeTo` を提供し、既存 REEL コードは書き換え最小で動作（28 箇所の `reelWin.` 参照はすべて shim 経由で通る）。
  - `beforeunload/unload` は iframe 除去時に発火しないケースがあるため `shim.close()` から明示的に `dispatchEvent` して既存クリーンアップを走らせる。
  - まだ試験実装。UX に違和感があれば revert 可能（旧 window.open 分岐は撤去済み・戻す場合は 1 コミット reverse で戻る）。

- (dev v2026.08.05.001) REEL ポップアップの about:blank アドレスバーを非表示化
  - `window.open('','layna_reel','width=1140,height=780')` に `popup=yes,location=no,toolbar=no,menubar=no,status=no` を追加。ブラウザ chrome を省いて純粋なアプリウィンドウ表示に。
  - 挙動：`popup=yes` があると多くのブラウザ（Chromium/Firefox/Edge）で URL バーが省かれる。既に開いている REEL には次回開き直しから反映。

- (dev v2026.07.29.090) コメントタイル ハイライト：鼓動の振幅を更に 0.7 倍に
  - `atCurPulse` 35% ピークを 0.7 倍：spread 2→1.4px、purple α .18→.13、glow blur 10→7px、cyan α .34→.24。

- (dev v2026.07.29.089) コメントタイル ハイライト：鼓動の振幅を半分に
  - `atCurPulse` の 35% ピーク値を半減：spread 3px→2px、purple α .35→.18、glow blur 14px→10px、cyan α .55→.34。

- (dev v2026.07.29.088) コメントタイル ハイライト：鼓動を 0.2s に
  - `atCurPulse` の duration を .5s → .2s に。

- (dev v2026.07.29.087) コメントタイル ハイライト：鼓動を倍速に
  - `atCurPulse` の duration を 1s → .5s に。

- (dev v2026.07.29.086) コメントタイル ハイライト：鼓動を 2 拍から 1 拍に
  - `atCurPulse` のキーフレームを 2 山（18%/60%）から 1 山（35%）に。0→100% で 1 回だけの鼓動になる。

- (dev v2026.07.29.085) コメントタイル ハイライト：鼓動を 1 回きり＋速く、背景フェードを 0.1s 遅延
  - `atCurPulse` を `1.6s ease-in-out infinite` から `1s ease-in-out 1 both` に。速度アップ＋最初の 1 回のみ。
  - `atCurWipe` に `.1s` の遅延を追加。鼓動の立ち上がりに合わせて背景がフェードインしてくる印象に。

- (dev v2026.07.29.084) コメントタイル ハイライト：ワイプの境界をぼかし＋枠線を鼓動アニメに
  - `::before` のワイプを `clip-path` から `mask-image`（`linear-gradient(135deg,#000 0-25%,transparent 75-100%)` を `mask-size:200% 200%` で `mask-position` を 100% 100% → 0% 0% に 0.3s で移動）に変更。25%〜75% の透過ソフトエッジで境界がなだらかに広がる。
  - 枠線は `border-image` グラデを維持しつつ、`.log-note.at-cur` 自体に `animation:atCurPulse 1.6s ease-in-out infinite` を追加。box-shadow の spread（0→3px）+ glow で「トクン、トクン、…」の 2 拍リズム（18% と 60% がピーク）を再現。
  - メイン CSS + アノテウィンドウ inline CSS 両方に適用。

- (dev v2026.07.29.083) コメントタイル ハイライトの背景を更に暗く＋左上→右下ワイプアニメ
  - 背景グラデを `rgba(38,110,180,.32)→rgba(80,50,160,.32)` から `rgba(20,55,100,.55)→rgba(40,20,85,.55)` に。より濃い（暗い）ネイビー→パープル。
  - `::before` オーバーレイで背景を描画し `clip-path:polygon(0 0,0 0,0 0) → polygon(0 0,200% 0,0 200%)` の 0.3s ワイプアニメ（左上頂点固定で右下方向へ三角形が拡大）。テキストは `.log-note > *{position:relative;z-index:1}` で前面確保。
  - メイン CSS＋アノテウィンドウ inline CSS 両方に適用。

- (dev v2026.07.29.082) コメントタイル ハイライトの背景色を暗めに調整
  - `.log-note.at-cur` の背景グラデを `rgba(92,199,239,.18)→rgba(122,92,255,.18)` から `rgba(38,110,180,.32)→rgba(80,50,160,.32)` に。より暗い青→紫で bg3 に馴染む色味に。
  - 枠線（border-image）は同じ #5cc7ef→#7a5cff で維持しコントラストを確保。

- (dev v2026.07.29.081) コメントタイルのハイライト（at-cur）を水色→紫のグラデ背景＋グラデ枠線に
  - `.log-note.at-cur` の見た目を、旧来の「左端 3px 緑バー」から、`linear-gradient(135deg,#5cc7ef→#7a5cff)` の半透明背景（各色 α=.18）＋ 同グラデの `border-image` 枠線に変更。
  - グラデ方向は 135deg（左上→右下）で、既存の `--edge-grad`（ツール全体の水色→紫ライン）と揃えた。
  - 影響：メインの FB ログサイド（`.log-note`）と、アノテーションウィンドウの inline CSS（`openReview` 内）両方に同じ変更を適用。REEL 側のノートは同 class を共有しているため自動で反映される。

- (dev v2026.07.29.080) プロジェクト設定：プロジェクトサムネイル下の「実際のタイルでの見え方」プレビューを削除
  - `makeCropEditor` から `.crop-preview`（`cp-tile` + プレビュー用 img）と関連する pimg / ptile 参照を撤去。トリミング窓と拡大スライダーのみに簡素化。
  - 影響範囲：プロジェクト設定モーダル（`openRename`）と新規プロジェクト作成モーダル（`openProjectModal`）の両方（同一ウィジェット共有）。
  - CSS `.crop-preview / .cp-label / .cp-tile` は未使用になるが他への波及がないため残置。

- (dev v2026.07.29.079) 右スライド内の FB ログヘッダを 2 段表示に（上=各種ボタン／下=動画タイトル）
  - v078 で誤って `task-topbar` を修正していたが、実際に被っていたのは FB ログ枠内（`.log-head`）だった。v078 の task-topbar 変更を revert し、`.log-head` に対して修正しなおす。
  - ドロワー配下（`.drawer .log-head`）のみ `flex-wrap:wrap` を有効化し、`.log-title` を `flex:0 0 100%;order:2` で 2 段目に押し出す。上段にはメタ（by/日時）とダウンロード／比較／REEL／削除等のボタン群が並ぶ。
  - メインエリア（ドロワー外）は従来通り 1 行のまま（波及なし）。

- (dev v2026.07.29.077) 進捗タブ：ショット別内訳の行クリックで右側スライド、サムネクリックでタブ追加
  - `pmShotBreakdown` のデフォルト表（`pm-stbl`）で、行クリック→`openReviewDrawer(lv.node.id, shot.id)`（動画無しは代表工程→ショット自身にフォールバック）、サムネクリック→`go(tabId)`（タブに追加＋遷移）。
  - ホバーハイライト：行は既存 `tr:hover td{background:var(--bg3)}` に加え `td{cursor:pointer}`。サムネは `box-shadow`＋`transform:scale(1.06)` で強調。
  - サムネクリックは `ev.stopPropagation()` で行クリックを抑止（drawer とタブが両方開く二重発火を防止）。

- (dev v2026.07.29.076) 進捗タブ：ショット別内訳のショット列にサムネを表示
  - `pmShotBreakdown` の未選択時デフォルト表（`pm-stbl`）の「ショット」列に、ショットタブの縦並び（`.shot-row-th` 52×29）と同サイズのサムネを追加。
  - サムネは `ps.latest.v.thumb` を `img.dataset.ref` に載せて `resolveThumbs` で解決（他画面と同じ経路）。動画未アップロードのショットは同サイズのプレースホルダで枠揃え。
  - CSS は `pm-stbl` スコープに `.sn-cell/.sn-th/.sn-ph` を新設（`.shot-row-th` は共有せず独立、他画面への波及なし）。

- (dev v2026.07.29.075) 進捗タブ：工程／ステータスのタブ切替を廃止し 2 カラム並置に
  - `renderProjProgress` から `state.pmTab` 切替 UI（`pm-tabs`）を撤去。左カラム＝工程、右カラム＝ステータスを 1 ページに常時表示する `pm-cols` グリッドを新設（`grid-template-columns:1fr 1fr`、工程なしプロジェクトは `.single` で 1 カラムのみ）。
  - 複数エピソード（`donutMode==='all'`）時は、各カラム内でエピソードごとの円グラフカードを縦並び（`pm-col-body` の `flex-direction:column`）。
  - `state.pmPick` のキー形式を `pid::rowId` から `stage::[pid::]rowId` / `status::[pid::]rowId` に変更し、prefix で種別を判別。片方のカラムで選択すると当該種別のショット別内訳が下段に出る（もう一方のカラムのハイライトは無関係）。未選択時は従来どおりステータスデータでデフォルト表を表示。
  - `state.pmTab` は本 UI では未参照になったため実質デッドフラグ化（副作用回避のため state から削除はしない）。

---

## 反映済み beta v0.0.8（2026-08-04）

- (dev v2026.07.29.074) v073 検証で検出した 2 件を修正（bucket 復元＋v071 の副作用解消）
  - **修正 1（bucket 復元）**：`refreshFromFolders` で shot._rev ガードが `clean=false` を検出した際、`_revBucket(pid).shots` を退避しておいた local 値で書き戻す。従来は readProjectData で bucket が remote の古い値に上書きされたままだったため、直後の `_saveShotWithLock` の楽観ロックが古い knownRev を使い、書き込み `_rev` が非単調に減る可能性があった（GUARD-V 懸念1）。
  - **修正 2（v071 副作用解消）**：`_unionRemoteIntoDB` → `_mergeNodeInto` に `remoteAuthoritative` フラグを追加。`refreshFromFolders` で `remoteAuthoritative:clean` を渡し、`clean=true`（shot._rev ガード通過＝remote は本当に新しい／同値と検証済み）の時だけ v071 の `_stateKeys` 除外を無効化して state 系も remote 採用する。`clean=false`（rollback 検知）時は preferRemote 自体発動しないので影響なし。
  - **効果**：v071 の副作用「他ユーザーの status/assignee/reviewer 変更が autoRefresh で自動反映されない」が **正常時のみ解消**（手動リロード不要に戻る）。rollback シナリオでは引き続き state 系を保護。「rollback 時は守る、正常時は即時同期」の両立が達成。
  - `_authoritative` フラグは `_mergeNodeInto` 内でローカル判定。opts に含めない呼び出し口（`mergeRecoverDatas` 等）は authoritative=false 扱いで従来動作維持。

- (dev v2026.07.29.073) v072 検証で発覚した「v072-1 が no-op」を修正＋失敗時の乖離を根本解消
  - **問題**：v072 検証 scout（SAVE-V B1）が v072-1（shot._rev ガード）は完全な no-op だと指摘。原因：`readProjectData` の内部 `_hydrateShots` が常に `{recordRev:false}` で呼ばれていたため、`_revBucket(pid).shots` が更新されず、比較用の bucket が「local 退避値」と「readProjectData 後の値」で全く同じ値のまま → 分岐は絶対に発動しない。
  - **修正 1**：`readProjectData(id, opts)` に `opts.recordShotRev` を追加。true のとき `_hydrateShots(..., {recordRev:true})` を呼び、remote の shot._rev を bucket に反映する。他の呼び出し口（`_persistNow` 等）は opts.recordShotRev を指定しないので従来通り false のまま（副作用なし）。
  - **修正 2**：`refreshFromFolders` で `readProjectData(e.id, {recordShotRev:true})` に変更。これで v072-1 の shot._rev ガードが本当に動作する。
  - **修正 3（追加対策）**：`saveProjectSplit` で shot 保存に部分失敗があるとき、**project.json も書かないように変更**。従来は shot 失敗しても skeleton は disk に書いていたので「skeleton 新／shot 古」の乖離が発生し、この乖離が巻き戻り事故の温床だった。shot 全部成功時だけ project.json も書き、baseline も更新する形に。
  - **修正 4**：shot 保存失敗トーストを 30 秒スロットル（`_lastShotFailToastAt`）。連続失敗時にトーストが毎回出て煩雑になるのを防ぐ。
  - v071/v072 と v073 の重ね合わせで、多層防御がようやく実効となる。

- (dev v2026.07.29.072) ステータス巻き戻り事故の恒久対策 3 件（v071 応急修正の根本原因を潰す）
  - **1. refreshFromFolders に shot._rev ガードを追加**：readProjectData を呼ぶ前に local baseline の shot._rev を退避、readProjectData 後に remote 側の bucket と比較。remote 側の shot._rev が local より小さい shot が 1 件でもあれば「remote が古い」と判定して preferRemote を発動させない（`clean=false` に落とす）。これで「バックグラウンド同期が disk 側の古い json を掴んで全カット巻き戻り」の根本経路が塞がる。
  - **2. saveProjectSplit に shot 部分失敗の伝播追加**：shot 保存が 1 件でも失敗したら saveProjectSplit 全体を `false` で返す。呼び出し元（`_persistNow`）は `if(ok!==false)` で `_saveCache.proj` 更新をガードしているので、baseline は前回の値のまま → 次回 persist で shot 保存を再試行。従来は shot 保存失敗を無視して project.json だけ書いていたため、「baseline は新 status 全部入りだが disk 側 shot は古い」乖離が発生していた。トーストで再試行を通知。
  - **3. beforeunload に `_persistBusy` ガード追加**：`persist()` 呼び出しごとに `_persistBusy++` / 完了時 `_persistBusy--` で追跡。`beforeunload` で `_persistBusy>0` なら unload 警告。ステータス変更直後にリロード／タブ閉じでバックグラウンドの shot 保存が消えるケースを防ぐ。
  - **v071 との関係**：v071 の応急修正（`_mergeNodeInto` の preferB 分岐で state 系除外）は多層防御としてそのまま残す。恒久対策で「remote が本当に新しい時だけ preferRemote」になるので、v071 の副作用（他ユーザーの status 変更が自動同期で反映されない）は実質発生しなくなる（remote が新しければ preferRemote 発動 → 元経路に入るが state 系はまだ除外中）。v071 の副作用を完全に解消したい場合は次コミットで `_stateKeys` の除外を条件付き（例：remote._rev > local._rev のときのみ上書き）に緩められる。

- (dev v2026.07.29.071) 🚨 緊急応急修正：全カットのステータスが同時刻に一斉に古い値へ巻き戻る事故を止血
  - **事象**：ユーザー報告「気付いたら全カットのステータスが古い状態に戻っており、全 shot json が同時刻で一斉に上書きされていた」（ローカルプロジェクトで発生）。
  - **原因**：`_mergeNodeInto` の `preferB=true` 分岐（バックグラウンド `autoRefresh` の preferRemote 経路）が **disk 側 shot json の `status/assignee/reviewer` を無条件で local に上書き**していた。disk 側が古い状態を持っている状況（クラウド同期の巻き戻し／別タブ書き戻し／`saveProjectSplit` の部分失敗で disk と baseline が乖離、など）で発火すると、local の新しい状態が古い値に一斉巻き戻り、直後の persist で全 shot json に古い値が書き戻される。
  - **修正**：`_mergeNodeInto` に `_stateKeys = new Set(['status','assignee','reviewer'])` を導入。`preferB=true` でも state 系キーは「local が空の時だけ remote 採用」に落とす。他のキー（thumbnail/description/folderName/thumbCrop/type/name）は従来通り preferB で上書き。
  - **副作用**：他ユーザーが status を変更しても、こちら側の自動同期（autoRefresh）で反映されなくなる。手動リロードで反映される。データ損失より整合性を優先する応急措置。
  - **恒久対策（別コミットで対応予定）**：`refreshFromFolders` の clean 判定に `shot._rev` ガードを追加。`saveProjectSplit` の shot 保存部分失敗を上位に伝播して `_saveCache.proj` の baseline 誤更新を防ぐ。

- (dev v2026.07.29.070) 全解析で検出した 🔴 高優先 11 件を一括修正（A1/A2/R1/R2/R3/S1/S2/S3/N1/N2）
  - **A1 送信済みコメント✕に確認ダイアログ**：`noteBlock` の del.onclick 冒頭で confirm。「削除すると復元できません」と警告して誤タップによるデータ損失を防ぐ。
  - **A2 送信済みマネキン再編集**：ダブルクリック時のみ送信済み drawing 内のマネキンをヒット対象にする `mannHitTestAny`/`reelMannHitTestAny` を追加。openMannEditor/reelOpenMannEditor に `opts.noteRef` を渡し、apply 時は履歴ではなく直接 note を dirty マーク＋persist。v058 の送信済み保護方針は消しゴム/投げ縄では維持、マネキンだけ例外的にポーズ再編集を許可。
  - **R1 クリップ外し／全クリアで動画側 reel_emb_ も掃除**：`reelPurgeEmbFor(c)` ヘルパー追加。`clearBtn` / `doNew` / 個別 ✕ で clips から外す前に対応 v.review.notes 内の reel_emb_ を filter で消し、scheduleReelPersist を呼ぶ。警告文も「動画側の描画も削除されます」に更新。
  - **R2 表示Xフレーム変更で過去描画の dur が上書きされる問題**：pending item ごとに p.dur を保存（reelAfterEdit 冒頭で「未定義なら現 durS 値を焼き付け」）。reelSyncEmbedFrame は items の dur の最大値を embed note に採用。reelHydratePending も復元時 cl.dur=n.dur を書き戻し。以降 durS を切り替えても過去描画の dur は変わらない。
  - **R3 fps 変更で描画位置がズレる問題**：`fpsS.onchange` に旧 fps→新 fps の再スケールを追加。pending の p.f を newFps/oldFps 倍に更新、reelAfterEdit(c) で reel_emb_ も同時再構築（古い frame の embed 削除＋新 frame で作り直し）。動画上の実時間位置が保持される。
  - **S1 サブミット作成モーダル閉じで無警告消失**：`subHasUnsavedDraft()` / `subConfirmDiscard()` ヘルパー追加。close ボタン／背景クリックのいずれも subConfirmDiscard を通してから閉じる。
  - **S2 サブミットボタン再クリックで下書き消失**：`subBuildModal` 冒頭で「既存 overlay があり下書きがあれば confirm」に変更。破棄承認まで新モーダルは建てない。
  - **S3 アップロード失敗リトライで動画二重登録**：`createSubmitBlock` で成功したブロックの `_uploadedVersionId` を記録＋file/thumbUrl 解放。次回リトライは既存 version を再利用してスキップ。`subBlockEl` の setPreview で「✅ アップロード済み」表示、pickFile で差し替え時に確認。
  - **N1 タブ切替でドロワーが前タブのまま**：`activeTabKey` を `'browse'` 固定から `'browse:'+state.currentId` に変更。各 review タスクごとに独立した tabDrawers 記憶。
  - **N2 アノテ窓/サブミット窓内で Escape が完全無効**：グローバル Escape ハンドラを「最内側モーダル/パネル優先」に変更。順序：#modal（visible）→ overlay の場合は各自ハンドラ → 通知パネル → フィルタパネル → レビュードロワー → その他。オーバーレイ内でメンバー選択などの #modal を開いても Escape で閉じる。

- (dev v2026.07.29.069) ヘッダのタイトル最大幅を撤廃し、grid セル幅（＝中央バッジ列と干渉しない限界）まで表示
  - `.fb-top` / `.hd` の grid-template-columns を `1fr auto 1fr` → `minmax(0,1fr) auto minmax(0,1fr)` に。minmax(0, ...) にすることで 1fr セルが内容以下にも縮められるようになり、長いタイトルが中央バッジ列を押し出さない。
  - `.fb-title` の `max-width:min(60vw,600px)` を撤廃、`min-width:0;max-width:100%` に。grid セルの実幅まで伸ばす。
  - REEL `.clipname` の `max-width:min(50vw,500px)` 撤廃、`flex:0 1 auto;min-width:0` で clipTitle 内で伸縮。
  - REEL `.clipsub`（版名）の `max-width:min(20vw,220px)` 撤廃、`flex:0 1 auto;min-width:0` で clipTitle 残余で伸縮。
  - REEL の `.cliptitle` に `gap:8px` を追加、`sub` 側の `margin-left:8px` を撤廃して flex gap で余白統一。
  - 結果：タイトルが短ければ普通に、長ければ中央バッジ列の左端まで伸ばして表示、それ以上長ければ省略記号＋ hover で完全表示。

- (dev v2026.07.29.068) REEL タイトル右横に小さく版名（動画名相当）を表示
  - `updReelHeaderInfo` 内で `vOf(c).name` を取得し、`.clipsub` として clipTitle に追加（clipname の直後）。
  - font-size:12px / color:#8a8a99 の控えめな見た目、max-width:min(20vw,220px) で長い版名は省略記号＋hover で完全表示。
  - 「ショット名 / 工程名」（大・白）＋「版名」（小・グレー）の並び。REEL でクリップを切り替えたときに「どの版を見ているか」が一目で分かる。

- (dev v2026.07.29.067) REEL ヘッダもアノテ窓と同じ 3 カラム grid に統一（ロゴ削除・タイトル左詰め）
  - **「REEL / LayCAT」ロゴ削除**：`hd` 内の `.logo` を撤去。REEL は独立ウィンドウなのでアプリ名を再表示する必要が薄く、情報密度を優先。
  - **タイトル (`clipname`) を左詰めに**：新規の `.cliptitle` コンテナを左カラムに置き、`updReelHeaderInfo` の中で clipname を clipTitle に書き込むよう変更。max-width を `320px` → `min(50vw,500px)` に拡張して長いクリップ名も見やすく。
  - **バッジ群 (`.clipinfo`) は真の中央に**：`.hd` を `display:grid;grid-template-columns:1fr auto 1fr` に変更。両サイドの 1fr が同幅を確保するので、真ん中の clipInfo は hd 全体の中央に配置される。
  - **操作ボタン群を `.hd-actions` に集約**：totalLab / loopBtn / clearBtn を新規コンテナに束ねて右カラムに配置。
  - アノテ窓 (v066) と完全に同じレイアウト思想。

- (dev v2026.07.29.066) アノテ窓ヘッダ：バッジ群を fb-top 全体の真の中央に配置（3 カラム grid 化）
  - **fb-top を `display:grid;grid-template-columns:1fr auto 1fr`** に変更。両サイドの `1fr` が同幅を確保するので、真ん中 `auto` に置かれる clipInfo は fb-top 全体の中央に配置される。
  - **操作ボタン群を `.fb-actions` コンテナに集約**：従来は cmpBtn / rb / EXR laySel / expS.wrap / gamS.wrap / egResetBtn / seqCacheBtn / depthWrap / fsBtn を個別に `top.appendChild` していたが、全部 `actions.appendChild` に変えて 1 つの grid セルに収める。
  - **問題背景**：v065 の flex + `justify-content:center` は clipInfo コンテナ内での中央で、fb-top 全体の中央ではなかった。タイトルの長さと操作ボタン数の差で clipInfo が左右にズレていたのを、grid の対称カラムで解消。

- (dev v2026.07.29.065) アノテ窓ヘッダ：タイトルは左詰め、バッジ群は中央寄せの 3 分割レイアウトに
  - タイトル (`.fb-title`) を `.fb-clipinfo` の外＝`fb-top` 直下に移動して左詰めに。動画タイトルが長くなりがちなので、REEL のように中央に押し込めず左端で最大限伸ばせるように。
  - `.fb-clipinfo` は 担当・レビュー chip・ステータスプルダウンだけになり、`justify-content:center` で中央に配置される。
  - 結果、`[ タイトル（左）]  [ バッジ群（中央）]  [ 操作ボタン群（右）]` の 3 分割レイアウト。
  - タイトルの `max-width:min(60vw,600px)` は維持（極端に長い場合は省略記号＋ hover で `tt.title` から全文確認）。

- (dev v2026.07.29.064) アノテ窓ヘッダを REEL と完全同一形に（stEl / log-meta 削除、タイトルにショット名を追加）
  - **タイトル形式を REEL 風に**：`node.name + ' — ' + v.name`（工程名 — 版名）→ `ショット名 / 工程名 — 版名`。REEL の `updReelHeaderInfo` と同じフォーマット。ショット親は `node.type==='review'` なら `getNode(node.parentId)` から取得。
  - **現在ステータス badge (`stEl`) 削除**：右隣のステータスプルダウンと表示内容が重複していたので削除。付随する `updSt()` 関数と `stSel.onchange` 内の `updSt()` 呼び出しも削除。
  - **`log-meta`（by/uploadedAt）削除**：REEL に無く、シンプル化を優先。アップロード者・日時が必要な場面はレビューページ側で確認可能。
  - `shotForAsg` はタイトル計算と担当 chip の両方で使うため、担当 chip ブロック内から外に出して共有。
  - `tt.title` に textContent を設定してツールチップで完全タイトルが読めるように（省略されても hover で確認可能）。

- (dev v2026.07.29.063) アノテ窓ヘッダの clipInfo を中央配置＋タイトル最大幅を拡張
  - `.fb-clipinfo` に `justify-content:center` を追加。情報グループが fb-top の中央に配置される（REEL の clipInfo と同じ挙動）。狭くて全幅を埋める場合は自動的に左寄せ相当。
  - `.fb-title` の `max-width` を `280px` → `min(60vw,600px)` に拡張。動画名が長くなりがちなので、画面幅の 60% までは切らずに表示、それより長い場合のみ省略記号で切る。

- (dev v2026.07.29.062) アノテ窓ヘッダを REEL 風に集約（元 #11 ヘッダ集約レイアウト）
  - **`.fb-clipinfo` コンテナ新設**：fb-top 直下に `flex:1 1 auto` で伸びる「情報グループ」コンテナを設置。REEL の updReelHeaderInfo が使う clipInfo と同じ設計思想。
  - **集約対象**：タイトル (`.fb-title`) ／ 現在ステータス badge (`stEl`) ／ 担当・レビュー chip (`asgHolder`/`revHolder`) ／ アップロード者・日時 (`.log-meta`) ／ ステータスプルダウン (`.status-sel`) の 5 種を全部 clipInfo に詰める。
  - **spacer 撤去**：従来の `<div class="spacer">` は削除。clipInfo が `flex:1` で伸びるため、後続の操作ボタン群（⇄ 比較 / REEL に送る / EXR 系 / 全画面 / 閉じる）が自然に右寄せになる。
  - **意味論的整理**：従来「情報」と「操作」が spacer を挟んで混在していたのを、「clipInfo（情報）」と「右側の操作ボタン群」に完全分離。ステータスプルダウンも従来は spacer の右（操作扱い）だったが、現在ステータス badge と同居させて情報側に移した。
  - **タイトル max-width 制御**：`.fb-title` に `max-width:280px` を追加。集約で他の要素と横並びになるので、長いタイトルで他が押し出されないよう省略記号で切る。

- (dev v2026.07.29.061) REEL 投げ縄まわりの dead code 掃除（v058 で到達不能化した committed 分岐を削除）
  - `_rLassoApply`：`if(it.src==='committed'&&it.noteRef){it.noteRef.edited=true}` を削除。items は必ず pending のみ。
  - `reelLassoUp`：`hadCommitted` 判定と `if(hadCommitted)scheduleReelPersist()` を削除。移動／拡縮／回転で committed を触るケースが v058 で消滅済み。
  - `reelLassoDelete`：`committedChanged` 分岐（committed 削除・note 掃除・scheduleReelPersist）を削除、pending 削除ループを簡素化。行数は 8 行減。
  - どれも動作影響なし（v058 検証で dead-code 化していたのを整理しただけ）。src/noteRef プロパティ自体は items 構造として残置（将来「送信済み選択を復活させる」議論の足場に）。

- (dev v2026.07.29.060) サブミット一覧／モーダルの各カードに 🔗 リンクコピーボタン追加
  - フルページのサブミットタブ（`renderProjSubmits`）とモーダル一覧（`subShowList`）の両方の各 `.subl-item` に「🔗」ボタンを追加。クリックでそのサブミット単体への URL をクリップボードにコピー。
  - 共通ヘルパー `copySubmitLink(sb)` と `makeSubmitLinkBtn(sb)` を新設。URL は既存の routing（`#/n/<projectId>/submit/s/<submitId>`）と一致するため貼り付ければ相手側で該当サブミットが直接開く。
  - ボタン内で `stopPropagation` を呼びカード全体クリック（openSubmitDrawer / subShowView）への伝播を抑止。
  - navigator.clipboard 未サポート環境では `window.prompt` にフォールバック（既存 `copyShareLink` と同じ流儀）。

- (dev v2026.07.29.059) REEL：reelSendCur の pending 更新を in-place にして参照剥がれによるデータ損失を修正
  - **症状**：REEL で「送信」した直後、同じクリップに描いた新しい線が保存されない（画面には見えるが、リロード後・別クリップ切替で消える）。さらに v058 の履歴リセットと組み合わさると、送信直後の Undo で「送信前の pending が全部復活」する挙動になっていた（コメントの意図と真逆）。
  - **原因**：`reelSendCur` L12059 の `c.pending=(c.pending||[]).filter(...)` が新配列を返すため、`c.pending` の参照が差し替わる。しかし `RV.pending` は `loadCur` で `c.pending` の参照を掴んだままなので、以降 stale な古い配列を指すことになっていた。pointerup で RV.pending.push しても c.pending に反映されず、reelSyncEmbedAll が embed 化できず永続化されない → データ損失。
  - **修正**：`c.pending.splice(0, c.pending.length, ...kept)` で in-place 更新。RV.pending との同一参照が維持され、以降の描画は c.pending にも即反映される。v058 の履歴リセットも正しく「送信後の空 pending」を snap するようになる。
  - **発見経緯**：v058 の再解析（HIST-VER / REG-VER）が pre-existing bug として指摘。v058 の履歴リセットで顕在化しやすくなっていたので v058 の一部として即修正。

- (dev v2026.07.29.058) REEL：送信済み drawing は Undo/Redo・消しゴム・投げ縄の対象外に（保護方針への回帰）
  - **設計変更の意図**：v052〜v057 で「送信済み drawing も Undo/Redo できるようにする」方向で修正を重ねたが、他クリップ pending 巻き戻り／text 巻き添え削除／reelSendCur 履歴問題など連鎖バグが増える一方だった。方針を反転し「送信＝ユーザーが明示的にコミットした確定物」として保護する。
  - **消しゴム `eraseR`**：pending のみ対象。送信済み drawing への部分消しは不可（削除したいときは note のゴミ箱ボタン経由）。
  - **投げ縄 `_rPickStrokeAt` / `reelLassoUp`**：pending のみ選択対象。送信済み drawing は選択・変形・削除の対象外。
  - **`_snapR` / `_restoreR`**：`RV.pending` のみをスナップ／リストア（v054 以前と同等）。全クリップの v.review.notes を触っていた V2〜V2-N1 の 50 行を撤去し、5 行のシンプル実装に。`_isReelEmb` ヘルパーも削除。
  - **`loadCur` に履歴リセット追加**：クリップ切替で `RV.pending` が別クリップの `c.pending` 参照に切り替わるので、履歴もリセット。N2-pending バグ（Undo で別クリップの pending に流入）を根本解決。
  - **`reelSendCur` で履歴リセット**：送信＝ pending 空化なので「送信済み ⇔ 未送信」の境界。Undo で送信取消できると意図と噛み合わないため、送信で履歴を切り直す。
  - **副作用（意図的）**：REEL の Ctrl+Z で戻せる範囲は「現在クリップの現在フレームの未送信 pending のみ」。送信済み drawing を誤って完全削除しても復元不可（削除は note のゴミ箱経由でしかできないので、事故確率は低い）。

- (dev v2026.07.29.057) V2-N1 の filter で text 巻き添え削除、送信 note の Undo 消失を修正
  - **N1-B text+drawing 併存 note の Redo で text ごと消えるバグを修正**：`_restoreR` の filter を map ベースに変更。「snap にない drawing 付き note」を機械的に丸ごと除去するのではなく、`drawing:[]` にクリアして note 自体は残す。text/kind/mentions が残るなら保持、全部空なら null で除去（drawing-only note の除去挙動は従来通り）。従来 drawing だけ消しゴムで消した後の Ctrl+Y で text も消えていた。
  - **C1 reelSendCur が履歴を積まない問題を修正**：`reelSendCur` 末尾の persist 前に `_pushHistR()` を追加。V2-N1 の filter が「送信 note を snap に含まないため Undo で削除」する回帰があったので、送信を履歴の境界点にして snap に含める。

- (dev v2026.07.29.056) V2 修正で新規に生じた 2 件のリグレッションを修正（Undo/Redo 対称化＋reel_emb_ 除外）
  - **V2-N1 Redo で「消した状態」に戻せない非対称バグを修正**：`_restoreR` に「snap にない drawing 付き note を各クリップから除去」する処理を追加。従来は「find で書き戻し／無ければ push で復活」しか無かったので、削除→undo→redo の redo で復活した note が残り続けていた。snap 側で `(nodeId+vId+id)` のキーセットを作り、それに無い drawing 付き note（reel_emb_ 除く）は filter で除去。
  - **V2-N2 `_snapR` に reel_emb_ 系除外を追加**：`eraseR` / `reelLassoDelete` と同じく `reel_emb_<nodeId>_<frame>` を履歴対象から外す。載せていると undo で reel_emb_ が push で復活 → 他クリップに切替時 `reelHydratePending` が pending を再構築 → 他クリップの pending 状態まで巻き戻る副作用があった。同期モデル（v036）は pending の Undo で自動的に整合するので、reel_emb_ を履歴に載せる必要は無い。
  - 副作用として V2-N3 のメモリ肥大も緩和（reel_emb_ 分の note が snap から外れるため）。
  - 共通ヘルパー `_isReelEmb(n)` を導入し snap/restore の両方で同じ判定を使う。

- (dev v2026.07.29.055) 動作検証で見つかった 3 件のバグ／未達を修正
  - **V1 REEL クリップ切替中の担当 popover が前クリップを書き換える無自覚データ破壊を修正**：`updReelHeaderInfo` 冒頭で `d.querySelector('.asg-pop')` を明示的に `remove()`。従来は `clipInfo.innerHTML=''` で anchor chip は消えるが popover は `doc.body` 直下に残り、mkChip クロージャの旧 `n` を掴んだまま別クリップの担当を書き換えてしまう深刻なバグだった。
  - **V2 送信済み drawing-only ノートを完全削除→Ctrl+Z で復活しないバグを修正**：`_snapR` を「drawing だけ保存」から「note 全体を deep clone で保存」に変更。`_restoreR` は find 成功時 `Object.assign` で上書き、find 失敗時（note が消されたケース）は `push` で復活。author/time/frame/dur/text/noShot/mentions/kind もまとめて復元される。
  - **V3 REEL のカラーパレット選択中スタイル未定義を修正**：REEL 内 style に `.clr.sel{border-color:#fff;transform:scale(1.15)}` と `.clr` へ `transition` を追加。アノテ窓 `.clr-chip.sel` と同じ意匠で「どの色が選択中か」が視覚判別できるように。.054 の G1 パレット並び統一の目的達成に不可欠だった。

- (dev v2026.07.29.054) REEL 側 UX をアノテ窓に統一（M2/M3/M4/M5/M6/M7/G1 一括修正・アノテ窓 UX は不変）
  - **M2**：全体タイムライン `drawFTL` のコメント（drawing なし）マーカーを **赤い菱形** に変更（従来は fillRect の赤矩形）。中心 `gx=(off+n.frame)*fw`（フレーム左端）、上下 ±3.5 / 左右 ±4 px。アノテ窓 `drawTimeline` と意匠を揃え、描画マーカー（オレンジ矩形）と一目で区別できるように。
  - **M3**：`reelDraftBlock` の `F<n>` フレームチップに `.link` クラスと `onclick`（`video.pause()+seekRTr`）を追加。他 3 兄弟（noteBlock/draftBlock/reelEmbedBlock）と対称に。
  - **M4**：head ツールに **ホバー時の中心ハンドル（破線円）** を追加。`rHoverPt` 変数を新設し、`anno.onpointermove` で更新 → `drawAnno` に描画分岐 → `pointerleave` でクリア。アノテ窓 `drawMoveHandle` と同じ意匠。既存 head ガイドを掴めるかどうかの視覚フィードバックを提供。
  - **M5**：`rebuildRSizeSel` の `sizeS.disabled` 条件を `!RV.tool||RV.tool==='head'` に拡張。head ツール中はブラシ／消しゴムサイズ select を無効化（アノテ窓 `rebuildSizeSel` と統一）。
  - **M6**：`reelRecordCur` 内の `reelNotes(true)` → `reelNotes()`（末尾スクロール抑制）。frame 順ソートに変わった今、末尾＝最終フレームと限らないため。※ `reelRecordCur` は現状 UI から呼び出されない dead-code のため実 UX 変化はゼロ、あくまで将来復活時のための統一。
  - **M7**：`reelDraftBlock` / `reelEmbedBlock` のクリック除外セットを `noteBlock` と同じ広い集合（`button/a/textarea/input/select/.frame-chip/.note-shot` の closest）に統一。将来メンションチップや編集 UI が生えたときの誤シーク防止。
  - **G1**：REEL のカラーパレット並びを **アノテ窓と同じ順** に変更：`[#ff4d4d, #ff9f2e, #ffe34d, #4dff88, #4da6ff, #ffffff, #111111]`。先頭赤に初期 `.sel`。黒の色コードを `#000000` → `#111111` に揃える（既存の pending 描画は色を保持しているので後発描画のパレット選択にのみ影響）。

- (dev v2026.07.29.053) REEL：3D マネキン（mann）ツールのジンバル UI 描画を追加（アノテ窓と統一）
  - `drawAnno` に `RV.tool==='mann'` ブロックを追加。選択枠（点線 rect）／4 隅ハンドル／3 リング（緑=ヨー・赤=ピッチ・青=ロール）＋eye（黄）／中央ハンドル／選択時ラベルを描画。
  - ヒットテスト（`reelMannHitTest`）は既にリング polyline 前提で動いていたが、対応する描画が無かったので「選択したはずのマネキンが見えない・ジンバルが操作できているのに見えない」状態だった。
  - `reelMannRingCanvasPts` / `reelMannDims` は既存を流用。前後判定（`front=0` の背面セグメントはスキップ）もアノテ窓と同じ。
  - ドラッグ中の軸ハイライトも既存の `reelMannDrag.axis` / `reelMannHoverAxis` を参照。

- (dev v2026.07.29.052) REEL：送信済み drawing に対する消しゴム／投げ縄削除が Undo で復元されないバグを修正
  - `_snapR` を `RV.pending` だけでなく「全クリップの `v.review.notes[*].drawing`（drawing を持つ note）」も含めて丸ごとスナップに拡張（アノテ窓 `_snap` と同じ方針）。
  - `_restoreR` で snapshot に載っていた note の drawing をまるごと上書き復元。`edited=true` を打つ。undo/redo 後の persist は既存の `undoB/redoB.onclick` → `reelAfterEdit` 経由で走る。
  - これにより `eraseR`（送信済み drawing の部分消し）と `reelLassoDelete`（投げ縄で送信済み drawing 削除）を触ったあとの Ctrl+Z が正しく元に戻せるように。

- (dev v2026.07.29.051) アノテ窓：SELECT フォーカス中のショートカット暴発を修正（REEL 側と統一）
  - `onKey`（L9960）と `fbKeyDownSpin`/`fbKeyUpSpin`（L8506-8507）の tag 判定に `SELECT` を追加。fpsSel などのプルダウンにフォーカスがあるときに V/,/./X/Space/Arrow/Delete/Backspace が発火してしまうバグを修正。
  - REEL 側は既に `SELECT` 抑制済みだったので、これでアノテ窓と REEL のショートカット抑制条件が一致。

- (dev v2026.07.29.050) 担当・レビュー badge が押せると分かるよう ▾ アイコンと hover ハイライト追加
  - badge を `display:inline-flex` にして、名前ラベル＋`▾` アイコン（小さめ・opacity .7）を並べる。パッと見でプルダウンだと分かるように。
  - hover で背景アルファ .16→.28、`▾` の opacity を 1 に上げる（.1s transition）。押せる感を強化。
  - アノテ窓・REEL 両方に同じ処理。

- (dev v2026.07.29.049) アノテ窓／REEL ヘッダの担当・レビューbadge をクリックで変更できるように
  - **新規ヘルパー `openAsgPickerPopover`**：memberSearchPicker と同じ挙動の検索付き候補リストを、任意の anchor 要素の下に position:fixed で開く popover 版。`opts.doc` に REEL の document を渡すと REEL 側の window ローカルに popover を作成できる（別 window でも動作）。外側クリック／Escape で閉じる。
  - **アノテ窓**：担当／レビュー chip を `rebuildAsgChips()` で再描画可能に。cursor:pointer と title「（クリックで変更）」付き。onclick で popover を開き、選択後に persist → chip in-place 更新 → `render()`/`resolveThumbs()` を呼び出しタスクページ側も追従。
  - **REEL**：担当／レビュー chip 同様にクリック可能。popover は REEL の d.body に配置。選択後に `updReelHeaderInfo()` を再呼び出し（clipInfo 全体を再描画）＋親ページの render も走らせる。
  - **表示ロジック反転**：従来「ショット親優先→node fallback」だったのを「node 優先→ショット親 fallback」に変更。node[field] を書き換えたら即 chip に反映されるようにするため。ショット親に設定がある場合の見え方は変わる（node が明示的に持てば node の値、なければ従来通りショット親の値を継承表示）。
  - **未設定 chip も常時表示**：従来は reviewer が空だと chip を出していなかったが、クリックで設定する導線を出すため常に「レビュー:—」を表示。担当も同様。

- (dev v2026.07.29.048) FB コメント：ブロック全体クリックでシーク＋タイムライン菱形マーカー位置ズレ修正
  - **ブロック全体クリック**：`noteBlock` / `draftBlock` / `reelDraftBlock` / `reelEmbedBlock` の `.log-note` 全体に click リスナ追加。cursor:pointer で押せる感じに。ボタン／入力欄／フレームチップ／スクショなどインタラクティブ子要素はクリック除外（既存動作を保護）。REEL 側は `video.pause()+seekRTr(n.frame)`、アノテ窓は `seekFrame(n.frame)`。
  - **タイムライン菱形マーカーのズレ修正**：`drawTimeline` でコメント菱形の中心 X を `n.frame*fw + fw/2`（フレーム中央）から `n.frame*fw`（フレーム左端）に変更。目盛り／プレイヘッド／オレンジバーと同じ位置に揃うようになった。

- (dev v2026.07.29.047) FB / REEL コメント欄をシンクスケッチ風に（フレーム順ソート＋現在フレームハイライト）
  - **ソート**：`renderNotes` / `reelNotes` で `n.frame` 昇順、`frame==null` は末尾。drafts / embeds も同じ並び。
  - **現在フレームハイライト**：`.log-note` の左端に 3px の緑バー（`#4dff88`）を `.at-cur` クラスで表示。`noteBlock` / `draftBlock` / `reelDraftBlock` / `reelEmbedBlock` に `data-frame`/`data-dur` を書き出し、フレーム変化時に `paintCurrentHighlight` / `paintReelCurrentHighlight` が `classList.toggle` で切替（DOM 再描画なし、毎フレーム約 0.1ms）。
  - `sync()` と REEL の `tick()` の「フレーム変化イベント」内で 1 回だけ呼ぶ。
  - `renderNotes` に `scrollEnd` 引数を追加、送信直後の呼び出しだけ末尾スクロール（削除や refresh 時は現在位置を保持）。

- (dev v2026.07.29.046) REEL 基本 UX をアノテ窓に統一（#1,#2,#4,#5,#6,#7,#10 一括修正）
  - **#5**：ツールバーの並び順を `[pen, erase, size, pres, shape, lasso, head, mann, color, ...]` に統一。
  - **#10**：色パレットに黒（#000000）を先頭追加、選択中の `.sel` ハイライト＋`colorI` 変更で解除。
  - **#6**：REEL の `Delete`/`Backspace` でマネキン選択削除に対応、`Esc` で選択解除。
  - **#4**：アノテ窓の `_restore` で `shapeDraft`/`lassoSel` 系/`headDrag`/`mannDrag`/`selectedMann`/`mannHoverAxis` もリセット（undo/redo でドラフト・選択枠のゾンビ化を解消）。
  - **#1**：REEL の消しゴム(`eraseR`)を `v.review.notes[*].drawing` の committed も対象に拡張。`reel_emb_` 系は同期モデル経由なので除外し、通常の送信済み drawing だけ部分消し。drawing が空になった note は自動掃除、変更時 `scheduleReelPersist`。
  - **#2**：REEL のレイヤーカードに `✕` 削除ボタン追加。`reelDeleteLayer(i)` は pending / stroke / `v.review.notes[*].drawing` の該当レイヤーを削除＋以降のレイヤー番号を shift。confirm 付き、`layerVis` 詰め、activeLayer 補正、`reelAfterEdit` で同期＋persist。
  - **#7**：REEL の投げ縄を committed 対応。`_rPickStrokeAt` と範囲選択 `reelLassoUp` に `noteRef` 付きで committed drawing を追加、`_rLassoApply` は committed 側にも `n.edited=true` を立てる。`reelLassoDelete` で committed drawing を `noteRef.drawing` から除去＋空 note の掃除＋`scheduleReelPersist`。移動/拡縮/回転の pointerup で committed を触ったら persist スケジュール。
  - **#8**（保存フロー）はユーザー確認により **現状維持**（v036 の常時同期モデル）。

- (dev v2026.07.29.045) REEL：Space+ドラッグ系ショートカットをアノテ窓と統一
  - 回転：**Space+Shift+ドラッグ**（v043 の Shift+右ドラッグは廃止）。
  - ズーム：**Space+Ctrl(Meta)+ドラッグ**（併せて右クリック水平ドラッグは維持）。
  - パン：**Space単体+ドラッグ**（併せて ✋トラック／中ボタン／ペンサイドボタンは維持）。
  - Space タップ = 再生／Space+ドラッグ = 再生しない（アノテ窓と統一）。従来 keydown 直後に `play.onclick()` していたため Space 押下瞬間に再生されてしまっていた。keyup で `spaceDrag=false` の時だけ再生に変更。

- (dev v2026.07.29.044) REEL：Shift+右ドラッグ／右ドラッグ で意図せず再生される問題を軽減
  - Shift+右ドラッグ（回転）と 右ドラッグ（ズーム）の pointerdown で `e.stopPropagation()` を追加。下位要素（video / bridge など）や親要素の pointerdown / click 系リスナへの伝播を止める。
  - preventDefault は既に付いているが、propagation を追加で止めることで video 要素の click / Space スペルキーなど周辺挙動の巻き込みを防ぐ。

- (dev v2026.07.29.043) REEL：画面回転（Shift+右ドラッグ）追加＋ブラシサイズ円カーソル（アノテ窓と統一）
  - **回転**：`RZ.rot` / `RZ.spinning` を追加、`applyRZoom` で `flipEl` に `rotate` を適用、`stage.pointerdown` で `Shift+右ドラッグ` を検出（クリスタ準拠、横ドラッグ量 × 0.35°）。パン中も回転補正で自然にドラッグ方向へ動く（rot 分逆回転して補正）。`zrBtn`（等倍）で回転もリセット。zoomLab に度数表示。
  - **ブラシサイズカーソル**：draw / erase 時に `anno` の `cursor='none'` にし、既存 `szRing` を `anno.onpointermove` でリアルタイム追従表示（サイズは `brushW`/`eraseW` × `RZ.s`）。`pointerleave` で非表示。それ以外のツールは `crosshair`。
  - `pointercancel` を追加：ペン離脱・OS 割込などでも panning/zooming/spinning を確実に解除。

- (dev v2026.07.29.042) REEL：右クリック水平ドラッグでズームできるように（アノテ窓と同じ挙動）
  - stage の pointerdown で `button===2 && !altKey && pointerType!=='pen'` を検出 → `RZ.zooming=true` にしてポインタ捕捉、`stage.cursor='zoom-in'`。
  - pointermove で `Math.exp((clientX-zx0)*0.006)` で滑らかにズーム倍率変化、rZoomTo で反映。
  - ペン(Windows Ink)のサイドボタン(button===2)は従来通りパン扱い、Alt+右はブラシサイズ調整に譲る。

- (dev v2026.07.29.041) REEL：ツール未選択でもマウス操作が描画されてしまう問題を修正
  - 原因：`setRTool` が初期化時に呼ばれず、anno（canvas）の CSS デフォルト `pointer-events:auto` のままだった。ツール未選択でも anno がクリックを受け、pointerdown 分岐で仕様上何も起きないはずでも一部条件で意図せぬ挙動になっていた。
  - 対応：初期化直後に `anno.style.pointerEvents='none'` を明示。`anno.onpointerdown` の先頭に `if(!RV.tool)return;` と `if(e.button!==0)return;` を追加（左クリックのみ・ツール選択時のみ受け付け）。

- (dev v2026.07.29.040) REEL：タイムスライダ即時更新＋描画ツールのカーソル修正
  - `reelAfterEdit` の末尾で `drawFTL` と `reelNotes` も呼ぶように。クリア後にタイムラインのマーカーが即消える／コメント欄も即更新される。
  - `setRTool` のカーソルを `t?'crosshair':''` に統一。ペン／消しゴム時に矢印のままだった問題を解消（描画時は全ツール crosshair 表示）。

- (dev v2026.07.29.039) REEL Ctrl+Z / Ctrl+Y キーバインド追加＋アノテ窓のクリアで REEL 由来 embed も削除
  - REEL: `reelWin.keydown` に `Ctrl+Z`（undo）／`Ctrl+Y` または `Ctrl+Shift+Z`（redo）を追加。テキスト入力中は無効。
  - REEL: `undoB` / `redoB` の onclick 末尾で `reelAfterEdit` を呼び、pending 復元後に v.review.notes の同期＋persist も走らせる。
  - アノテ窓: `clearBtn` を「現在フレーム範囲内の pending＋動画埋め込み専用ノート（noteEmbedOnly, `reel_emb_` 含む）」もまとめて削除するよう改修。`_ntomb` に記録して 3-way マージで復活しない。

- (dev v2026.07.29.038) REEL：drawAnno で pending 描画を復活・重複は `reel_emb_` 除外で回避
  - v036 で pending 描画を止めていたため、投げ縄の移動中／拡縮／回転がリアルタイム反映されず、pointerup（or タイムスライダ操作）まで表示が古いままだった。
  - `drawAnno` の v.review.notes 描画から `reel_emb_` プレフィックスの embed ノートを除外＋pending 描画を復活。二重描画にならず、pending 更新はすべてリアルタイム反映される。
  - v.review.notes への同期（persist）は引き続き reelAfterEdit 経由（400ms debounce）で走る。

- (dev v2026.07.29.037) REEL：描画直後にアノテが一瞬消える現象を修正
  - v036 で `drawAnno` の pending 描画を停止した副作用で、pointerup 直後に呼ばれる `drawAnno` は「pending 描画なし＋ v.review.notes に embed 未追加」の一瞬の隙間で何も表示しない状態になっていた。
  - `reelAfterEdit` の末尾で `drawAnno()` を呼ぶことで、同期直後に v.review.notes 経由で再描画されるように。

- (dev v2026.07.29.036) REEL：pending と v.review.notes を「常時同期」する統一モデル（描いたら即タスクページに反映）
  - 真実のソースは `v.review.notes`。REEL の pending はセッション中の表示ミラーに位置付ける。
  - 描画完了・クリア・消しゴム・投げ縄削除の各操作後に `reelAfterEdit` が対象フレームだけ `reelSyncEmbedFrame` で再構築（id=`reel_emb_<nodeId>_<frame>` の固定 ID、1 フレーム 1 embed ノート、`noShot=true`）→ debounce 400ms で `persist`。
  - 「送信」ボタン：現在フレーム範囲の pending の drawing を集約して text 付きノート（noShot なし）を新規 push。対応 embed ノートは同期削除。他フレームや他クリップの pending は触らない。コメントだけの送信も可。
  - `loadCur` で `reelHydratePending` を呼び、v.review.notes の embed ノートから pending を再構築（他ユーザー／他セッションの変更も取り込む）。
  - `drawAnno` の pending 描画は停止（v.review.notes の embed ノート経由で描画される）。RV.stroke（描画中のライブストローク）は従来通り。
  - **既存の運用データを保護**：id が `reel_emb_` プレフィックスのものだけを操作対象にするため、他 note（既存の noShot=true ノート含む）は一切書き換えず削除もしない。
  - `reelNotes` で `reel_emb_` の埋め込みノートはコメント欄から除外（動画にだけ埋め込まれる）。他の noShot=true ノートは従来通り `reelEmbedBlock`（動画埋め込み チップ＋削除ボタン）で表示可能。

- (dev v2026.07.29.035) REEL 潜在バグまとめ修正：クリア pdur 対応／undo/redo でドラッグ状態リセット／動画埋め込みノート削除 UI
  - **クリア**：`p.f!==cf` 完全一致から「表示 dur 範囲内」判定へ。dur=3 で F5 の描画が F5〜F7 に見えているとき、F7 でもクリアで消える。
  - **undo / redo**：`_restoreR` で `rShapeDraft` / `rLassoSel` 系 / `rHeadDrag` / `reelMannDrag` / `reelSelectedMann` / `reelMannHoverAxis` もリセット。undo 中にドラフト・選択枠がゾンビ化する現象を解消。
  - **動画埋め込みノート削除 UI**：`reelEmbedBlock` を新設、`noteEmbedOnly(n)` な notes を REEL コメント欄に「動画埋め込み」チップ付きで表示、削除ボタンで `_ntomb` 記録＋persist。beforeunload 自動保存で生成された幽霊ノートも消せるように。

- (dev v2026.07.29.034) REEL：v033 の描画完了ごと自動埋め込みを撤去（クリア／送信を復旧）＋送信時に描画のみノートは noShot=true 化
  - `scheduleReelAutoEmbed`（pointerup 800ms debounce で pending → v.review.notes に自動移動）を撤去。pending が pointerup 直後に空になっていたため、クリア（`clrB`）も送信（`csend`）も対象なしで無効化されていた。
  - `anno.onpointerup` と `reelMannUp` から `scheduleReelAutoEmbed()` 呼び出しを削除。関数自体は空定義で残置（互換）。
  - 永続化タイミングは 「送信」時 と「REEL 閉じ (beforeunload)」時の 2 つに限定。
  - `reelSendCur`：現在フレーム分の描画も、コメント無し（`n.text` 空）なら `noShot=true` を立てる。コメント付きだけ noteBlock に出す。

- (dev v2026.07.29.033) REEL：pending を「動画埋め込みノート（noShot=true）」として自動永続化＋アノテ窓のコメント削除 confirm も撤去
  - `reelEmbedPending(c)` 追加：クリップの pending を `buildFrameNotes` → `noShot=true` → `v.review.notes.push`、pending は空に。
  - 描画完了（`anno.onpointerup` / `reelMannUp`）ごとに `scheduleReelAutoEmbed`（debounce 800ms）で全クリップの pending を自動反映＋`persist`。REEL で描いた瞬間からタスクページ側の動画にも埋め込みが反映される。
  - REEL 閉じ時（`beforeunload`）にも残 pending を反映して `persist`。
  - `reelSendCur` は現在フレーム分＝コメント付きノート、他フレーム分＝ `noShot=true` の埋め込みノートとして反映する形に更新。
  - アノテ窓側の `noteBlock` 削除ボタンも `confirm('コメントを削除しますか？')` を撤去（REEL 側と挙動を合わせる）。

- (dev v2026.07.29.032) REEL：コメント削除ボタンを reelWin 側で作り直し、click / confirm が届かない問題を修正
  - `noteBlock` は親 window の `document.createElement` で作られた button なので、REEL ポップアップに appendChild しても click ハンドラや `confirm()` ダイアログが機能しない場合があった。
  - REEL の `reelNotes` 内で `noteBlock` 返却 DOM から `.na[title="削除"]` を取り出し、`ce(d,'button',…)` で作った同等の button に置換。confirm 抜きで即削除＋`_ntomb` 記録＋refresh。

- (dev v2026.07.29.031) REEL：未保存カット表示バーと閉じる時の確認ダイアログを撤去
  - `unsentBar` を DOM に追加しない（要素は他コード互換のため生成のみ）。ラベル・保存ボタンは非表示。
  - `updUnsent()` は空関数化。未送信はすべて動画埋め込み扱いなので通知不要。
  - `reelWin.beforeunload` の `hasUnsent()` 確認ダイアログも撤去。

- (dev v2026.07.29.030) REEL：1 段送信を再導入、ただし「タイムスライダの現在フレーム分だけ」送信するように
  - v029 で 2 段に戻していた csend を、再度 `reelSendCur`（1 段）に。
  - `reelSendCur` を「現在フレーム±dur 内の pending だけ」を notes に反映するよう修正。他フレームの pending は残す（＝動画埋め込みとして残る）。
  - これにより「埋め込みだけ残したいアノテ」を消してしまう問題を解消しつつ、送信は 1 段で完了する。

- (dev v2026.07.29.029) REEL：Phase 2 の 1 段送信化を差し戻し＋ドラフトコメント削除の参照比較を修正
  - 「送信」ボタン（`csend`）を `reelSendCur`（直接 notes 反映）から `reelRecordCur`（drafts に積む＝動画埋め込みのみ）に戻す。REEL の 2 段フロー（送信=埋め込み、保存=notes 確定）は意図的な設計のため。
  - Ctrl/Cmd+Enter も `reelRecordCur` に。
  - `reelDraftBlock` の削除ボタンを参照比較 `(x!==n)` からキー比較（`id` または `time+text+frame`）に変更。再描画で n が stale になった際にも確実に削除できるように。

- (dev v2026.07.29.028) REEL：3D マネキンをアノテ窓から移植（Phase 3.4・親ウィンドウで 3D エディタを開く実装）
  - `🎭 3D` ボタン追加。クリックで親 window に `mannequin_3d.html` を開き、apply で REEL の pending にマネキンを追加。
  - 反映後は anno 上で移動・四隅=拡縮・4 リング=軸回転（ヨー緑／ピッチ赤／ロール青／カメラ軸黄）・本体ドラッグ=自由回転。
  - 既存マネキンがあれば mannBtn は再編集モードで開き、ダブルクリックでもポーズ再編集。
  - グローバルの `_mannLoad`/`_mannLoadAsync`/`_mannEnsureQuat`/`_mannEnsureHeadless`/`_mannRender`/`_mannRedrawCbs`/`paintMannequin`/`_qMul`/`_qNorm`/`_qFromAxisAngle` をそのまま流用。
  - REEL ポップアップの `unload` で `_mannRedrawCbs` からコールバック削除＋開き中のエディタ窓を close して掃除。

- (dev v2026.07.29.027) REEL：ステータス切替プルダウンをヘッダ（レビュー担当バッジの隣）へ移動
  - cside 上部の statusBar から clipInfo（ヘッダ中央）へ配置変更。「担当」「レビュー」バッジと同じ行に並ぶ。
  - `updReelHeaderInfo` の末尾で `updReelStatus` を呼ぶ形に変更（clipInfo.innerHTML='' で消されないよう順序を担保）。
  - 旧 statusBar は空のプレースホルダとして残置（display:none）。onchange 後の更新も `updReelHeaderInfo` に切替。

- (dev v2026.07.29.026) REEL：投げ縄／矩形範囲選択をアノテ窓から移植（Phase 3.3）
  - 投げ縄ボタン＋ホバードロップダウン（投げ縄／四角形）を追加。単独クリック=1本選択、ドラッグ=範囲選択。
  - 選択後は選択枠内=移動／四隅=拡縮／上端ハンドル=回転／Delete=削除／Esc=解除（アノテ窓と同じ操作感）。
  - **対象は `RV.pending` のみ**（未送信の描画）。`v.review.notes[*].drawing` の送信済みストロークは今回は非対象。
  - `paintShape`/`paintStrokeList` を再利用、選択枠のオーバーレイ描画は `drawAnno()` 内で追加。
  - `reelWin.addEventListener('keydown',…)` で Delete/Esc をハンドル（テキスト入力中は無効）。

- (dev v2026.07.29.025) REEL：顔ガイドと図形ツールをアノテ窓から移植（Phase 3.1 + 3.2）
  - **顔ガイド**：ツールバーに `◑ 顔の向き` ボタン追加。アノテ窓と同一ロジック（ドラッグ=回転／Shift=傾き／Ctrl=大きさ／中心をドラッグ=移動、消しゴムで削除）。`RV.pending` に `kind:'head'` を push、共通ペインタ `paintHead` で描画。undo/redo・レイヤーフィルタ・アノテ表示切替（ゴースト含む）すべて既存経路で流用。
  - **図形**：ツールバーに図形ボタン（アイコンが選択中の種類に応じて変化）＋ホバーで四角/丸/矢印のドロップダウン。ドラッグで開始点→終点を指定、閾値(6px)以下は破棄。`RV.pending` に `kind: 'rect'|'ellipse'|'arrow'`、共通ペインタ `paintShape` で描画。ドラフト（ドラッグ中プレビュー）は `drawAnno()` 内で追加描画。
  - `setRTool` に `head` / `shape` を対応、`anno.onpointerdown/move/up` に分岐追加。

- (dev v2026.07.29.024) REEL：コメント送信フローをアノテ窓と統一（Phase 2）
  - REEL の「送信」ボタン（`csend`）を、`drafts` に積むだけの `reelRecordCur` から、現在クリップの pending＋コメントを即 `v.review.notes` に反映してその場で `persist()` する `reelSendCur` に差し替え。アノテ窓の `sendCurrent` と同じ 1 段送信フローになった。
  - 「保存」ボタン（`sendAllBtn`）は常時 `display:none` に。`updUnsent` の未送信ラベルは残す（他クリップに未送信の pending が残っているとユーザーが気付けるように）。
  - `reelRecordCur` / `reelSubmit` は他コード互換のため残置（要素は保持、UI からは呼ばれない）。
  - Ctrl/Cmd+Enter も `reelSendCur` に差し替え。

- (dev v2026.07.29.023) REEL：ヘッダのサブタイトル撤去＋カット番号を中央拡大＋ブラシサイズ表示をアノテ窓と統一
  - `.hd` の「シーケンスプレイヤー — メインから動画を送って並べる」サブタイトル span を削除。
  - `.clipinfo` を `flex:1; justify-content:center` に変更して lg（左）と右側ボタン群の間で中央寄せに。カット番号フォントを 12px→15px、weight を 600→700、`max-width` を 260→320 に。
  - ブラシ／消しゴムのサイズ selector を `brushS` / `eraseS` 2 つ → 統合 `sizeS` に集約（アノテ窓と同じ `rebuildRSizeSel` 方式）。`setRTool` でツール切替時に自動リビルド、ラベルが「ブラシ N」／「消し N」に切り替わる。既存参照 `brushS`/`eraseS` は `sizeS` へのエイリアスで互換維持。
  - `.sp` flex spacer は撤去（`clipInfo` が flex:1 でスペーサ役を兼ねる）。

- (dev v2026.07.29.022) REEL：ペン/消しゴムアイコン統一＋ヘッダにカット番号＋担当バッジ追加（Phase 1）
  - **アイコン統一**：REEL の `drawB`／`eraseB` を「✎ 描画」「◌ 消しゴム」のテキストから、アノテ窓と同じ `PEN_SVG` / `ERASER_SVG` に差し替え。ツールバーの視覚言語が揃った。
  - **ヘッダ情報**：`REEL / LayCAT` ロゴの右に `.clipinfo` 領域を追加し、現在のクリップの「ショット名 / 工程名」＋アノテ窓と同じ担当（青）／レビュー（紫）バッジを表示。名簿から表示名解決（`memberById`）、tooltip に元 ID も出す。
  - `updReelHeaderInfo()` を `updReelStatus()` の隣に置き、`loadCur` 内でクリップ切替時に一緒に更新するように配線。
  - コメント送信フロー統一・投げ縄／図形／顔向き／3D マネキンの REEL 移植は Phase 2 以降で対応予定。

- (dev v2026.07.29.021) チェック待ちタブ：`▶ REEL にまとめて送る` ボタンを追加
  - 既存の `⧉ まとめてタブに追加` の隣に、同じ担当者バケット (`bucketPend`) を対象に REEL へ送るボタンを追加。
  - 各カットの `latestVideoVersionUnder(n.id)` で最新動画版を取得し、`openReel()` → `reelAddClip(node, v)` を順次実行。動画無しのカットはスキップ。
  - button style は `btn btn-primary btn-sm`（サブミット詳細の「▶ まとめて REEL に送る」と同じ視覚言語）。

---

## 反映済み beta v0.0.7（2026-07-29）

### A. タスクタブをドラッグで並べ替え（パッチノート掲載）
開いているタスクタブを左右にドラッグして順序変更できるようになった（Chrome のタブ操作準拠）。ドラッグ中に他タブがリアルタイムでスライドし、ゴーストは Y 固定・X のみ追従。並び順はブラウザリロード後も保持され、別プロジェクトのタブが混ざっている状態でも現在プロジェクトのタブだけが正しく並び替わる。内部は HTML5 D&D をやめて Pointer Events で自前実装。

### B. サブミット関連 UI 改善（パッチノート掲載）
- サブミット一覧・詳細に「提出者」バッジ（メンバー色ドット+名前）。
- サブミット一覧サムネイル下にカット番号（ショット名）バッジ。
- サブミット作成のショット選択 UI を作り直し：大サムネのタイルグリッド → 進捗タブと同じ密度の 1 行表示×左右 2 列レイアウト（小サムネ／ショット名／工程チップ／作業担当者を横並び、1 クリックで即選択）。

### C. 内部・UX 調整（パッチノート記載なし）
- **フォント変更**：`Syne` 廃止。ヘッダ・タイトル系は `Space Grotesk + Noto Sans JP` に統一。読みづらさが顕著だったアノテ窓の動画タイトル (`.fb-title`) だけ OS ネイティブフォント (`--font-ui` = system-ui / Hiragino Sans / Yu Gothic UI / Noto Sans JP) に個別切替。CLAUDE.md に「Syne 禁止」ルールを明記。
- **NOTE パネル位置調整**：タスクページの右カラム NOTE パネルが上部の `.task-topbar` / `.task-tabs` と Y 方向で干渉していたのを修正。`sticky top:8px → 84px` に増やし、`task-topbar::after` で下線を NOTE col の右端まで延長。
- **アノテ窓：コメント削除 1 回で消えるバグ修正**：参照比較 (`x !== n`) → キー比較に変更。加えて `v._ntomb`（note tombstone）を導入し、3-way マージで削除済み note が remote から復活しないように（`_ctomb` と同じパターン）。
- **アノテ窓：担当／レビューバッジがメールアドレス表示**になっていたのを、`memberById(root, id)` で名簿引きして表示名に修正。
- **アノテ窓：送信バー撤去**：不要な「未保存 N 件 / 他フレームに N 件」表記を非表示化。通常の送信は入力欄側のボタンで完結。
- **進捗タブ：動画なしショットもタスクページへ遷移可能に**（従来は「このショットには動画がありません」toast で止まっていた）。

### D. 詳細な dev コミット履歴（参考）
<details>
<summary>dev v2026.07.28.005 〜 v2026.07.29.020 の詳細（クリックで展開）</summary>

- (dev v2026.07.29.020) タスクページ：task-topbar の下線を右方向（NOTE col 側）に延長して切れ目を解消
  - v019 で NOTE パネルを下げたため、`.task-topbar` の `border-bottom` が main-col 幅までしか描かれず、右側の NOTE col 上部で線が途切れて見えていた。
  - `.task-topbar::after` を追加：`position:absolute; left:100%; right:-376px; bottom:-1px; height:1px` で、note-col + gap + scroll 右パディング分（合計 376px）を横断する 1px 線を延長描画。
  - 念のため `.scroll` に `overflow-x:hidden` を追加。延長線が万一 viewport 端を越えても水平スクロールが出ないように保険。
  - 1 カラム時（`max-width:960px`）は `::after` を `display:none` で無効化。

- (dev v2026.07.29.019) タスクページ：NOTE パネルが「＋動画／設定／削除」の task-topbar 行にも干渉する不具合を追加修正
  - v018 で 8→24px にしたが、それでも `.task-topbar`（sticky top:0、高さ約 70〜75px）の下端より上に NOTE 上端が来てしまい、右列で同じ Y にボタン行と NOTE が並んで見えていた。
  - `.review-note-col` の `top:24px` → `top:84px` に増やし、task-topbar 下端よりも確実に下に来るように。あわせて `height`/`max-height` calc を `100vh - 256px` → `100vh - 316px` に調整。

- (dev v2026.07.29.018) タスクページ：NOTE パネルが上部のタスクタブバーとくっついて見える不具合を修正
  - `.review-note-col` の `position:sticky; top:8px` → `top:24px` に変更（上部の `.task-tabs` strip との間に 24px の余白）。
  - あわせて `height` / `max-height` の calc を `100vh - 240px` → `100vh - 256px` に調整し、下端が画面外に出ないように。

- (dev v2026.07.29.017) フォント：可愛い太字を保つため `--font-head` / `--font-code` は Space Grotesk に戻し、`.fb-title` だけ `--font-ui`（OS ネイティブ）に切替
  - v016 で全体を OS ネイティブ (`--font-ui`) に統一したが「太字で可愛かったフォントまで変わってしまった」というフィードバックを受けて再修正。
  - `--font-head` / `--font-code` を `'Space Grotesk','Noto Sans JP',sans-serif` に、`--font-body` を `'Noto Sans JP',sans-serif` に戻す（v015 相当）。Google Fonts の `<link>` にも Space Grotesk を復活。
  - `--font-ui` は残しつつ、実際に使うのは **アノテ窓の動画タイトル (`.fb-title`) のみ**に限定。「読みづらい」問題は装飾フォントを避けたい特定箇所だけ個別に切り替える方針。
  - `access-console.html` / `admin-audit.html` の `--font-head` も Space Grotesk に戻す。
  - CLAUDE.md のフォントルールも更新（Syne 禁止・変数の役割・`--font-ui` は個別上書き用と明記）。

- (dev v2026.07.29.016) フォントを OS ネイティブ優先 (`system-ui`) に統一：Space Grotesk も撤去
  - v015 で Syne から Space Grotesk に切り替えたが「もう少し普通のフォントが良い」というフィードバックを受けて再修正。
  - `--font-ui:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Hiragino Sans','Yu Gothic UI','Meiryo','Noto Sans JP',sans-serif` を導入し、`--font-head` / `--font-body` / `--font-code` すべて同じスタックを指すよう統一。macOS = San Francisco/Hiragino、Windows = Segoe UI/Yu Gothic UI、Linux/フォールバック = Noto Sans JP。
  - Google Fonts の `<link>` から `Space Grotesk` を撤去（Noto Sans JP のみ最終フォールバック用に残す）。
  - `access-console.html` / `admin-audit.html` も同じスタックに統一。
  - CLAUDE.md にフォントルールを追記（Syne 禁止 + Space Grotesk も避ける + 標準スタック明記）。

- (dev v2026.07.29.015) `Syne` フォント全廃 → `Space Grotesk + Noto Sans JP` に統一（読みやすさ改善）
  - アノテ窓の動画タイトル (`.fb-title`) が読みづらいという指摘。原因は `--font-head:'Syne'` — 装飾強めで CJK も英数字も両方読みにくかった。
  - `--font-head` を `'Space Grotesk','Noto Sans JP',sans-serif`（`--font-code` と同じスタック）に変更。ヘッダ・タイトル系 27 箇所すべてに一度に反映。
  - Google Fonts `<link>` から `Syne:wght@...` を撤去。読み込みも減る。
  - 同じく `access-console.html` / `admin-audit.html` の `--font-head` も同様に置換。`laycat.html`（Beta）は反映指示待ちで据え置き。`OGREF_Beta.html` は静的リファレンスなので触らず。
  - **今後 `Syne` は使わないルール**（CLAUDE.md に方針として記録するかは別途相談）。

- (dev v2026.07.29.014) アノテ窓：担当／レビューバッジがメールアドレス表示になるのを修正
  - `assignee`/`reviewer` はメンバー ID（メールアドレス）で保持しているのに、そのまま `b.textContent` に出していたため生メール表示になっていた。
  - `memberById(root, id)` で名簿から解決した `m.name` を表示するよう変更。tooltip には「表示名 <メール>」を出して元 ID もわかるように。

- (dev v2026.07.29.013) コメント削除：1 回で確実に消えるように修正（参照比較→キー比較＋note tombstone `_ntomb` 追加）
  - 原因 1：`del.onclick` が `filter(x=>x!==n)` の参照比較で削除していたため、autoRefresh の 3-way マージで `v.review.notes` の各 note に新しい参照が入ると `n` が stale になって filter で消えない → 「もう一度削除ボタンを押さないと消えない」現象。
  - 原因 2：削除しても remote 側にはまだそのノートが残っているので、次の autoRefresh でマージされて復活する可能性があった（note tombstone が無かった）。
  - 修正：
    - `del.onclick` を `nk(x)=x.id||time+text+frame` によるキー比較に変更（マージ側と同じ nk）。
    - 削除時に `v._ntomb.push({k, at})` で note tombstone を記録。
    - `_mergeNodeInto` の notes 統合部で `_ntomb` を先に統合し、tombstone に載る note は local からも取り除き、remote から新規に来た note も tombstone チェックしてスキップ（既存 `_ctomb` と同じパターン）。

- (dev v2026.07.29.012) アノテ窓：送信バー（未保存 N 件 / 保存ボタン）自体を非表示化
  - v011 で「他フレームに N 件」表記だけ外したが、「未保存 N 件」自体も動画埋め込み目的の下書きが残っているだけで通知の必要が無いというフィードバックを受けて `updSubmit()` を常に非表示にする実装に変更。
  - 送信ボタン自体は入力欄側 (`sb`) に別途あるので通常の送信フローには影響なし。

- (dev v2026.07.29.011) アノテ窓：送信バーの「他フレームに N 件の未送信描画」表記を撤去
  - `updSubmit()` のラベルから otherPending 分の文言を削除、drafts の未保存件数のみ表示。
  - 「保存」ボタンの発火条件（drafts + otherPending がある時に表示）は維持しているので、機能自体は変わらず、他フレームの未送信も引き続き「保存」で一括反映できる。

- (dev v2026.07.29.010) サブミット作成 → ショット選択：左右 2 列＋各行 1 行内に収める
  - v009 の 1 列に戻した状態から再び 2 列に。ただし v009 で入れた「工程チップ nowrap + overflow-x auto」はそのまま残っているので、2 列にしても各行は 1 行内に収まる（工程が多くて溢れる場合はチップ列を横スクロール）。
  - モーダル幅を `min(1200px,96vw)` → `min(1500px,97vw)` に拡張。2 列でも工程チップに十分なスペースを確保。

- (dev v2026.07.29.009) サブミット作成 → ショット選択：1 列に戻す＋工程チップを 1 行内に収める
  - v008 の 2 列レイアウトは、幅が狭くなって工程チップが折り返して行高が増えていたため撤回。
  - `.pk-list` を再び `flex-direction:column` の 1 列に。モーダル幅は広めのまま（`min(1200px,96vw)`）維持して 1 行内にショット情報がすべて収まるように。
  - `.pk-stages` を `flex-wrap:nowrap` + `overflow-x:auto` に変更。工程が多くて溢れる場合は横スクロールできる（スクロールバー高さ 0 で見た目シンプル）。`.pk-chip` に `flex-shrink:0;white-space:nowrap` を追加してチップが縮まないよう固定。

- (dev v2026.07.29.008) サブミット作成 → ショット選択：2 列レイアウトに（縦スクロール量半減）
  - `.pk-list` を `display:grid;grid-template-columns:1fr 1fr;gap:4px 8px` に変更。ショット行が左右 2 列で並ぶようになりスクロール量が約半分に。
  - モーダル幅を `min(960px,94vw)` → `min(1200px,96vw)` に拡張して 2 列表示に十分なスペースを確保。工程チップが狭くなりすぎないように。
  - EP 区切りは従来通り、各 EP ごとに 2 列グリッドで並ぶ。

- (dev v2026.07.29.007) サブミット作成 → ショット選択：作業担当者列を行の右端に移動
  - 順序を [サムネ][ショット名][工程チップ][作業担当者] に変更（従来は [作業担当者] が [工程チップ] の左）。
  - `.pk-asg` は `flex-shrink:0; width:160px` 固定のままなので、工程チップは中央で `flex:1` によりのびのび、作業担当者は右端に張り付いて列位置がブレない。

- (dev v2026.07.29.006) 進捗タブ：動画なしショットタイルもクリックでタスクページへ遷移可能に
  - これまでは動画のないタイルをクリックすると `toast('このショットには動画がありません')` で終わりだったが、実際は「まだ提出前で状態編集や担当割当したい」ユースケースがあるので、代表工程 (`ps.curNode`)、なければショット直下の先頭工程、最後の手段でショット自身にフォールバックしてタスクページを開くように変更。
  - ショットタブ側の `mkTile` / `mkRow` は元から `rep` フォールバックしていたので同挙動。進捗タブ側だけ取り残されていたのを揃えた。

- (dev v2026.07.29.005) サブミット作成 → ショット選択：作業担当者列を追加＋列位置を固定
  - 新しく `.pk-asg` 列（幅 160px 固定）を追加。行の見える工程からユニークなアサイニーを集め、メンバーカラーのドット＋名前をバッジで表示。担当者なしは「未割り当て」を薄字表示。
  - `.pk-nm` を `max-width:170px` → `width:110px` 固定に変更。これで「ショット名の長さ」や「担当者数」による列ズレが起きず、工程チップの開始 X が全行で揃う。

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

</details>

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

- **【2026-09-15 Beta v0.2.0 追加サイレント反映】** v:5 status 分離の重大アーキテクチャバグを Beta へ即時サイレント反映（バージョン据え置き・パッチノート記載なし・現場で被害進行中の巻き戻り根本原因を潰したため）：
  - (dev v2026.09.15.001) **【重大アーキテクチャバグ修正】v:5 status 分離を書き込み側にも徹底（案 D 完全実装）**：現場報告「フォルダ同期で status が上書きされて巻き戻る」の根本原因を潰した。
    - **発見した本質バグ**：v:5 の設計で以下の ID 使い分けが完全に食い違っていた
      - setStatus は `node.id`（工程/review task の ID）で `status/{taskId}.json` に書き込む
      - `_hydrateStatuses` / `_migrateV5Statuses` は `shotIds`（親ショット section の ID）で読もうとする
      - **結果：書いた status.json が復元時に一切読まれず、v:5 分離が実質「書きっぱなし」で無効化されていた**
    - **D-1 `storage.listAllStatusFiles(pid)` 追加**：status/ ディレクトリを列挙して全 JSON を並列読み込み。書き込み側で使った ID に関係なく実在ファイルを網羅できる。
    - **D-2 `_hydrateStatuses` を修正**：`parsed.shotIds` 経由 → `listAllStatusFiles` 経由に置換。ファイル内の `shotId` フィールド（＝実際の node.id）で parsed.nodes とマッチさせる。工程 (review task) レベルの status.json が正しく反映される。
    - **D-3 `_migrateV5Statuses` を修正**：section だけでなく **review type ノード（工程）も migrate 対象に**。実際に status を持つのは工程なので、ここが本命。未着手（cur==null）は最初から skip し null→null ノイズも根絶。
    - **D-4 `saveProjectSplit` で shot.json 書き込み時に status キーを除去**：`_stripStatus` ヘルパで shot node と kids から status キーを物理削除してから JSON.stringify。shot.json は status を持たない形に統一。DB.nodes には触らない（memory の status はそのまま維持）。関連する fingerprint 生成箇所（`_shotFileJsonForBaseline`・`_hydrateShots` seed・`_syncShotRevAndCacheFromRemote`・`seedProjBaseline`）も同じ strip ロジックに揃えた。
    - **D-5 `_mergeNode3` / `_mergeNodeInto` から status を除外**：マージスカラーキーから status を削除。3-way マージ・フォルダ同期・refresh の全経路が status に触らなくなる。「フォルダ同期で status が上書きされる」経路が物理的に消滅。
    - **D-6 既存 shot.json の inline status を一括クリーンアップ**：`_cleanupShotJsonStatuses(pid)` を新設。起動時に既存 shot.json を全走査、各 node から status キーを削除して disk と write の形を統一。件数はコンソール出力（トーストなし・静かに動く）。
    - **これで status.json が唯一の権威源**：読み書き両方で status に触るのは setStatus 経由の status.json のみ。マージ・refresh・Object.assign 系の間接経路は全て status に触らない。多重タブ・多重ユーザーで status が巻き戻る余地が原理的に消えた。
    - APP_VERSION：2026.09.14.009 → 2026.09.15.001

- **【2026-09-14 Beta v0.2.0 追加サイレント反映】** 監査ログ機能・v:5 復元経路の重大バグ修正 (v.001〜v.009) を Beta へサイレント反映（バージョン据え置き・パッチノート記載なし・現場で被害進行中の巻き戻り根本原因を潰したため即時反映）：
  - (dev v2026.09.14.009) **【重大バグ修正】`loadProject` に `_hydrateStatuses` 呼び出しを追加**：v:5 status 分離の効果が起動時・F5 リロード時のパスで無効化されていた重大な抜け穴を修正。UI 巻き戻りの根本原因の一つ。
    - **原因**：v:5 MVP 実装時、`readProjectData` にのみ `_hydrateStatuses` を追加し、`loadProject`（起動時・F5 リロード時のパス）に追加し忘れていた。
    - **影響**：
      - autoRefresh 経由の同期時：`readProjectData` → `_hydrateStatuses` → v:5 復元 ✅
      - **F5 リロード・初回起動時：`loadProject` → `_hydrateStatuses` 未呼び出し** → shot.json inline の古い status がそのまま反映 ❌
    - **具体的な再現手順**：同一ショットを複数タブで開く → タブ A で status 変更 → タブ B でリフレッシュより先に担当者変更（3-way マージで shot.json inline に古い status が書き込まれる）→ タブ A で F5 → shot.json inline の古い status が反映されて UI 上で巻き戻り発生
    - **修正**：`loadProject` の両パス（R2 / フォルダ）に `await this._hydrateStatuses(id,parsed)` を追加。これで起動時・F5 リロード時にも status.json による権威源復元が働く。
    - APP_VERSION：2026.09.14.008 → 2026.09.14.009
  
  - (dev v2026.09.14.008) **v:5 復元処理の可視化＋整合性チェックボタン追加**：現場で「読込上書きで status が巻き戻った」報告あり、v:5 の復元が本当に効いているかを実行時検証できるようにする。
    - **`_hydrateStatuses` に監査ログ記録追加**：`hydrateShots:Object.assign` の直後に走る v:5 復元処理を audit log に記録（source: `hydrateStatuses:v5restore`・緑・防御動作扱い）。これで「読込上書きで書き換わった直後に v:5 が正しい値に戻している」という一連の防御シーケンスが log 上で可視化される。
    - **`_verifyStatusIntegrity(pid)` 診断関数を追加**：全ショットについて memory の `node.status` と disk 上の `status/{sid}.json.status` を比較。不一致があれば v:5 分離の抜け穴と判定できる。コンソールから `_verifyStatusIntegrity()` で呼び出し可能。
    - **監査ログモーダルに「🔬 整合性チェック」ボタン追加**：ワンクリックで整合性検証、結果を toast / alert で表示。不一致があれば要調査、なければ v:5 分離は正常。
    - **切り分けフロー**：
      1. 「読込上書き」ログを見た時にすぐ「整合性チェック」を実行
      2. すべて一致 = 復元が働いている（UI は正常）
      3. 不一致あり = v:5 抜け穴（要修正）
    - APP_VERSION：2026.09.14.007 → 2026.09.14.008
  
  - (dev v2026.09.14.007) **監査ログ：ショット絞り込みセレクタ追加＋フォルダ同期を「通常同期」に降格**：現場運用フィードバックに対応。
    - **ショット絞り込みセレクタ**：モーダルのフィルタバーに「対象ショット」ドロップダウンを追加。events 中に登場する shotId を件数多い順で列挙、`ショット名 (件数)` の形式。カットごとの履歴に絞り込んで見られる。
    - **フォルダ同期の色を赤 → 青に降格**：`unionRemoteIntoDB:refresh` は多重ユーザー運用の正常同期経路であることが実運用で確認できたため、`danger:true 赤` → `danger:false 青` にリクラス。⚠ 要確認バッジと赤背景が消え、正常動作として扱われる。
    - 赤（⚠ 要確認）は「巻き戻り事故の主犯経路」の `3-way マージ` / `v<4 マージ` に限定。
    - 黄（要確認）は「状況次第で危険」の `復元処理` / `読込上書き` に限定。
    - 検索プレースホルダを「ショット名・user...」に更新。source セレクタも日本語ラベル化。
    - 凡例文を「色分けの新しい意味」に合わせて書き直し。
    - APP_VERSION：2026.09.14.006 → 2026.09.14.007
  
  - (dev v2026.09.14.006) **監査ログの表示を「いつ・誰が・どの操作で・対象ショット・変更内容」の 5 列に読みやすくリファクタ**：ID 表示が読めないという現場フィードバックに対応。
    - **列構成**：`いつ` `誰が` `どの操作` `対象ショット` `変更内容` の 5 列。従来の `ts / shot / from→to / source / by` の順序を変更。
    - **時刻**：メイン表示は「M/D HH:MM」の短縮形。下段に完全形の ISO を muted 表示。
    - **誰が**：`@` 前の名前部分をメイン表示、フル email はサブ表示（`@` があるときのみ）
    - **どの操作**：8 種類の source を日本語ラベル化＋色バッジ化
      - `UI 操作`（紫）／`版アップロード`（シアン）／`提出`（緑）／`初回移行`（グレー）
      - `3-way マージ`／`v<4 マージ`／`フォルダ同期`（赤・⚠ 要確認）
      - `復元処理`／`読込上書き`（黄・⚠ 要確認）
      - IDs の生表示は廃止。source フィルタは内部 ID 経由（filter は継続動作）
    - **対象ショット**：メインはショット名、下段に階層パス（Scene A / SC-010 形式）を muted 表示
    - **変更内容**：`未着手 → 作業中` の形式でステータス名＋各ステータスの色を反映。ID の生表示（`in_progress` 等）は廃止
    - フォーマッタ群 `_fmtTs / _fmtUser / _fmtSource / _fmtShotPath / _fmtStatus` を導入
    - `_sourceLabels` テーブルで日本語ラベル化を集中管理
    - APP_VERSION：2026.09.14.005 → 2026.09.14.006
  
  - (dev v2026.09.14.005) **監査ログモーダルに 3 つ目のタブ「生データ（JSON）」を追加**：F12 コンソールを開かなくても UI 上で status/*.json の実データを直接確認できる。
    - **ショット選択ドロップダウン**：全ショットをプルダウンで選択、`ショット名 · status:X · history:N` の形式で表示。履歴が多い順にソート、status.json が無いショットは末尾に `⚠ status.json 無し` バッジ付き
    - **「全ショットサマリ」ビュー**：デフォルト表示。プロジェクト全体の統計＋先頭 20 ショットの status.json 概要（shotId・status・updatedAt・historyLength・_rev）を整形 JSON で表示
    - **個別ショットビュー**：選んだショットの status.json 全内容を整形表示。ファイルが無ければ `⚠️ status/{sid}.json は disk に存在しません` と警告表示 + DB ノード情報も表示
    - **クリップボードコピーボタン**：表示中の JSON をワンクリックでコピー
    - **切り分け目的**：「history[] が空/ない → disk に届いていない」／「history[] があるが上のタブに出ない → 表示側バグ」の判別が UI だけで可能に
    - APP_VERSION：2026.09.14.004 → 2026.09.14.005
  
  - (dev v2026.09.14.004) **監査ログモーダルの表示側フィルタを完全撤廃＋診断バー・生 JSON ダンプ追加**：現場で「JSON にデータあるのに表示されない」との報告あり、表示側の過度なフィルタが原因の可能性を排除。
    - **表示側フィルタ撤廃**：`null→null / 同値エントリを表示側で全部除外` を撤廃。クリーンアップは disk 側（`_cleanupNullStatusHistories`）だけに任せる。表示側は全エントリをそのまま流す。
    - **診断バー**：モーダル上部に「DB ショット数・status.json 読込数・履歴あり数・history 総エントリ数・audit 総件数」を常時表示。0 のカラムがあれば読み込み側の問題と即判定できる。
    - **生 JSON ダンプボタン**：「🔍 生 JSON をコンソールに出力」で shotIds・statusFiles 全て・auditEvents・historyEvents を console.group で完全出力。ユーザーが F12 で内容確認可能。
    - **console.group 診断ログ**：モーダルを開いた時点で自動的にコンソールに shot count / loaded files / history entries の統計と最初のショットの status.json 全体を出力。
    - APP_VERSION：2026.09.14.003 → 2026.09.14.004
  
  - (dev v2026.09.14.003) **監査ログのノイズ対策・複数月対応・日別ヒストグラム追加**：v.049 の一括マイグレで null→null ノイズが大量に生成されて実際の変更履歴が埋もれていた問題を修正。
    - **マイグレ修正**：`_migrateV5Statuses` で未着手（cur==null）のショットは history エントリを生成しない（`from:null,to:null` の無意味エントリを廃止）
    - **既存データのクリーンアップ**：`_cleanupNullStatusHistories(pid)` を新設。起動時に全 status/{sid}.json を走査して null→null や同値エントリを一括除去。件数をコンソールに出力（トーストは出さない）。
    - **表示側フィルタ**：setStatus 履歴タブでも null→null エントリを表示時に除外（既存の破損データが残っている環境向け安全網）
    - **月フィルタセレクタ**：モーダルの両タブに月選択ドロップダウンを追加。デフォルトは「全期間」。
    - **listAuditMonths / readAuditAll**：audit ディレクトリ内の全 YYYY-MM.jsonl を列挙・読み込み。旧実装は "今月" 固定で他月のログが見えなかった問題を解消。
    - **日別ヒストグラム**：モーダル上部に日別イベント数の棒グラフを表示（どの日にどれだけ変更があったか一目で把握）
    - APP_VERSION：2026.09.14.002 → 2026.09.14.003
  
  - (dev v2026.09.14.002) **監査ログモーダルに「setStatus 履歴（分離データ）」タブを追加**：v:5 で分離した `status/{sid}.json` の `history[]` をショット横断で集約表示するタブを追加。既存の「全経路（監査ログ）」タブと 2 タブ構成にリファクタ。
    - **タブ 1「全経路（監査ログ）」**：`audit/YYYY-MM.jsonl` の全記録（merge3・unionRemote・review-fallback・setStatus 全部）
    - **タブ 2「setStatus 履歴（分離データ）」**：各 shot の `status/{sid}.json.history[]` を flatten して集約表示。**ユーザー明示操作のみのきれいな narrative**（マージ・refresh 系のノイズなし）。「そのショットが今の状態に至った経緯」を辿るのに最適。
    - 共通実装 `renderEventsPane(pane, events, opts)` を導入して 2 タブで再利用。検索・source フィルタ・CSV 書き出し・巻き戻り疑い赤ハイライト・トレース tooltip も全部両タブで動作。
    - APP_VERSION：2026.09.14.001 → 2026.09.14.002
  
  - (dev v2026.09.14.001) **ステータス変更専用の監査ログ機能**：v:5 導入後も現場で巻き戻り再発しているため、**あらゆる書き換え経路**を全部記録して原因追跡できるようにする。
    - **storage.appendAudit(pid, events) / readAudit(pid, yyyymm)** 追加：`projects/{pid}/audit/YYYY-MM.jsonl` に append-only 記録。R2 未対応（フォルダ運用のみ）。
    - **記録スキーマ**：`{ts, kind:'status_change', shotId, from, to, by, source, trace, ...extra}`
    - **`_queueStatusAudit / _flushStatusAuditBuffer`**：200ms バッファで連続イベントをまとめて 1 回書き込み（read-modify-write 削減）。
    - **`_snapshotShotStatuses(pid) / _diffAndLogStatusChanges(pid, before, source)`**：任意の書き換え経路の前後で status 差分を検出→ログ。
    - **`_logStatusChange(pid, sid, prev, next, source, extra)`**：単発ログ（prev===next は自動 skip）。スタックトレースを短く付与。
    - **記録対象の書き換え経路**（source ラベル）：
      - `setStatus:ui / setStatus:upload / setStatus:submit / setStatus:migrate` … 正常な明示操作
      - `merge3:saveShotWithLock` … 3-way マージ（knownRev/remoteRev/sid 付き）← 最有力容疑
      - `applyMergedIntoDB:v<4` … v<4 プロジェクトの全体 3-way マージ結果
      - `unionRemoteIntoDB:refresh` … refresh 経路の union-fill（opts 付き）
      - `normalizeNodes:review-fallback` … review.status からの復元（lastVer 付き）
      - `hydrateShots:Object.assign` … 既存値がある場合の disk 上書きのみ（初回 null→X はノイズ抑制）
    - **UI ビューア（openStatusAuditModal(pid)）**：プロジェクト設定モーダルに「📜 監査ログを見る」ボタン追加。
      - 検索・source フィルタ・巻き戻り疑い source を赤背景ハイライト（merge3・unionRemote・review-fallback・applyMergedIntoDB）
      - 行ホバーでスタックトレース＋全データ表示
      - CSV 書き出し対応
      - 最新順表示・500 件で打ち止め
    - **コンソール API**：`_showStatusAudit(pid, limit)`（console.table 表示）／`openStatusAuditModal(pid)`（モーダル）
    - APP_VERSION：2026.09.12.002 → 2026.09.14.001

- **【2026-09-12 Beta v0.2.0 追加サイレント反映】** ステータス JSON 分離（v:5 MVP）＋既存プロジェクト一括マイグレを Beta へサイレント反映（バージョン据え置き・パッチノート記載なし・現場の巻き戻り被害を即座に止めるため）：
  - (dev v2026.09.12.002) **既存プロジェクトの v:5 一括マイグレ**：現場で巻き戻り事故が進行中のため、lazy 方式から一括マイグレ方式に変更。起動時に `normalizeNodes` 実行後、全プロジェクトの全ショットに対して `status/{sid}.json` を自動作成（`_migrateV5Statuses(pid)`）。バックグラウンド実行（400ms setTimeout）で boot を止めない。0 件時は無音、1 件以上でトースト通知。既に status.json がある shot は skip（idempotent・複数回実行しても副作用なし）。R2 プロジェクトは saveStatus が false を返して自動 skip。`normalizeNodes` の review.status フォールバックで復元された値もこのマイグレで正しく永続化される。
  - (dev v2026.09.12.001) **ステータス JSON 分離（v:5 MVP・フォルダ運用のみ）**：巻き戻り事故の根本解決に向けた第 1 弾。docs/TODO.md の設計に沿って、ステータスを `projects/{pid}/status/{sid}.json` に物理分離し、3-way マージ経路から外す。**マージロジック側はまだ status を触るが、読み込み時に status.json で override するため事実上事故は起きなくなる**。R2 プロジェクトは本 MVP で対象外（引き続き v:4 inline 動作・saveStatus は no-op を返して自動フォールバック）。
    - **storage 層に 4 API 追加**：`loadStatus / saveStatus / delStatus / loadAllStatuses`。R2 backend は null/false/[] を返して安全にフォールバック。ファイル形式：`{v:1, shotId, status, updatedAt, updatedBy, source, history:[{ts,by,from,to,source}], _rev}`
    - **`setStatus(node, newStatus, source)` ヘルパを新設**：ステータス変更の唯一の入り口。memory の `node.status` 更新＋`status/{sid}.json` の作成/更新＋history の append を一括処理。既存の 5 サイトを差し替え（UI onchange × 3・uploadVersion × 2・提出フロー × 1・REEL ドロップダウン × 1）。
    - **`_hydrateStatuses(pid, parsed)` を `readProjectData` に組み込み**：`_hydrateShots` の直後に status/*.json を並行読み込みし、shot ファイル inline の `node.status` を上書き（status.json が権威源）。
    - **`normalizeNodes` の `review.status` フォールバックに v:5 除外**：`_v5StatusShots` Set で v:5 status を持つショットを追跡し、明示クリア意図が旧版 review の `approved` 等で復元される事故を防止。
    - **削除経路の同期**：`saveProjectSplit` の消えたショット削除ループに `delStatus` と `_v5StatusShots.delete` を追加。ショット削除時に status/*.json も残さない。
    - **v.048 の 3 段防御は現状維持**：本 MVP はステータス保存経路の分離のみで、3-way マージから status を除去する Phase 7 は今後実装。それまでは 3 段防御と共存（多重防御）。

- **【2026-09-09 Beta v0.2.0 追加サイレント反映】** ステータス巻き戻り 第 2 弾恒久対策を Beta へサイレント反映（バージョン据え置き・パッチノート記載なし）：
  - (dev v2026.09.09.001) shot1/2 に DD アップロード後に shot3 の「個別工程」を変更すると shot1/2 の status が旧値へ巻き戻る変種を修正（v.045 の 3-way マージ調整で顕在化した副作用パス）
    - **Fix ①（per-shot baseline 同期漏れの解消）**：`_saveCache.shot[pid][sid]` を「保存応答の凍結 JSON」から、`DB.nodes` を `saveProjectSplit` と同じ形で再ストリンガイズする共通ヘルパ `_shotFileJsonForBaseline(pid,sid)` 経由に置換。`_hydrateShots` の初回 seed も `Object.assign` による骨格併合後の `parsed.nodes` から作るように変更。これで「baseline と次回 persist が生成する fingerprint」の JSON 表現ズレが原理的に発生しなくなり、shot3 変更で shot1/2 が false-dirty 判定に落ちる主経路を閉塞。
    - **Fix ②（`_saveShotWithLock` rev 逆行ガード）**：`remoteRev < knownRev` の remote 読み結果を `null` 扱いにして 3-way マージを回避、自分の状態を `nextRev` で forward-correct 書き。他タブの部分失敗・R2 eventual consistency・FS 同期遅延でも rollback ベクターに落ちない。console.warn で診断可能。
    - **Fix ③（`_syncShotRevAndCacheFromRemote` bucket 上書きガード）**：`raw._rev` を無条件で `shotBucket[sid]` に書いていたのを `nr > cur` の時だけ更新するようガード。rolled-back な内容を新 baseline として固定してしまう二次事故を防ぐ。
    - 3 段防御構成：主経路（①）＋ 3-way 発火時の rollback フェイルセーフ（②）＋ 状態を汚染しないための書き込み側ガード（③）。v.045 の proj 側修正と設計思想を揃え、shot 側にも同等の耐久性を持たせた。

- **【2026-09-08 Beta v0.2.0 追加サイレント反映】** 以下の項目を dev → beta v0.2.0 と同時にサイレント反映（パッチノート未記載・運営限定変更・実装未完成の revert 等）：
  - (dev v2026.08.07.047) v.046 の顔の向きガイド 3D 版（head3d）を revert：開発時間の兼ね合いで一旦削除。将来再開する場合は git 履歴（コミット 74e44fd）を参照。
  - access-console.html：廃止済み `adminEmails` ロールの参照残骸を除去（`tiers()` が返さない `admins` を destructuring/spread で使い続けており `[...undefined]` で paint() が TypeError クラッシュ → ドメイン許可ログイン者リストと招待一覧が空表示になっていた）
  - access-console.html：権限付与ウィンドウ（別ウィンドウ）に「ドメイン許可でログイン中」セクション追加＋メイン画面の同カードは削除（集約）
  - リポジトリ整理：未参照 `image1-4.png` 削除／`gen_*.py|.js` を `scripts/` 移動／`.pptx|.docx` を `deliverables/` 移動／`OGREF_*` を `legacy/` 隔離
  - `docs/DEAD_CODE_ANALYSIS.md` 新設（scout デッドコード解析結果 15 件＋要ヒアリング 2 件＋未使用 CSS 30+ 件を記録）
  - `docs/TODO.md` 新設（タブグループ作成機能の論点・MVP 提案を記録）

- **【2026-09-02 Beta v0.1.0 追加サイレント反映】** 以下の 13 件を dev → beta にサイレント反映（バージョン据え置き・パッチノート記載なし・次以降のパッチノートで拾う候補）：
  - (dev v2026.08.07.039) 提出直後のステータス巻き戻りバグ修正（多重タブ＋フォルダ運用で発生）— `_hydrateShots` で `_saveCache.shot[pid][sid]` を初回 seed し 3-way マージの fill-only 化を防止
  - (dev v2026.08.07.038) タイムリマップ M1 修正：`timeRemap` の 3-way マージ強化（fill-only 残穴を塞ぐ・`_mergeNodeInto` に preferRemote 上書き＋`_mergeNode3` に版レベル 3-way 追加）
  - (dev v2026.08.07.037) タイムリマップ B-1／C-1 明示バッジ対応（案 B：本実装せず・現状仕様の告知に留める）— リタイマー本体／版タイル／アノテ窓／書き出しボタンに「※ ビューア内プレビュー専用」を明記
  - (dev v2026.08.07.036) タイムリマップ副作用の安全網修正（A-1／A-2／F-1・I-1／F-3／H-1・H-3／H-5）
  - (dev v2026.08.07.035) タイムリマップ：グラフエディタでもタイムスライダと同じスクラブ（ドラッグ追従・整数スナップ・再生自動停止）
  - (dev v2026.08.07.034) アノテ窓トップバーに「⧗ リタイム」ボタン追加（⇄ 比較の左隣・動画版のみ）
  - (dev v2026.08.07.033) タイムリマップ：キーフレーム数値入力バーを常時表示に変更（選択時のガタつき解消）
  - (dev v2026.08.07.032) タイムリマップ：選択キーフレームの t / s を数値入力で直接編集可能に
  - (dev v2026.08.07.031) タイムリマップ：タイムスライダ上でもキーフレームの t（タイミング）をドラッグ編集可能に
  - (dev v2026.08.07.030) タイムリマップ：タイムスライダをスクラブ時に整数フレームでスナップ＋カーソルを default（矢印）に
  - (dev v2026.08.07.029) 書き出しのカクつき／アノテ同期ズレ改善（rvfc / captureStream 60Hz / ビットレート 12Mbps）
  - (dev v2026.08.07.028) アノテ焼き込み動画書き出し機能を実装（単一版＋REEL 両対応・MP4／音声込み・Canvas + MediaRecorder）
  - (dev v2026.08.07.027) ステータス勝手切替バグの対策：`_mergeNode3` の 3-way 判定を厳格化＋ EXR 連番のサイレント対応

- **【2026-08-07 Beta v0.1.0 追加反映】** 以下の 43 件は dev → beta にサイレント反映（v0.1.0 パッチノートには載せず、UI 微調整・バグ修正・階層モデル整備・機能追加は次以降のパッチノートで拾う候補）：
  - (dev v2026.08.07.023) ノート・コメント内の URL を自動リンク化（クリックで新規タブで開く）
  - (dev v2026.08.07.020) チェック待ちタブのサブミットコメント幅を拡張（左寄せ）
  - (dev v2026.08.07.019) チェック待ちタブのサブミットコメントを右カラムに移動（左のショット情報と横並び）
  - (dev v2026.08.07.018) チェック待ちタブの各行に「サブミットコメント」を表示
  - (dev v2026.08.07.016) サイレント・アップロード時はステータス自動変更も無効化
  - (dev v2026.08.07.015) アップロードモーダルに「チェック担当者に通知を送る」チェックボックスを追加（既定 ON）
  - (dev v2026.08.07.014 / mannequin v6) 3D エディタからの 2 回目以降「レビューに反映」が効かない不具合を修正（TDZ 例外／レース／queue デッドロックの 3 点対策）
  - (dev v2026.08.07.013 / mannequin v5) アノテ窓/REEL 反映時の初期フレーミングを改善（キャラを近く・大きく表示）
  - (dev v2026.08.07.012 / mannequin v4) 3D マネキンの役割分離：3D エディタのカメラ角度をアノテ窓/REEL に反映しない＋拡大時の解像度自動追従
  - (dev v2026.08.07.011 / mannequin v3) 3D エディタ（マネキン）に指ボーンを追加（左右 5 本 × 3 関節 = 30 本、VRM 標準）
  - (dev v2026.08.07.010) 作業担当・チェック担当（および状態系スカラー）の「未割当に戻す」操作が巻き戻るバグを修正（`_mergeNode3` の 3-way 厳格化）
  - (dev v2026.08.07.009) REEL のステータス変更プルダウンをカスタム DIV ドロップダウンに置き換え（ネイティブ `<select>` の白ポップアップ問題を回避）
  - (dev v2026.08.07.008) REEL iframe の初期 HTML 書き出し時点で `color-scheme:dark` を documentElement 属性に埋め込む
  - (dev v2026.08.07.007) REEL iframe の color-scheme:dark を多重指定で強制
  - (dev v2026.08.07.006) REEL のステータス変更プルダウン：直接 `color-scheme:dark` をインラインで適用
  - (dev v2026.08.07.005) REEL のネイティブ `<select>` プルダウンをダークテーマに（アノテ窓と揃える）
  - (dev v2026.08.07.004) ショットタブ右スライドの工程タイル：ダブルクリックでタブに追加
  - (dev v2026.08.07.003) ショットタブのグリッド／縦並び切替を「アイコンだけのセグメンテッドスイッチ」に変更
  - (dev v2026.08.07.002) チェック待ちに集約するステータスをプロジェクト設定で選択可能に（`checkWait:true` フラグ・複数選択可）
  - (dev v2026.08.07.001) ショットタブのヘッダ左上に表示中のショット数を表示（担当フィルタ適用時は「表示中 N / 全 M」形式）
  - (dev v2026.08.06.024) プロジェクト削除時にリールも確実に消えるよう修正（`DB.reels` 防御的フィルタ＋共有フォルダ `reels/` 掃除）
  - (dev v2026.08.06.023) 新規プロジェクトモーダル「保存先フォルダを選択」見出しの絵文字 📁 を無彩色 SVG に変更
  - (dev v2026.08.06.022) 新規プロジェクトモーダルの「保存先フォルダ」指定を目立たせる（大見出し＋区切り線＋主要ボタン化）
  - (dev v2026.08.06.021) プロジェクト削除に「データも削除／接続だけ解除」の 2 択モーダルを追加
  - (dev v2026.08.06.018) アノテ窓のコメントパネル対象修正（`.log-side`→`.fb-side`・272→408px）＋ REEL は 393px に差し戻し
  - (dev v2026.08.06.017) REEL のコメントパネル（`.fb-side`）をさらに拡張：393 → 460px
  - (dev v2026.08.06.016) v.015 で対象外の作業ページ NOTE パネル（`.review-note-col`）まで広げていたのを元に戻す
  - (dev v2026.08.06.015) アノテ窓 / REEL のコメント欄横幅を約 1.5 倍に拡張（行数増加を軽減）
  - (dev v2026.08.06.014) 起動時に `navigator.storage.persist()` をリクエスト（IndexedDB を永続化）
  - (dev v2026.08.06.013) 新規プロジェクト作成時、ログイン中のユーザーを自動的に owner ＆ 最初のメンバーとして登録
  - (dev v2026.08.06.012) 追加モーダルの「連番で複数作成」既定値：開始番号 10→1、増分 10→1（桁数=3 のまま → 例: name001, name002, name003）
  - (dev v2026.08.06.011) 階層モデル名称統一：エピソード階層のラベルを "エピソード" に、旧 "タスク" 表示を "作業ページ" に統一（ショット呼称は据え置き）
  - (dev v2026.08.06.010) 設定モーダル（`openRename`）で階層種別（エピソード／カット／作業ページ）を後から変更可能に
  - (dev v2026.08.06.009) 階層種別を作成時点で紐付け：`node.kind='episode'|'cut'` を保存し全ての判定で優先参照
  - (dev v2026.08.06.008) 追加モーダル 工程セクションに大きなタイトル＋空フォルダ画面に階層別ガイドボタン
  - (dev v2026.08.06.007) サイドバー ＋追加：ルート選択（無選択）時は エピソード／カット／作業ページ の 3 択
  - (dev v2026.08.06.006) サイドバー ＋追加：現在選択階層に応じてモーダル内容を切替＋空白クリックでルート選択
  - (dev v2026.08.06.005) typeSelector のラベルを「フォルダ／作業ページ」「ショット／作業ページ」→ 全て「カット／作業ページ」に統一
  - (dev v2026.08.06.004) エピソードフォルダの ＋追加 は「ショット／作業ページ」から選ぶ形に
  - (dev v2026.08.06.003) 工程テンプレートAの既定を LAY / ANM / SEC に変更
  - (dev v2026.08.06.002) 3 階層モデル：エピソード／作業ページ作成モーダルからページ種別・工程セクションを外す
  - (dev v2026.08.06.001) 3 階層モデル導入：エピソード → カット → 作業ページ の空プロジェクト導線＋進捗タブの自動判定改良
  - (dev v2026.08.05.045) REEL 画像挿入ツールを撤去（v.043 の誤対応を revert）

- **【2026-08-05 Beta v0.0.9 追加反映（バージョン据え置き）】** 以下は laycat_dev.html → laycat.html にサイレント反映（`APP_VERSION='beta v0.0.9'` のまま）。PATCH_NOTES.md にも記載しない：
  - (dev v2026.08.05.042) REEL：描画のたびにコメント欄がチカチカするのを修正
    - `reelAfterEdit` の末尾で毎回 `reelNotes()` を呼んでコメント欄 DOM（`clist.innerHTML=''` → 全 note append し直し）を再構築していたため、描画（pointerup / erase / lasso / mannequin 操作）ごとにチカチカしていた。
    - `reel_emb_` ノートは常にコメント欄に出さない設計（v.091 で明示非表示）なので、描画編集ではコメント欄の内容は変わらない → `reelNotes()` 呼出は不要。`drawAnno / drawFTL` のみに絞る。
    - `nt_` ノートを新規生成する送信経路（`reelSendCur`）は自身で `reelNotes(true)` を明示的に呼ぶので影響なし。undo/redo/erase/shape/lasso/mann は元々 comment 側に触らないので影響なし。
  - (dev v2026.08.05.041) REEL 送信：「送るものがありません」toast を 3 パターンに分岐
    - v.040 の toast をさらに細分化：(a) 現在フレームに既送信済ノートがある→「既に送信済です」＋削除案内、(b) pending に別フレーム描画あり→最寄りフレーム案内、(c) pending も sent も無し→「未送信の描画・コメントがありません」。
    - 「見えている＝送れる」ではない設計副作用（一度送信すると `nt_...` ノート由来の描画が表示されるが pending は空になり再送できない）をユーザーが判別できるように。
  - (dev v2026.08.05.040) REEL 送信：inWin 判定を p.dur 焼き付き値ベースに＋silent early-return を toast 化
    - サブエージェント解析（A1）で判明した「サムネが送られない」主犯：`reelSendCur` の `inWin` が `cf < p.f + pdur`（`pdur=durS.value`）で判定していたため、描画後に durS を狭めた／1F ズレたケースで `cur=[]` になり `newN.drawing` 未設定 → `noteBlock` のサムネ生成分岐に入らない不整合。
    - `inWin` を `cf < p.f + (parseInt(p.dur)||pdur)` に変更。描画時に焼き付けた `p.dur` を優先し、`reelSyncEmbedFrame` の意味論（p.dur を尊重して embed 作成）と揃える。
    - サイレント early-return を撤去し、`toastIn(d, ...)` で「現在 F<cf> / 描画は F<最寄り> 付近」を表示（描画・コメントどちらも空の場合はその旨）。ユーザーがフレームズレを診断できるように。
    - 3 番目の対策（annotShotInto の iframe 越境根本対策）は保留。まずこの 2 つで多くのケースが解消する想定。
  - (dev v2026.08.05.039) REEL：送信ノートのサムネ canvas を iframe-doc で作り直して描画反映
    - v.038 で `noShot=true` を外したが `noteBlock` の canvas はメイン document で作られ iframe に adopt される。Chrome の adoption 挙動で backing buffer への描画（`annotShotInto` の非同期 drawImage）が反映されずサムネが空のままだった。
    - `reelNotes` で noteBlock 呼出後に、`.note-shot` を iframe-doc の canvas に差し替えて `annotShotInto(ifCv, shot, n)` を再発行。iframe 内で正しくサムネが描画される。
  - (dev v2026.08.05.038) REEL：描画済フレームで送信ボタンを押したら「サムネ付きコメント」として送信されるように
    - `reelSendCur` の「描画のみ送信＝`noShot=true` でコメント欄に出さない」旧仕様を撤去。ユーザーがスライダを描画済フレームに合わせて送信ボタンを押した意図は「サムネ付きで送りたい」と解釈する方が自然。
    - 送信ノートは通常のコメントとして扱われ、`noteBlock` の `annotShotInto` で動画フレーム＋描画を焼き込んだサムネがコメント欄に生成される。
    - 自動同期の `reel_emb_` ノートは別経路（`reelSyncEmbedFrame`）で常に `noShot=true` のまま埋め込み専用（コメント欄非表示）維持。
  - (dev v2026.08.05.037) チェック待ちタブ：作業担当者による絞り込みを追加
    - チェック担当者タブの下にコンパクトな select（`.chk-asg-bar`）を追加。「作業担当者ごとに REEL を作りたい」ユースケース（例：レビュアー A のカット群から作業者 B の分だけ REEL に送る）に対応。
    - `state.checkAssignee` を新設。null=すべて、`CHK_NONE`=未割り当て、それ以外=member id。チェック担当者タブを切り替えたときは自動的に null にリセット。
    - 選択肢は現在のチェック担当者バケットに実際に存在する作業担当者だけを列挙（名簿順→名簿外→未割り当て）。バケット切替で存在しなくなった選択は自動リセット。
    - `hits` フィルタと `paintAddAllBtn` の `bucketPend` フィルタ両方に反映。「⧉ まとめてタブに追加」「▶ REEL にまとめて送る」も絞り込み後の件数・対象を表示。

- **【2026-08-05 Beta v0.0.9 反映時に PATCH_NOTES.md 記載を見送り】** 以下は laycat_dev.html → laycat.html にコピー済みだが PATCH_NOTES.md には記載せず beta v0.0.9 に含めない：
  - (dev v2026.08.05.036) REEL スクロールバーの見た目をアノテ窓（メイン）と同一に
    - REEL は iframe 内で独自 CSS を持つため、メイン CSS の `::-webkit-scrollbar` 定義が届かず Chrome のブラウザ既定になっていた。
    - REEL iframe 注入 CSS に `::-webkit-scrollbar{width:10px;height:10px}` と `::-webkit-scrollbar-thumb{background:#232327;border-radius:6px;border:2px solid #0d0d0f}`（メインの --bg4/--bg 相当）を追加。
  - (dev v2026.07.29.092) ヘッダのテーマ切替ボタン（月アイコン）を撤去
    - `#themeBtn` を header から削除。initTheme のロジックは残置（`btn` 取得が null になるだけで無害、保存済みテーマは引き続き適用される）。
  - (dev v2026.07.29.091) REEL コメント欄の「動画埋め込み」黄枠ブロックを非表示化
    - `reelNotes` 内で `embeds`（`noteEmbedOnly` かつ `reel_emb_` 以外の noShot ノート）をコメント欄に出さないよう変更。空判定も embeds を除外。
    - `reelEmbedBlock` 関数自体は将来的な再表示・削除 UI 用に残置（波及ゼロ）。描画レイヤーへの反映は従来通り。

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

### タイムラインの掲載項目追加

タイムラインに下記の項目を追加する：

- **自分がメンションされたメッセージ**：`@自分` を含むメッセージをタイムラインに表示（既存の通知パネルと重複させるかは要検討）。
- **自分のカットに FB が記載されたとき**：担当ショットに新しい FB が付いた旨をタイムラインに出す（どういう方針で進めるかは今後検討）。
- **現状のアップロード項目に担当者バッジを追加**：既存の「動画がアップロードされました」系タイムライン項目に、そのカットの作業担当者バッジを重ねて表示。

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

### フォルダ運用でも「自分のプロジェクト一覧」を実現（`_access.json` だけ Firestore に切り出す）

**背景**：R2 プロジェクトは Worker から `listMyProjects()` で「自分がメンバーのプロジェクト一覧」が取れるが、フォルダ運用は中央レジストリが無いため取れない。フォルダをピックしないとメンバーかどうかも分からない。

**提案**：**プロジェクト本体は社内フォルダのまま、メンバー名簿だけ Firestore に上げる**（Control Plane と Data Plane の分離）。

**Firestore スキーマ案**
```
/laycatProjects/{projectId}
{
  "owner": "owner@example.com",
  "members": ["a@example.com", ...],
  "backend": "folder",
  "hintName": "projectA",        // フォルダ名ヒント（任意）
  "displayName": "作品名",       // 一覧表示用（センシティブなら省略可）
  "updatedAt": "...",
  "updatedBy": "..."
}
```

**メリット**
- プロジェクト本体（動画・コメント・構造）は社内フォルダから 1 バイトも出ない
- R2 と同じ「⇄ プロジェクトに接続」モーダルにフォルダ運用の一覧も並ぶ → UX 統一
- 既存 Firebase/Firestore インフラ（`laynaAccess/config` 等）を再利用可能・追加サーバー不要
- 退職者削除の一元化（Firestore の members から外すだけ）

**注意点・トレードオフ**
- Firestore は「宣言」のみ・**実際の書き込み権限強制は OS の ACL 依存**（discovery 用と割り切る）
- メンバーメールがクラウドに乗る（R2 と同レベル・気になれば hash 化して LayCAT 内でだけ突合）
- owner 側の members 変更 → Firestore への push を自動化必要（R2 の `_access.json` 同期ロジック流用）
- フォルダ実体位置が変わると迷子（hintName は候補表示・実接続は初回ピック）

**初回接続フローの改善（メンバー側）**
1. Firestore から自分のプロジェクト一覧取得 → タイル表示
2. タイルクリック → 「このプロジェクトの共有フォルダを選択（ヒント：projectA_data）」ダイアログ
3. ピック → `laycat.project.json` の projectId と Firestore の ID を検証
4. 一致すればハンドル保存 → 以降は自動接続

**フェーズ分割・工数**
- P1：Firestore スキーマ設計＋ owner 側書き込み（フォルダプロジェクトでも members 変更時に自動同期）（1 日）
- P2：member 側の一覧表示（`⇄ プロジェクトに接続` にフォルダタイル追加）（半日）
- P3：フォルダピック時の projectId 検証・ヒント表示（半日）
- P4：Firestore セキュリティルール整備（メンバーは自分が含まれるドキュメントのみ read 可 等）（半日）

**合計約 2.5 日**。R2 と挙動を揃えられ、既存インフラで完結。デスクトップアプリ化や社内サーバー化を待たずに実現可能。

**displayName（作品名）の Firestore 掲載方針（オプション比較）**

Firestore に作品名を含めるかどうかで 3 パターン。セキュリティ要件で選ぶ。

| 観点 | P1（フォルダ鍵で暗号化） | P2（公開鍵ラップ・E2E） | P3（そもそも載せない） |
|---|---|---|---|
| 仕組み | owner が `laycat.project.json` に `encKey` を埋め込み → 暗号化した ciphertext を Firestore に PUT。メンバーはフォルダから鍵取得 → 復号 | 各ユーザーが RSA/ECDH 鍵ペアを保持。owner が members 全員の公開鍵で projectKey をラップ → Firestore 格納。メンバーは自分の秘密鍵で復号 | Firestore には projectId / owner / members / hintName のみ。displayName はフォルダ初回接続後に `laycat.project.json` から読んで localStorage キャッシュ |
| Firestore 上の本名 | ×（ciphertext） | ×（ciphertext） | ×（そもそも無い） |
| 初回（フォルダ未接続）で本名表示 | × | ○ | ×（hintName のみ） |
| 2 回目以降で本名表示 | ○ | ○ | ○（キャッシュ） |
| 実装工数 | 中（半日） | 大（1〜2 週間） | 小（1〜2 時間） |
| 鍵管理の複雑さ | 低 | 高（秘密鍵消失で詰む） | ゼロ |
| 推奨度 | ○ | △（オーバーキル） | ◎（推奨） |

**推奨は P3**：セキュリティは P1 と同等（結局フォルダアクセス権がある人だけ本名を見られる）、実装が桁違いに軽い、失敗モードが少ない。hintName の命名ガイドライン（例：`Project_A` / `Q3_MV` 等の英字慣習）を用意すれば初回体験も許容範囲。

要望が強ければ P1 を後追い、P2 は最終手段（LayCAT のスケール的にはたぶん一生要らない）。

### メンバー追加 → 招待メール自動送信 → URL クリックで参加 → フォルダ接続

**背景**：owner がメンバー追加した後、招待 URL を Slack/Gmail 等で手動共有する現状の運用を自動化したい。

**現状の LayCAT で出来ること・出来ないこと**

| ステップ | 現状 |
|---|---|
| owner がメンバー追加 | ✅ プロジェクト設定のメンバー管理 UI から可能 |
| 招待トークン生成 | ⚠️ 仕組みはあるが LayCAT からは生成できない（Firestore `laynaAccessInvites/{token}` に手動書き込みが必要・`access-console.html` 経由想定） |
| Firestore に登録 | ⚠️ 全体ホワイトリスト（`laynaAccess/invited`）のみ・**プロジェクト単位の members には R2 のみ登録、フォルダ運用は登録先なし** |
| メール送信 | ❌ 完全に未実装。手動で共有必要 |

**既存機構**（[laycat_dev.html:13915-14089](laycat_dev.html:13915) 付近）
- URL ハッシュ `#invite=<token>` → sessionStorage 保持
- `redeemInvite(tok, u)` で Firestore token 検証 → `laynaAccess/invited` に追加
- コメント引用：「本命はFirestoreセキュリティルールでの強制（クライアント判定は補助・最終防壁にはならない）」

**必要な追加実装**
1. LayCAT UI から招待トークン生成（メンバー管理 UI から「＋招待を送る」ボタン）
2. メール送信バックエンド（候補：Firebase Extensions Trigger Email / Cloudflare Workers + MailChannels / SendGrid / Resend / Postmark）
3. **プロジェクト単位の招待化**（現状の「LayCAT 全体ホワイトリスト」から「project X の members にだけ追加」へ構造化）
4. 参加時のフォルダ接続モーダル（hintName 表示・projectId 突合検証）
5. デスクトップ版（Tauri）ならカスタム URL スキーム＋自動フォルダオープンで完全自動化可能

**セキュリティ観点で先に監査すべきポイント**

前提として、既存 invite 機構は Firestore セキュリティルール依存。**実装より先にルール監査が必要**：

- **クライアント検証の限界**：`active !== false` や `expires` チェックはクライアント JS で走るため開発者ツールでバイパス可能。**Firestore Rules で強制**必須
- **URL 拡散リスク**：招待 URL がブラウザ履歴・スクリーンショット・メールアーカイブ・チャット共有で漏洩の可能性。対策：
  - **1 回使用で無効化**（consume-once）
  - **短い有効期限**（例：72 時間）
  - **email クレーム紐付け**：token 発行時に「この token は `user@example.com` 専用」と Firestore に記録 → redeem 時に Firebase Auth の email と一致確認（現状は誰でも redeem 可能）
- **ホワイトリスト vs プロジェクト単位**：現状の招待は LayCAT アプリ全体のホワイトリスト。project A の招待で他プロジェクトも見られる可能性 → 構造化必須
- **メール送信サーバー側の情報漏洩**：SendGrid/Firebase Trigger Email 等を使うと本文（招待 URL 含む）が外部サービスに保存される。対策：URL 分割送信・自社ドメイン短縮 URL 経由
- **Firestore セキュリティルール監査**（別ファイル管理・要確認）：
  - `laynaAccessInvites` の write 権限は正しく制限されているか
  - `laynaAccess/invited` は有効な token を持つ人だけ書けるか
  - Firebase Auth の email verification 必須になっているか

**実装順序（推奨）**
1. **Firestore セキュリティルール監査**（先に必ずやる）
2. プロジェクト単位の招待構造化（`laycatProjects/{pid}/invites/{token}`）
3. LayCAT UI から招待トークン生成＋既存 invite 機構との配線
4. メール送信バックエンド接続
5. 参加時のフォルダ接続モーダル（`_access.json` を Firestore に分離する上位 TODO と統合実装が筋良し）

**上位 TODO との関係**：この機能は「フォルダ運用でも自分のプロジェクト一覧を実現（`_access.json` 分離）」と密接に関連。同時に実装するのが自然。

### ショートカットキーのユーザーカスタマイズ

**背景**：現状アノテ窓・REEL 側でキー配置は完全ハードコード（`if(e.key==='v')` 等）。ユーザーごとに再生キー・IN/OUT・Undo などを好みに変更したい要望あり。

**前提**：ユーザー設定の永続化前提なので v.014 の `navigator.storage.persist()` が効いていること。IndexedDB/localStorage が突然消えると「設定した覚えのないキーになった」事故につながるため、これが担保されるまでは着手しない。

**現状のキー配置（アノテ窓・要 refactor 箇所）**
- 再生系：Space（再生）／← →（1F）／↑ ↓（アノテ間ジャンプ）
- 編集系：Ctrl+Z（Undo）／Ctrl+Y or Ctrl+Shift+Z（Redo）／Ctrl+S（保存）
- 判定系：, （IN 点）／. （OUT 点）／X（範囲解除）
- 表示系：V（左右反転）
- 選択系：Delete/Backspace（マネキン/投げ縄削除）／Escape（閉じる or 投げ縄選択解除）
- REEL 側にも似た配置が別実装で並んでいる → 統合の好機

**実装ステップ**
1. **キーマップ・レジストリ**：`const KEYMAP={ 'anno.play':{default:'Space',label:'再生 / 停止',ctx:'anno'}, ... }` で全アクションを宣言
2. **既存の `if(e.key===...)` を `resolveAction(e)` → `switch(action)` にリファクタ**（アノテ窓 `onKey` ～10 分岐、REEL 側も同様）
3. **ユーザー設定の保存**：`localStorage['laycat.keymap']` に上書き分だけ JSON 保存。サーバー保存もオプション化（プロジェクト設定に埋め込む → 別マシン同期）
4. **設定 UI**：プロジェクト設定モーダルに「⌨ キーボード設定」セクション。各アクションに「キーを記録」ボタン（クリック → 次のキーをキャプチャ）。競合検知・「デフォルトに戻す」ボタン付き
5. **プリセット**（あると便利）：LayCAT デフォルト／Frame.io 風／Premiere Pro 風（J/K/L）／RV 風

**フェーズ分割・工数目安**
- P1：アノテ窓のみ、レジストリ化＋設定 UI（1〜2 日）
- P2：REEL 側も統合（+半日）
- P3：プリセット複数＋サーバー保存（+1 日）
- P4：ツリーナビ・ヘッダショートカット全域（+1 日）

**推奨**：P1（アノテ窓のみ・ローカル保存・プリセットなし）で MVP → 反応を見て P2〜P4。

### デスクトップアプリ化 ＋ 社内サーバー化（大構想・要検討）

**背景**：ブラウザ運用だとフォルダピック必須（初回）・メンバー一覧取得不可（フォルダ運用時）・IndexedDB の突然消失リスクという構造的な問題が残る。デスクトップアプリ化＋社内サーバーで一気に解決できる。

- **デスクトップアプリ化（Tauri ラッパー方式を推奨）**
  - Tauri で `https://laycat.example/laycat.html` を WebView でロードするだけの薄いシェルを作る
  - **メリット**：
    - ブラウザ版と完全同期（サーバーの HTML を都度取得＝ラグゼロで自動アプデ）
    - ネイティブファイルアクセス → フォルダ「パス指定」で開ける（ピック不要）
    - 起動時に共有フォルダを自動マウント可能
    - トレイ常駐・OS 通知
  - **注意点**：
    - オフライン起動が難しい（キャッシュ工夫で緩和可）
    - コード署名（Windows/Mac）は初回インストーラのみ
  - **実装**：Rust 側 200 行、JS 側は `window.__TAURI__` 経由でネイティブ機能を叩く分だけ追加
  - 実装工数：1〜2 週間

- **バンドル方式との比較（参考）**：Tauri Updater / electron-updater で HTML/JS をアプリに焼き込む方式もあるが、ブラウザ版と乖離しやすい（起動時に検知 → 次回起動で反映）。まずラッパー方式で始めて、必要になったらバンドル方式に寄せる方針。

- **社内サーバー化（`_access.json` を集中管理）**
  - 小さな Node/Go + SQLite サーバーを社内に立て、R2 Worker と同じ責務を持たせる
  - **解決すること**：
    - 「自分がメンバーのプロジェクト一覧」を取得可能 → 起動時に自動リスト表示（フォルダ運用でも R2 と同等の体験）
    - 招待・権限管理を一元化（owner が Web UI から招待、退職者を一発除去）
    - 監査ログ（誰がいつ何を触ったか）
  - **動画本体は依然共有フォルダ**（NAS / Drive）に置く。サーバーはメタデータ管理のみ

- **組み合わせの最終形**：Tauri + 社内サーバー = 起動 → ログイン → 自分のプロジェクトが自動で並ぶ → クリックで即開く（Frame.io 相当の体験）

### AE 互換のリニアタイムリマップ（タメツメ修正指示用）

**用途**：アニメーションレビュー時にタメ（ホールド）・ツメ（早送り）・逆再生を **AE と同じ操作感** で指示。ベジェは不要、リニア補間のみ。「このポーズを 2F 長く」「この 3F を詰めて 1F に」を映像で直接示せるようにする。

**データモデル**（AE と同じ「表示時刻 → ソース時刻」のキーフレーム）
```js
version.timeRemap = {
  enabled: true,
  keyframes: [
    {t: 0,  s: 0},   // 表示 0F → ソース 0F（デフォルト）
    {t: 30, s: 30},  // 等倍のまま
    {t: 45, s: 30},  // ソース据え置き → 15F フリーズ（タメ）
    {t: 60, s: 60},  // 15F で 30F 進む（1.5x ツメ）
  ]
}
```

**再生ロジック**：display frame D が属するセグメント [K_i, K_{i+1}] を二分探索、`s = s0 + (D-t0)/(t1-t0) * (s1-s0)` でリニア補間、`video.currentTime = s/fps` で seek。傾き 0=フリーズ、>1=早送り、<0=逆再生、<1=スロー。

**AE 互換 UX**
- タイムラインに remap トラック追加（1 段下）
- **K キー**でキーフレーム追加（AE 準拠）
- **横ドラッグ**：表示時刻 `t` 変更／**縦ドラッグ or 数値入力**：ソース時刻 `s` 変更／**Delete**：削除／**Ctrl+ドラッグ**：スナップ無効
- プロパティ表示：現在 F / 元 F / 傾き（速度倍率）
- **リタイム ON/OFF トグル**：オリジナルタイミングと切替
- オプション：速度グラフをセグメント別に色分け表示

**実装ステップ・コスト**
- **Phase 1**：再生エンジン + キーフレーム CRUD の最小 UI（2〜3 日）
- **Phase 2**：AE 互換 UI（ドラッグ編集・スナップ・速度グラフ）（+2〜3 日）
- **Phase 3**：アノテとの整合性・保存・複数バージョン対応（+1〜2 日）
- **合計 5〜8 日**

**難所**
1. **`<video>.currentTime` の seek 精度**：H.264 は 1F ズレが出うる → `requestVideoFrameCallback` で確定待ちロジック
2. **アノテーション座標系**：pending/notes はソースフレーム基準のままで OK。timeline マーカーは「元 or リマップ後」切替オプションが必要
3. **プレイヘッド表示**：AE と同じく「オリジナルタイム」と「リマップタイム」の 2 軸表示にすると分かりやすい

**タメツメ操作の具体例**
「30F で 15F タメ、続く 15F で 30F ツメ」の場合：
1. 30F でキーフレーム追加（自動で `{t:30, s:30}`）
2. スクラブで 45F → キーフレーム追加、ソース値を 30 に変更 → 30-45F でフリーズ（15F タメ）
3. 60F でキーフレーム追加、ソースを 60 に変更 → 45-60F でソース 30→60（1.5x 早送り＝ツメ）

→ **AE と全く同じ感覚で作業可能**。再生ボタンで修正後タイミングを流せば、アニメーターへの指示が映像そのもので伝わる。

**軽量代替案**（もし上記が重い場合）
- 再生速度スライダー（0.25x/0.5x/1x/2x）＋セクションループ（IN/OUT 間繰返し）＋フレームステップの拡充：ざっくり見る用途は満たせるが、タメツメ指示は文字コメントに戻る

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


---

# pmboard アップデートログ

> pmboard（進行管理ボード）は LayCAT からアクセス可能な外部 HTML。
> Dev（`pmboard_dev.html`）＝日付ベース `YYYY.MM.DD.NNN`、Beta（`pmboard.html`）＝`pmboard vX.Y.Z`。
> LayCAT 本体と同じ 3 セクション構成で運用する。

## 未反映（次のパッチノート候補）

<!-- 以降、コミット単位で `- (short-hash) 日本語要約` を追記していく -->

- (dev v2026.09.19.033) **SHOT 列を 1 行レイアウトに戻し、メモをショット名の右に inline 配置**：
  - **背景**：v.026 でメモを 2 段目に配置したが、行高が嵩んで見づらいというユーザー要望。
  - **HTML**：`.shot-top` ラッパーを撤去。子要素を直接 `.shot` に並べる順に変更：`id → shot-memo → cur-stage → status → +ボタン`。
  - **CSS**：`.shot` を `flex-direction:row` に戻す。`.id` は `flex:0 1 auto; max-width:110px`（メモにスペースを譲る）、`.shot-memo` は `flex:1 1 auto; white-space:nowrap; text-overflow:ellipsis`（残り幅を取って 1 行 truncated）。編集中は `.editing` で `white-space:pre-wrap` に戻して折返し・上下伸長を許可。
  - **プレースホルダ**：空状態は「メモ…」に短縮。
  - APP_VERSION：2026.09.19.032 → 2026.09.19.033

- (dev v2026.09.19.032) **v.031 の判定を LayCAT と完全一致させる（ユーザー環境で日数が減らなかった件の是正）**：
  - **原因**：v.031 の `isStatusDone` は `label==='完了'` の**完全一致**しかしていなかった。LayCAT 本体は `/完了|承認|上がり|フィックス|オミット|ok\b|omit|done|fix|approve|complete/i` の**正規表現部分一致**で判定するので、プロジェクトのステータス名が「承認」「OK」「上がり」等の場合 pmboard 側だけ作業日数に混入し続けていた。
  - **修正 A**：`isStatusDone` を LayCAT の `isDoneStatus` と完全一致させる（上記正規表現）。
  - **修正 B**：`isStatusCheckWait` も LayCAT の `isAwaitingCheck` と一致させる。`checkWait:true` の明示指定があればその集合で判定、無ければ `pending` id or 先頭ステータスにフォールバック。ラベル完全一致「チェック待ち」の救済も残置。
  - **副次効果**：ラベルベースで判定するので、`empty` 値・`sid` 未指定は無条件で false（安全側）。
  - APP_VERSION：2026.09.19.031 → 2026.09.19.032

- (dev v2026.09.19.031) **スケジュール実績バー・工数タブの「作業中」定義を LayCAT と整合させ、チェック待ちも除外**：
  - **背景**：v.024 までは「完了扱い」判定がラベル一致のみだったため、オミット（`id:omit`）や承認済み（`id:approved`）が作業期間としてカウントされていた。またチェック待ち期間（ディレクター確認待ちで作業自体は止まっている）も作業に混入していた。
  - **A. `isStatusDone` を LayCAT の `isDoneStatus` と一致**：`id==='approved'` / `id==='omit'` も無条件で完了扱いに。ラベル一致（`'完了'`）判定は残置。
  - **B. `isStatusCheckWait` を新設**：ステータス設定で `checkWait:true` フラグが立っている、あるいはラベルが「チェック待ち」に一致するものを判定。
  - **`isWorkStatus`（workSegments 生成の判定関数）を拡張**：`isStatusCheckWait` も除外条件に追加。これで完了系（完了／オミット／承認）・未着手・クライアント待ち・チェック待ちがすべて実績バー／工数から外れる。
  - **工数タブの説明文更新**：「未着手／チェック待ち／クライアント待ち／完了系（オミット・承認含む）を除く」に変更。
  - APP_VERSION：2026.09.18.030 → 2026.09.19.031

- (dev v2026.09.18.030) **工程バッジの内容を左寄せに変更**：`.cur-stage` の `justify-content:flex-end` → `flex-start`。色マーク＋工程名が先頭に揃うようにして、ラベル長でマークが右にズレて見える件を解消。APP_VERSION：2026.09.18.029 → 2026.09.18.030

- (dev v2026.09.18.029) **工程バッジとステータスチップを固定幅にして位置を揃える**：
  - **原因**：ステータスラベルの文字数（例：`OK` vs `チェック待ち`）で `.shot-status` の実幅が変わり、隣接する `.cur-stage`（工程バッジ）の X 座標が行ごとにズレていた。
  - **修正**：`.shot-status { min-width: 88px; text-align: center }` で常にチップ幅を一定に。合わせて `.cur-stage { min-width: 80px; justify-content: flex-end }` で工程バッジも固定幅・右寄せ内容にし、ラベルの短長で並びが崩れないように統一。
  - APP_VERSION：2026.09.18.028 → 2026.09.18.029

- (dev v2026.09.18.028) **SHOT 列のメモをモーダルからインライン編集に変更**：
  - **背景**：モーダル開閉が煩わしいので、メモをクリックしてその場で直接入力したい、というユーザー要望。
  - **編集**：メモをクリック → `contenteditable="plaintext-only"` で inline 編集開始。編集中は truncation を外して折返し表示（`.editing` クラスで `white-space:pre-wrap;overflow:visible`）＋アクセントカラーの内側枠でフォーカス強調。
  - **確定**：Enter（単独）／blur で保存。Shift/Ctrl/Cmd+Enter で改行。Esc でキャンセル（元の値に戻す）。変更なしなら書込みスキップ。
  - **保存**：既存の `saveShotMemo(shot)` を流用（`notes/{shotSectionId}.json`、v:1 スキーマ、`_rev` 単調増加）。
  - **空状態**：`.shot-memo:empty:not(.editing)::before` で薄い placeholder 「クリックでメモを追加」を表示。編集中は非表示。
  - **モーダル関連 CSS／JS 削除**：`.memo-modal-*` / `openShotMemoModal` を撤去。
  - APP_VERSION：2026.09.18.027 → 2026.09.18.028

- (dev v2026.09.18.027) **SHOT 列のメモの文字色が薄すぎる件を修正**：`.shot-memo` の色を `var(--text3)` → `var(--text)`、font-size を 11 → 12px。空状態は `var(--border2)` → `var(--text3)` でイタリック維持。可読性を優先。APP_VERSION：2026.09.18.026 → 2026.09.18.027

- (dev v2026.09.18.026) **SHOT 列に「メモ」行を追加**（進行メモ・注意事項）：
  - **表示**：SHOT 列を 2 段レイアウトに変更（`.shot-top` に既存の名前/工程/status/工程数/rollup/…、下段に `.shot-memo`）。メモは 1 行 truncated＋末尾 `…`（`text-overflow:ellipsis`）。空のときは薄い placeholder テキストで「クリックでメモを追加」を表示。
  - **列幅**：`--shot-col-w` デフォルトを 220px → 300px に。既存 localStorage で保存済みの幅はそのまま（ユーザー設定を尊重）。
  - **編集**：メモをクリック → 中央にフローティングモーダル（`.memo-modal-*`）。textarea＋保存／キャンセル。Ctrl+Enter で保存、Esc でキャンセル。オーバーレイクリックでキャンセル。
  - **保存**：`notes/{shotSectionId}.json`（v:1、`{v,shotId,memo,updatedAt,source:'pmboard',_rev}`）に書き込み。`buildData` の並列読込に `notes/*.json` を追加し `shot.memo` に流し込む。LayCAT 側は同ファイルを読まない前提（pmboard 内メモ）。
  - APP_VERSION：2026.09.18.025 → 2026.09.18.026

- (dev v2026.09.18.025) **ショット単位ステータスへの対応（LayCAT dev v.014 と対）**：
  - **背景**：LayCAT 側で「1 ショット 1 ステータス」に統一。ショット section にも `status/{sectionId}.json` が書かれるようになった。pmboard 側でも同じ値をショットのステータスとして扱う。
  - **データ層**：`buildData` で `statusMap[section.id]` をショットに取り込み、`shot.shotStatus` / `shot.shotStatusHistory` / `shot.shotIsDone` として保持。存在しないショットは従来どおり currentStage の値にフォールバック。
  - **表示層**：ガント行のステータスチップ／サイドバーのステータス分布ドーナツ／工数タブの status フィールドで `shot.shotStatus ?? cur.currentStatus` の順に解決。
  - **書込層**：`applyStatusChange` の書込先 `sid` を `st.reviewNode.id` → `shot.sectionNode.id` に変更。Simple B は section.id === review.id なので従来どおり、レガシー multi-stage はショット section の status ファイルに書き込む。旧 `status/{reviewId}.json` は残置（読取フォールバック用）。メモリ更新も `shot.shotStatus` 側に切替（stage の currentStatus は残置）。
  - APP_VERSION：2026.09.18.024 → 2026.09.18.025

- (dev v2026.09.17.019) **工程分布ドーナツクリックでステータス分布を絞り込み**：セカンダリ工程のショットで OK ／ リテイクの比率を確認したい、というニーズに対応。
  - **工程分布ドーナツ／集計表**：スライスや行をクリックすると `DATA.stageFilter` にその工程名が入り、選択されたスライスだけがハイライト（他はアルファ 0.25）、行も active クラスで強調表示。同じ行を再クリックで解除、他の工程をクリックで切替。
  - **ステータス分布ドーナツ**：`DATA.stageFilter` が指定されているとき、その工程を「現在工程」とするショットだけに絞って集計・描画。集計は selected 工程のショット数を分母にした割合で表示。
  - **絞り込みラベル**：ステータス分布ドーナツの上に「工程「X」 N ショット」の小ラベルを表示（絞込中のみ）。
  - **drawDonut 拡張**：`opts.onPick` コールバックとクリック判定（角度＋半径ヒットテスト）、`opts.highlightId` で非該当スライスを薄く描画する機能を追加。canvas の CSS スケール（`max-width:100%` による縮小表示）にも対応（`getBoundingClientRect()` からスケール倍率を計算）。
  - APP_VERSION：2026.09.17.018 → 2026.09.17.019

- (dev v2026.09.17.018) **「現在の工程」判定を LayCAT `progressData` の secondary 判定に完全ポート**：
  - **原因**：pmboard の v.017 まで、`shotCurrentStage` は「WIP → 全完了 → 次未完了」の workflow ベース判定を使っていた。しかし LayCAT 本体は、動画が無いショットで **secondary 判定**（`stageRankCmp` で並べたときに最後に `status !== 'empty'` になっている工程）を採用しており、両者が食い違っていた。動画がまだ無いショット（多数）で pmboard 側の現在工程が LayCAT と一致しない事象が発生。
  - **修正**：`stageRank` / `stageRankCmp` を LayCAT からポート（lay/layout 系 →0、anm/anim 系 →1、その他 →2、同 rank は名前昇順）。`shotCurrentStage` を **「currentStatus がある工程のうち stageRankCmp で一番後」** に置き換え。動画が無いショットは LayCAT と完全一致する（LayCAT 側でも動画無しは secondary にフォールバックするため）。
  - **未実装（今後）**：Primary 判定（動画時刻ベース）は pmboard が動画情報を読まない現状では実装できない。将来 versions[] を pmboard 側でも読むよう拡張したら実装可能。
  - APP_VERSION：2026.09.17.017 → 2026.09.17.018

- (dev v2026.09.17.017) **工程検知の 2 重の不一致を修正**：
  - **原因 1**：ガント行の「現在の工程」（WIP → allDone → 次未完了 の優先順）と、サイドバー工程分布ドーナツで使う `shotCurrentStage`（＝工程順で最後に触れた工程）が食い違っており、同じショットに対して 2 箇所で違う工程が「現在」と表示されていた。
  - **原因 2**：工程分布ドーナツ・工程進捗バーが `st.label`（`stageLabel(kind, name)` の短縮表示）で集計 keying していたため、「レイアウト作業」「レイアウト調整」などの同分類・6 文字超の名前が同一 label に畳まれ、グラフから工程が「消えたように」見えていた。
  - **修正 1**：`shotCurrentStage` をガント行と同じ判定（WIP → 全完了 → 次未完了）に統一。ガント行も `shotCurrentStage` を呼んで一意化。
  - **修正 2**：stage オブジェクトに `stageName`（生の工程名）を保持。ドーナツ・工程進捗バーの集計 keys を `label`→`stageName` に変更。
  - APP_VERSION：2026.09.17.016 → 2026.09.17.017

- (dev v2026.09.17.016) **Simple B ショット判定の除外条件を追加（工程消失バグ修正）**：`isSimpleShot` に「親が旧モデルショット（section+review 子）なら false」を追加。旧モデルショットの review 子ノードが Simple B と誤判定され、pmboard のグラフから 1 工程消える原因を根絶。
  - APP_VERSION：2026.09.17.015 → 2026.09.17.016

- (dev v2026.09.17.015) **Simple B P6：pmboard を Simple B ショットに対応**：LayCAT の Simple B ショット（`type:'review'` + `currentStage`）を pmboard がロード・表示できるよう対応。
  - **shot 検出拡張**：`isLegacyShot`（section + review 子）に加え `isSimpleShot`（review + `currentStage` or `stageHistory`）を追加。両方を DATA.shots に取り込む。
  - **stages 展開**：Simple B ショットは自身を stage=1 個として展開。`stageName = k.currentStage || root.stages[0] || k.name` から `classifyStage/stageColor` を導出。
  - **後方互換**：旧モデル（section+review 子）は従来通りの経路を維持、切替は shot section の type 判定のみ。
  - APP_VERSION：2026.09.17.014 → 2026.09.17.015

- (dev v2026.09.17.014) **クライアント待ちの期間を実績バーから除外（work セグメント分割）**：LayCAT 側で「☑ クライアント待ち」を付けたステータスを検出し、`isStatusClientWait` を追加。
  - **workSegments 導出**：`history` を時系列に走査して「作業状態（＝pending でも clientWait でも done でもない）」の区間だけを `{start, end}` 配列に切り出す。クライアント待ちに切り替わった瞬間にセグメントを閉じ、再び作業ステータスに戻ったら新しいセグメントを開く。
  - **描画**：1 工程あたり複数の実績バーを描画。クライアント待ちの期間は自然に「バーの隙間」として現れる。最終セグメントが open（未完了・作業中）なら今日 JST まで伸長し「進行中」ラベル。完了系の最終セグメントは合計作業日数（`Nd`）を右端に表示。
  - **tooltip**：各バーに「実績：MM/DD〜MM/DD」を付与。
  - **stage オブジェクトに workSegments を追加**：後方互換のため `actualStart`/`actualEnd` も継続保持（前者＝最初のセグメント start、後者＝完了なら最終セグメント end／未完了なら null）。
  - APP_VERSION：2026.09.17.013 → 2026.09.17.014

- (dev v2026.09.17.013) **サイドバーのサマリから「遅延」カウンターを削除**：v.012 で色分けを廃止した流れで、遅延判定自体を UI から撤去。
  - サマリを 2×2 → 3 列（`sb-stat-3`）に変更：`進捗` / `完了` / `残` の 3 枚に整理。
  - `late` 計算コードも `updateSidebar` から削除。
  - APP_VERSION：2026.09.17.012 → 2026.09.17.013

- (dev v2026.09.17.012) **実績バーの遅延色分けを廃止し、常に工程色に統一**：
  - 実績バーが遅延時に赤（`var(--red)`）で塗られ、赤アウトラインが付いていたが、色分けを廃止して常に工程色（`st.color`）で描画。
  - ラベルも `+3d` のような遅延表示を止め、完了バーは日数（`Nd`）／進行中バーは「進行中」のみ。
  - `.seg-actual.late` の赤アウトライン CSS を削除。
  - サイドバー凡例からも「遅延」行を削除。
  - サマリの「遅延」ショット数カウントは残置（数字表示のみで色分けではない）。
  - APP_VERSION：2026.09.17.011 → 2026.09.17.012

- (dev v2026.09.17.011) **ショットに予定を追加する「＋」ボタン UI を追加**：v.010 で破線プレースホルダを廃止した代わりに、必要な時だけ予定を追加できる導線を用意。
  - **配置**：ショットセルの「現在の工程」チップの右隣に破線枠の小さな「＋」ボタン。未予定工程が残っているショットにだけ表示。tooltip に残数を出す。
  - **動作**：クリック → 未予定工程の一覧をポップアップ表示（工程色ドット＋名前）→ 項目クリックで「今日 JST 〜 +3 日」の予定を作成し `schedule/{sid}.json` に保存 → ガント再描画。以降はドラッグで期間調整可能（既存の initScheduleDrag に流入）。
  - **ポップアップ**：`position:fixed` の `.plan-menu`。画面外はみ出しは top/left を再計算して回避。外部クリック／Esc で閉じる。
  - APP_VERSION：2026.09.17.010 → 2026.09.17.011

- (dev v2026.09.17.010) **ショットの予定未設定工程に出るプレースホルダ（破線バー）を廃止**：
  - **原因**：v.005 以前に追加した「予定未設定の工程は今日から 3 日の破線プレースホルダで表示（ドラッグで予定に転化）」が、実データではショット 1 個あたり 5〜10 個の工程が全部プレースホルダとして並び、ガントが破線バーで埋まっていた。
  - **修正**：ショットガントでは `st.plannedStart && st.plannedEnd` の工程だけを描画。予定未設定の工程は何も出さない。
  - **カスタム（オリジナル）ガントは維持**：ユーザーが明示的に工程を「追加」する UI なので、ドラッグ用プレースホルダが必要。ここは触らない。
  - APP_VERSION：2026.09.17.009 → 2026.09.17.010

- (dev v2026.09.17.009) **担当者フィルタの挙動修正**：
  - **バグ**：担当者フィルタが assignee だけでなく reviewer にも一致すると通過していたため、「自分が担当していないショット（＝レビュー担当のみ）」も表示されていた。→ **assignee 一致のみ**に限定。
  - **ソート**：ドロップダウンをプロジェクトの登録順ではなく、**表示名の 50 音順（`localeCompare('ja')`）** に統一。
  - **絞り込み**：candidate リストを「プロジェクトメンバー全員」ではなく「実際にどこかの工程で assignee になっているメンバー」に絞る（誰も担当していない人が候補に出て混乱するのを防ぐ）。
  - APP_VERSION：2026.09.17.008 → 2026.09.17.009

- (dev v2026.09.17.008) **サイドバーに LayCAT 進捗タブと同じドーナツグラフを追加**：
  - 「工程分布」（＝ショットが今どの工程にいるか）ドーナツ ＋ 表
  - 「ステータス分布」（＝ショットの現在工程の status 別）ドーナツ ＋ 表
  - 集計 semantics は LayCAT `progressData` と同等：各ショットで「工程順に status が set されている最後の工程」を「現在の工程」とみなし、そのラベル／その status を集計軸にする。
  - **drawDonut**：LayCAT 本体の関数をポート。中央に総ショット数、外側リングを count/total で塗り分け。canvas なので `resolveColor` で CSS 変数（`var(--st-anim)` 等）を実 hex に解決してから塗る。
  - 既存の「工程進捗（完了率）」バーは残置し、名前を明確化。
  - APP_VERSION：2026.09.17.007 → 2026.09.17.008

- (dev v2026.09.17.007) **タイムラインヘッダの週セル（M/D〜）が下段の日セルとズレるのを修正**：
  - **原因**：週セル `.w` が `flex:1`（均等割）、日セル `.d` も `flex:1`（均等割）。`weekCount = ceil(days/7)` が `days/7` の端数ぶん実日数と乖離するため、週境界が日境界とズレていた（例：days=41 → 週 6 個で 6.83 日/週相当の幅なのに、日は 41 個均等 → 週ラベル「M/D〜」がバーの右にズレていく）。
  - **修正**：週セルに `flex:${daysInWeek} 0 0` を付与（＝各週が含む日数分の伸び率）。最終週が 7 日未満でも正確に幅を確保。全体では合計 flex=`days` になるため、日セル列と完全に一致。
  - APP_VERSION：2026.09.17.006 → 2026.09.17.007

- (dev v2026.09.17.006) **TODAY 文字ラベルの隠れを修正**：v.005 で `.gantt` に `position:relative` を入れたことで、`.gantt-today` の座標系が `.gantt` 直下に確定した結果、`.lbl`（top:2px）がスティッキーヘッダ（`.gantt-hdr` z-index:5）の下に潜って見えなくなっていた。TODAY マーカの z-index を 3→6、ラベル自体にも z-index:7 を付与してヘッダより手前に。
  - APP_VERSION：2026.09.17.005 → 2026.09.17.006

- (dev v2026.09.17.005) **TODAY マーカのズレを修正**：
  - **原因**：`marker.style.left = 220px + todayIdx*px%` で `%` の基準が `.gantt` 全幅（＝ショット列 220px＋トラック）だった。トラック側のバー（`left: i*px%`）は `.track` 幅基準なので、両者の day 割合が食い違い、TODAY 線が右に流れていた。
  - **修正**：計算式を `calc(220px + (100% - 220px) * todayIdx / days)` に変更。トラック実幅で todayIdx 番目の日位置に合わせる。
  - `.gantt` に `position:relative` を明示（absolute 配置の containing block を確定）。
  - APP_VERSION：2026.09.17.004 → 2026.09.17.005

- (dev v2026.09.17.004) **ショット名の右に「現在の工程」を表示**：どの工程に手が付いているかを一覧で分かるように、ショット名の右にカラードット付きで工程名を表示。判定順：
  1. WIP（着手済み・未完了）があれば最新着手工程
  2. 全工程完了なら「完了」（緑）
  3. どれも未着手なら「次にやる工程」（＝最初の未完了工程）
  4. どれにも該当しなければ「—」
  - 色は工程種類の `stageColor`（Layout/Anim/FX/Comp/Paint 系のパレット）と一致
  - tooltip にも「現在：{工程名}」を追加
  - APP_VERSION：2026.09.17.003 → 2026.09.17.004

- (dev v2026.09.17.003) **バー太さを微調整**：v.002 で細くしすぎたので、行 26→34px、バー高さ 9→12px に。予定バー top:3→4、実績バー top:14→18、マイルストーン 8×8→10×10。

- (dev v2026.09.17.002) **スケジュール行をコンパクト 1 行レイアウトに**：ショット枠が太くて見づらいため、既定で「ショット名のみ」の 1 行（min-height 26px）に。
  - **ショットセル**：`.id`（ショット名）のみ表示、`.name`（工程数）／`.meta`（ロールアップ chip・担当者バッジ）／`.stbadges`（工程種類バッジ）を `display:none` で非表示。tooltip（title 属性）で「ショット名 — N 工程 / 状態」を確認可能。
  - **バーの縦位置**：`.seg-plan` top:9→3 / height:14→9、`.seg-actual` top:30→14 / height:14→9、`.milestone` top:22→8。26px 行内に予定＋実績を 2 段スタック。
  - **シーングループ行**：min-height 32→22、フォントサイズ 11→10 に。
  - **track padding**：8→0 に詰めてバーがきっちり見えるように。
  - APP_VERSION：2026.09.17.001 → 2026.09.17.002

- (dev v2026.09.17.001) **完了扱いをラベル「完了」一致にシンプル化＋実績バーを毎日伸長・JST 統一・1 時間ごと自動更新**：
  - **完了判定**：従来のキーワード／配列末尾ヒューリスティック（`OK`/`approved`/`検収`等）を廃止し、**LayCAT 本体のステータス設定でラベルが「完了」のものが現在ステータスなら完了扱い**、という 1 ルールに置き換え。ユーザー側は LayCAT の「ステータス管理」で「完了」ラベルのステータスを追加するだけで運用可能。
  - **未着手判定を追加**：ラベル「未着手」または status が null の場合を「未着手」とみなす。
  - **実績バーの新しい導出**：`status/*.json` の `history[]` から
    - `actualStart` = **未着手以外に最初に切り替わった瞬間**（`history.find(h.to && !isPending)`）
    - `actualEnd` = **完了になった瞬間**（`history.find(h.to && isDone)`）。完了前は `null`。
    - 現在ステータスが未着手（またはクリア）の場合は実績バーを引かない。
  - **未完了バーの日々伸長**：`actualEnd=null` のとき描画側は今日（JST）まで `.wip` バーで伸ばす。時計が進めば毎日 1 マス伸びる。
  - **日本時間統一**：全ての日時計算・表示を JST（UTC+9）に統一。ブラウザローカル TZ に依存しない：
    - `jstMidnightMs(d)` / `jstParts(d)` / `todayJstMidnight()` / `fmtJstDate` / `fmtJstDateTime` ヘルパを追加。
    - `dayIdx`・`fmtDate`・timeline start/end・週ヘッダ・週末塗り・TODAY マーカ・ドラッグ時の日→Date 変換を全て JST 基準に。
    - `isoDate(d)` は JST 日付で `YYYY-MM-DD` を出力、`parseIsoDateJst(s)` は JST 0:00 として解釈。
  - **1 時間ごとの自動更新**：`setInterval(hourlyRefresh, 3600000)` を追加。プロジェクト接続中はデータを再読み込みしてガントを再描画。実績バーが今日まで伸びるので、時刻が進んでも表示が古くならない。
  - **ヘッダに「最終更新 YYYY/MM/DD HH:mm（JST）」ラベル**と「↻ 再読み込み」ボタンを追加。
  - APP_VERSION：2026.09.16.008 → 2026.09.17.001

- (dev v2026.09.16.008) **案件全体スケジュール機能（オリジナル工程セット）を追加**：ショットごととは別に、ユーザーが自由に工程を定義できる「案件全体スケジュール」を追加。
  - **サブタブ列**（スケジュールタブ配下）：「ショットごと」（固定）＋「オリジナル N」（複数可）＋「＋ スケジュール追加」ボタン。メインタブ列の一段下に表示。
  - **カスタムスケジュール追加**：「＋ スケジュール追加」→ 名前入力 → 空のスケジュール作成。サブタブがアクティブに切り替わる。
  - **サブタブ操作**：クリックで切替／ダブルクリックで名前変更／`×` ボタンで削除（確認あり）。
  - **工程の追加**：カスタムスケジュール内で「＋ 工程を追加」→ 名前入力 → 工程が 1 行追加される。色は `STAGE_ORDER_COLORS`（5 色パレット）を巡回で自動割当。
  - **工程の期間設定**：ショットごとと同じドラッグ操作。プレースホルダバー（薄い破線）を掴んで期間設定、その後は通常バーとして左端・右端・中央で編集可能。
  - **工程の削除**：行の右端 `×` ボタン → 確認 → 削除。
  - **ストレージ**：`projects/{pid}/pmboard/customSchedules.json` に集約保存。ショットの `schedule/{sid}.json` とは別ファイル。フォーマット：`{v:1, schedules:[{id, name, items:[{id, name, color, plannedStart, plannedEnd}]}], updatedAt}`
  - **ドラッグ処理を汎用化**：`initScheduleDrag` を shot/custom 両対応にリファクタ。`drag.target` に統一して save 時に分岐（`saveShotSchedule` or `saveCustomSchedules`）。
  - **timeline**：カスタムだけでも自動スケール可能に（`computeCustomTimeline`）。
  - APP_VERSION：2026.09.16.007 → 2026.09.16.008

- (dev v2026.09.16.007) **フィルタ機能を実装（担当者・工程・ステータス・検索）＋担当者バッジ表示**：サイドバーのフィルタ UI が実際にガントを絞り込むよう実装。
  - **フィルタ状態**：`FILTERS = {assignee, stage, status, search}` を導入
  - **filterShots(shots)**：4 条件で AND フィルタ
    - 検索：ショット名 / ID に部分一致
    - 担当者：少なくとも 1 工程の `assignee` または `reviewer` が一致
    - 工程：ショットに指定工程名が存在
    - ステータス：少なくとも 1 工程の現在ステータスが一致
  - **buildGantt** が filterShots 経由に。空結果時は「条件に合うショットがありません」表示。
  - **担当者バッジ**：ショット行に、そのショットの全工程の assignee をユニーク化して丸バッジで表示。名前 1 文字＋メンバー色（`root.members[i].color`）で識別。
  - **各 stage に currentStatus / assignee / reviewer を保存**：フィルタ判定に必要な情報を loadProjectData 時に確保。
  - **フィルタイベント**：ドロップダウンと検索 input を bindFilterEvents で監視、変更時に buildGantt を再描画。
  - APP_VERSION：2026.09.16.006 → 2026.09.16.007

- (dev v2026.09.16.006) **サイドバーに LayCAT の進捗タブ・工程設定を反映**：pmboard 左サイドバーを実データに連動して充実化。
  - **工程進捗**（新設）：プロジェクト内の各工程ラベル（Layout/Anim/FX/Comp/Paint 等）ごとに、完了数/総数 と % を横棒グラフで表示。LayCAT 進捗タブの「工程」ドーナツと同じ集計。
  - **ステータス内訳**（新設）：プロジェクト定義（`root.statuses`）の各ステータスに何ショット該当するかを縦リストで表示。各項目にステータス色のドット。「未着手」も冒頭に集計。
  - **工程設定**（新設）：`root.stages` / `stageTemplates[0].stages` から工程名リストを取り出し、番号＋色スワッチ＋工程名で表示。テンプレート未設定時はショットから集約した工程名で代替。
  - **フィルタ**（実装）：`layna_registry` 由来のプロジェクトの `members` を担当者ドロップダウンに反映。工程・ステータスも実データから動的生成（ダミー値廃止）。
  - **メンバー数** をサイドバー最上部のチップに追加（`projectMembers` の active フィルタ後）。
  - APP_VERSION：2026.09.16.005 → 2026.09.16.006

- (dev v2026.09.16.005) **予定未設定の工程にプレースホルダバーを表示・ドラッグで予定作成**：既存プロジェクトで「まだ予定を入れていない工程」に予定バーが無くドラッグ対象すら無かった問題に対応。
  - **プレースホルダバー**：予定未設定の各工程に、今日 + N日オフセットの位置で 3 日幅の破線プレースホルダを表示。opacity:.55 で薄く、hover で濃く。ラベルには「+」プレフィックス（例：「+ LAY」）で「これから追加できる」ことを示唆。
  - **ドラッグで実プランに転化**：プレースホルダを掴んだ瞬間、その DOM 描画位置から plannedStart/End を初期化し、`.seg-placeholder` クラス・薄背景・「+」ラベルを解除して通常バー扱いに切替。位置のジャンプなくシームレスに編集開始。
  - **保存フロー**：ドロップ時に `schedule/{sid}.json` へ書き出し（既存動作と同じ）。
  - APP_VERSION：2026.09.16.004 → 2026.09.16.005

- (dev v2026.09.16.004) **pmboard を LayCAT の IDB/localStorage 共有方式に移行**：フォルダ選択を pmboard から撤去し、LayCAT で設定済みのプロジェクトフォルダをそのまま使う。
  - **フォルダ選択 UI を撤去**：ヘッダー右上の「フォルダ未選択」ボタンを廃止、代わりに **プロジェクトセレクタ**（`layna_registry` から生成）を追加。ユーザーはドロップダウンで LayCAT に登録済みのプロジェクトを切替。
  - **LayCAT の IDB を共有**：pmboard は同じ URL オリジンで動作するため、LayCAT の `IndexedDB('layna').handles.proj_{pid}` から FileSystemDirectoryHandle を直接取得。
  - **URL 引数対応**：`pmboard.html?pid={pid}` で任意のプロジェクトを直接開ける。無指定時は `layna_loc.lastPageId` から推測、それも無ければ registry 先頭。
  - **権限フロー**：LayCAT で許可済みフォルダは permission 'granted' のまま利用可能。未許可の場合は「フォルダアクセスを許可」ボタン（user gesture 必須のため）を表示、ワンクリックで許可 → 接続。
  - **プロジェクト工程設定を利用**：`projectStageNames(section, root)` で `node.stages` / `root.stages` / `root.stageTemplates[0].stages` の優先順位で工程名リストを抽出。工程カラーは `STAGE_ORDER_COLORS` の 5 色パレットからプロジェクト工程配列の index で自動割当。キーワード判定と併用（Layout/Anim/FX/Comp/Paint 名の場合は固定色）。
  - **状態メッセージ**：LayCAT でプロジェクト未登録 → 「LayCAT でプロジェクトを開いてください」／プロジェクト未選択 → 「プロジェクトを選択してください」／許可待ち → 「フォルダアクセスを許可」／エラー → 対応する詳細メッセージ＋LayCAT リンク。
  - **サイドバーのフォルダ設定 UI 削除**、ヘッダー内 folder-status は「読み取り専用の接続状態表示」に降格。
  - APP_VERSION：2026.09.16.003 → 2026.09.16.004

- (dev v2026.09.16.003) **スケジュールタブを実データ対応で全機能実装**：稼働中のプロジェクトデータを直接読み書きできるように移行。ダミーデータ廃止。
  - **フォルダ選択**：ヘッダー右上「フォルダ未選択」→ クリックで FSA API（`showDirectoryPicker`）でプロジェクトフォルダを選択。IndexedDB (`pmboard_kv/projectDir`) に FileSystemDirectoryHandle を永続化し、再訪時に権限確認済みなら自動接続。
  - **ストレージ層** (`storage`)：`pickFolder / restoreFolder / ensurePermission / readJson / writeJson / listDir`。フォルダ内のパスを "/" 区切りで指定できるジェネリック API。
  - **データ読み込み** (`loadProjectData`)：
    - `laycat.project.json` を読んで DB 骨格を取得（`layna.project.json` にもフォールバック）
    - Shot section を判定（`type='section'` かつ 子が全て 'review'）
    - `shots/*.json` を並列読み込みして工程（review）詳細を取得
    - `status/*.json` を全ファイル列挙して history を取得（v:5 分離データを尊重）
    - `schedule/*.json` を全ファイル列挙して予定を取得
  - **工程分類・カラーマップ**：review 子ノード名からキーワード（レイアウト/anim/FX/コンポ/paint 等）で工程種を判定し、5 色にマッピング。未分類はハッシュベースの灰色系フォールバック。
  - **タイムライン自動スケール**：全予定・実績日の min/max ± 7 日パディング。データが無ければ今日 ± 30 日。
  - **予定 vs 実績の描画**：予定は工程色の破線枠、実績は工程色ソリッド塗り。実績の完了/進行中/遅延を状態から自動判定（`isStatusDone` は status ID/label のキーワード＋projStatuses 配列末尾判定）。
  - **シーングループ表示**：ショットの親ノード（root 除く）でグループヘッダー行を挿入。
  - **ドラッグで期間変更 → `schedule/{sid}.json` に保存**：ドロップ時に `saveShotSchedule` を呼び、`{v:1, shotId, stages:[{stageId,stageName,plannedStart,plannedEnd}], milestones, updatedAt, _rev}` を書き出し。既存 `_rev` +1 で楽観 rev 管理。
  - **サイドバー更新**：プロジェクト名・ショット数・進捗率（完了ショット数 ÷ 全ショット数）・遅延ショット数・残日数（今日〜timeline end）を自動反映。
  - **他タブ**：Phase 2 実装まで「実装予定」プレースホルダに置換。
  - LayCAT 本体・pmboard の他機能への副作用なし（読み書きは `schedule/` サブフォルダのみ、LayCAT は `schedule/` を触らない）。
  - APP_VERSION：2026.09.16.002 → 2026.09.16.003

- (dev v2026.09.16.002) **スケジュール編集：予定バーのドラッグ操作を実装**
  - 予定バー（`.seg-plan`）の左端・右端・中央でドラッグ操作可能に
  - 左端ドラッグ → 開始日のみ変更（終了日固定）／右端 → 終了日のみ／中央 → 期間維持で平行移動
  - 1 日単位でスナップ、最小 1 日、範囲は表示期間内にクランプ
  - ドラッグ中は `.drag-tip` で日付ツールチップ表示（M/D（曜）— M/D（曜） / N日 の形式）
  - ホバー時：左右端に薄い ハンドル、中央に grab カーソル
  - ドロップ時：in-memory の SHOTS を更新して再描画。Phase 1 実装時は `schedule/{sid}.json` に保存する
  - 実績バー（`.seg-actual`）はステータス遷移から算出される歴史値なのでドラッグ不可（意図的）

---

## 反映済み・パッチノート記載なし（Beta 反映済み・PATCH_NOTES.md 未記載）

（現在なし）

---

## 反映済み pmboard v0.1.0（2026-09-16）

- **初回 Beta**：pmboard.html を pmboard v0.1.0 として運用開始。
  - 5 タブ構成（スケジュール／工数／リテイク／アクティビティ／操作ログ）
  - スケジュールタブは工程別セグメント分割ガント（Layout / Anim / FX / Comp / Paint）
  - LayCAT 本体のモノクロ基調デザインを完全継承（--bg/--text/--accent 等の CSS 変数を借用）
  - 現段階はモックアップで、ダミーデータで動作。実データ連携（FSA API でフォルダ読み込み）は Phase 1 実装で対応予定。
