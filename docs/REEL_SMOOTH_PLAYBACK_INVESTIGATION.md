# REEL 連続再生の「カット切替プチ止まり」対策 — 調査と対応ログ

対象期間：dev v2026.07.29.077 〜 v2026.08.05.033
現状：**かなり改善したが完全解消ではない**（下記「残タスク」参照）
このドキュメントは将来もう一段の改善を入れるときの引継ぎ用。

## 症状

REEL の連続再生（複数クリップ・auto play）でカットが切り替わる瞬間に、旧クリップの最終フレーム or 新クリップの 1 フレーム目が数十 ms 静止画で見える。特に：
- ループ 2 周目以降
- スクラブで別クリップへ戻して再生し直したとき
- 単発でも稀に

## 関連コード

すべて `laycat_dev.html` 内。REEL 関連は `openReel()` 関数（line ~10755）以下。

- `loadCur(auto)` — クリップ切替の中核（line ~12782）
- `activate(v)` — video 要素の opacity/mute 差替え（line ~12768）
- `getVid(url)` / `warmRest(v)` / `preloadNext()` — video プールと priming（line ~12744〜）
- `attachVid(vd)` — 各 video 要素へのイベント配線（ended/playing/loadedmetadata 等、line ~12971）
- `tick()` — rAF ループ（line ~12987）
- `mkVid()` — video 要素生成（`opacity:0` で作る、line ~11206）

## 4 系統サブエージェント解析（v.022〜v.024 の段階）

session: `laycat-reel-freeze`（管制室ログ）

| 系統 | 見解 |
|---|---|
| A1 preempt 到達 | プリエンプト自体は発火する。fastSwap 前段の `getVid(readyState≥2)` 不成立で slow 経路落ちしていた |
| A2 play 遅延 | `warmRest` は fire-and-forget で readyState≥2 保証しない／`muted→false` の audio pipeline 初期化 30-50ms が描画クリティカルパスに |
| A3 rvfc 適用 | 全モダンブラウザ対応。「NEW クリップ 1F 目到達で activate」で理論上ほぼ 0 静止 |
| A4 描画パス | opacity 切替自体は軽量。canvas 単一描画統合は抜本策だが実装コスト大 |

## 実装した対策の変遷

### 段階 1：末尾プリエンプト（v.024）
`tick()` rAF ループ内で `video.duration - video.currentTime < 1 フレーム分` を検出したら、`ended` イベント（数十 ms 遅延して発火）を待たず自前で `loadCur(true)` 先行発動。`reelUI._preemptFor` で同一クリップ多重発動ガード。範囲再生／scrub 中は既存 ended ハンドラに任せる。

### 段階 2：rvfc で 1F 目到達を待って activate（v.025）→ **revert（v.028）**
`target.play()` 直後に `target.requestVideoFrameCallback(flip)` で opacity 切替を deferring。opacity=0 の video で rvfc が発火しないブラウザ挙動＋各種フラグ後始末不備で挙動不安定を招き、v.025〜v.027 を revert。

### 段階 3：動画切替クリティカルパスから DOM 構築を排除（対策 A・v.029）
`buildLayerPanel` / `reelNotes` / `updUnsent` / `updReelHeaderInfo` を `heavyUI()` に括り出し、fastSwap 成立時のみ `reelWin.setTimeout(heavyUI, 0)` で次 tick に defer。動画切替クリティカルパスは activate + play + RV.total/fitAnno のみに。

軽い state（`RV.pending` / `RV.hist` / `cta.value` / `RV.FPS` 等）は同期実行で視覚的整合性を保つ。割り切り：レイヤーパネル・コメント欄・ヘッダバッジ・ステータスは 1〜2 rAF（16-33 ms）遅れて反映される。

### 段階 4：preloadNext を decoder priming 型に強化（対策 B・v.030）
次クリップ video に対して「muted で play → 'playing' 発火で pause + currentTime=0」まで進めて decoder pipeline を温める。Chrome の VideoDecoder は初回 play で初期化コスト（数十 ms）を払うのを事前消化。`v._primed` フラグで 1 回限りガード。

### 段階 5：ループ 2 周目のカクつき対策（v.031）
`preloadNext` の対象を「cur+1」から「cur+1 or (loop 末尾なら cs()[0])」に拡張。ループ再生時、末尾クリップの preloadNext 発火時点で先頭クリップも同時に再 priming される。判定を「1 回限り」から「`_primed && currentTime<0.05` で skip、末尾まで再生し切っていれば再 priming」に変更。

### 段階 6：スクラブでのカクつき対策（v.032）
非ファストスワップ経路（`target !== video`）で activate 前に `target.pause()` ＋ pendSeek 事前反映。priming 中の target を activate すると `opacity=1 + unmute` で意図せず一瞬 0F から再生される（音プツ／フレームフラッシュ）＋ pendSeek を activate 後に seek すると「priming 位置 → pendSeek」の余計な描画が挟まる → 両方を回避。

### 段階 7：非ファストスワップ経路でも heavyUI defer（v.033）
fastSwap の条件（`target.readyState>=2` かつ `RV.pendSeek==null` かつ `auto`）を満たさない経路に落ちると heavyUI が同期実行され、旧クリップ最終フレームが数十 ms 静止する原因になっていた。非ファストスワップ経路（`target===video` / 非同一 target で priming 未完了）でも activate 後に `reelWin.setTimeout(heavyUI, 0)` で defer するよう変更。動画切替クリティカルパスから DOM 構築を全経路で排除。

## 現状の残タスク（未実装の対策候補）

### C：プリエンプト閾値を広げる
現状 `ft * 1.1`（1F 分 × 1.1 ≈ 46ms @24fps）。rAF ジッタ 16.67ms を差し引くと実効リード 20-30ms しかない場面がある。`ft * 3` （≈ 125ms）に広げれば state churn を吸収しやすい。

代償：旧クリップの最後 3-4 フレームは見えなくなるが体感差は無視できる。実装は 1 行変更。

### D：muted → unmute を 'playing' 後に遅延
`activate()` の中で即 `muted=false` を叩いているが、audio pipeline 初期化 30-50ms を描画クリティカルパスから外すために `'playing'` イベント発火後に遅延する。実装：activate に `deferAudio` オプション、'playing' で unmute の once ハンドラ登録。

### E：canvas 単一描画統合（抜本策）
2 video を offscreen に置いて `drawImage(activeVid)` で 1 canvas に焼き、GPU レイヤ切替を消す。実装 500+ 行の書換え。効果大だが優先度低。

### F：rvfc の再導入（別方式で）
段階 2 で失敗した rvfc を、opacity 差替えではなく「readyState 監視の補助」として使う。preloadNext priming の完了検知や、activate 直後の 1F 到達確認による bridge hide タイミング調整に使えば副作用少ない。

### G：pool 上限の見直し
`POOL_MAX=16`。多量の video 要素は decoder resource contention の可能性。8 程度に減らす／LRU 明示化を検討。

## 触ってはいけないこと（設計方針）

- **REEL v036 常時同期モデル**：`v.review.notes` が真実のソース、pending はセッション中表示ミラー。触るな。
- **REEL 送信済み drawing 保護方針**（v058）：送信済み drawing は Undo/Redo・消しゴム・投げ縄の対象外。マネキンダブルクリック再編集のみ例外。
- **`activate()` の video 差替え順序**：old.pause → old.opacity=0 → video 変数入替 → new.opacity=1 → new.muted=false。この順を守ること（順序を入替えると audio pop や描画順の副作用）。
- **単一クリップ／ループでプリエンプト非発火**（v.028 revert 時に確認）：`canForward || canLoopWrap` の判定が抜けると同じ video を seek し直すだけで無限ループする。
- **`RV.pending` の参照は `c.pending` そのもの**（別配列 copy 不可）：切替時に `RV.hist` リセットしないと Undo で別クリップの pending に書き込む事故。

## 検証方法

1. 3 クリップ以上を並べて loop 再生 → 切替瞬間の視覚確認
2. スクラブでクリップ跨ぎ → 再生 → 冒頭の滑らかさ確認
3. 単一クリップ loop → 数周させて固まらないか
4. 長時間再生（10 周以上）で pool 圧迫時の挙動確認

## 参考

- v.025 の rvfc 失敗ログ：`_preempted` フラグ管理が煩雑化して破綻。もう一度入れるなら flag より明確な状態遷移を設計すること。
- 管制室セッション `laycat-reel-freeze`：4 系統の解析生ログ。
- 関連コミット：`0ef4180` (v.014, doNew リセット), `77b1f2d` (v.023, ファストスワップ導入), `9023d1b` (v.033, 現状最新)
