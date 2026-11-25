# testenv — LayCAT ローカル検証環境

本物の `laycat_dev.html` / `pmboard_dev.html` を、**本番に一切触れずに**「複数ユーザー × NAS / R2 × 障害」の条件で動かすための環境です。
デモモード（`?demo=1`）と違い、保存処理（`persist` / `setStatus` / 3-way マージ / 自動取り込み）は本物がそのまま動きます。

## 起動

```powershell
py testenv/server.py
```

（ブラウザペインからは `.claude/launch.json` の `laycat-testenv` で起動できます）

| ポート | 想定 | URL 例 |
|---|---|---|
| 8771 | ユーザー A の PC | http://127.0.0.1:8771/laycat_dev.html?as=alice |
| 8772 | ユーザー B の PC | http://127.0.0.1:8772/laycat_dev.html?as=bob |
| 8773 | ユーザー C の PC | http://127.0.0.1:8773/laycat_dev.html?as=carol |
| コンソール | 障害注入・書き込みログ | http://127.0.0.1:8771/testenv/console.html |

- **ポートが違う＝ブラウザ内保存（IndexedDB / localStorage）が別**＝別 PC 相当。同じポートで `?as=` を替えると「同じ PC でアカウント切替」相当。
- `?as=<id>` はポートごとに記憶されます（次回から付けなくてよい）。`?as=none` で未ログイン。
- `127.0.0.1` と `localhost` は別サイト扱いです。**`127.0.0.1` に統一**してください。
- オプション：`--ports 8771,8772` / `--reset`（起動時にデータ初期化）/ `--log-reads`（読み込みもログ）

### テストユーザー（`seed/testenv.json`）

| id | メール | 役割 |
|---|---|---|
| alice | alice@laycat.test | テナント `t_test` の契約者（owner） |
| bob / carol | bob@ / carol@laycat.test | `t_test` のメンバー |
| guest | guest@other.test | 許可リストのみ・テナント無所属 |
| op | op@laycat.test | 運営（operatorEmails） |
| denied | denied@laycat.test | どこにも許可なし（拒否画面の確認用） |

## 仕組み（何が本物で、何が偽物か）

| 部分 | testenv での扱い |
|---|---|
| LayCAT / pmboard のコード | **本物**（ファイルは変更しない） |
| ログイン判定（roleFor・テナント判定・拒否画面） | **本物**が動く（下の差し替えで認証ゲートを有効化） |
| Firebase Auth / Firestore | 偽物（`fakefirebase/`）。データは `data/firestore.json`、全ユーザー共有 |
| NAS（フォルダ） | 偽物。`showDirectoryPicker` を差し替え、`data/nas/` を読み書きするシムを返す |
| R2 Worker | 偽物（`server.py`）。本物の Worker と同じ URL・同じ ACL 判定（`_access.json`／テナント所属） |

HTML 配信時に `server.py` が次だけ差し替えます（`PATCHES`）。効いていないとコンソールに赤字で警告が出ます。

1. `https://www.gstatic.com/firebasejs/<ver>/` → `/testenv/fakefirebase/`
2. `location.hostname==='ogshaw03.github.io'`（認証ゲート）に `||window.__LAYCAT_TESTENV===true` を追加
3. R2 既定エンドポイント（本番 Worker）→ このサーバー
4. `<head>` 先頭に `testenv/harness.js` を挿入

## 安全

- 書き込むのは `testenv/data/`（git 管理外）だけ。本番の Firestore・R2・NAS・本番サイトのブラウザ内データには触れません。
- 二重の遮断：HTML に CSP ヘッダー（接続先は自分自身と CDN のみ）＋ `harness.js` が fetch / XHR / sendBeacon の外部宛を遮断。遮断が起きると左下バッジが橙色になります。
- サーバーは `127.0.0.1` のみで待ち受けます（LAN に公開しない）。

## 基本の流れ（NAS プロジェクトを 2 人で）

1. 8771（alice）で「＋ 新規プロジェクト」→「フォルダを指定」→ testenv のフォルダ選択で新しいフォルダを作って選ぶ → 作成
2. 8772（bob）で「参加」→「フォルダを選択」→ 同じフォルダを選ぶ
3. それぞれで操作し、コンソールの書き込みログで「誰がどのファイルを書いたか」を確認

R2 プロジェクトは作成時に「Cloudflare R2」を選ぶだけです（偽 R2 に入ります）。bob は `t_test` のメンバーなので「参加可能な R2 プロジェクト一覧」に出ます。

## 障害注入

コンソール画面、またはページのコンソールから `__testenv.faults.set([...])` で設定します。ルールの項目：

| 項目 | 意味 |
|---|---|
| `area` | `nas` / `r2` / `fs`（Firestore）/ `static`（静的ファイル）/ `any` |
| `op` | 操作の種類。NAS：`read`（中身）/ `stat`（存在確認）/ `list` / `write` / `mkdir` / `touch` / `delete`。R2：`get` / `put` / `list` / `delete` / `purge` / `mine`。Firestore：`get` / `query` / `set` / `update` / `delete` / `add` |
| `method` | `GET` / `PUT` / `POST` / `DELETE` |
| `path` | 正規表現（NAS はフォルダからの相対パス、R2 はキー、Firestore はドキュメントパス） |
| `user` | ユーザーのメール（部分一致） |
| `delayMs` / `jitterMs` | 遅延（＋ランダム幅） |
| `delayPhase` | `before`（既定：処理前に待つ）/ `after`（**処理は即時、返答だけ遅らせる**＝古い内容を掴んだまま遅れて届く） |
| `failRate` / `error` / `status` | 失敗させる確率（0〜1）、ブラウザ側で投げる DOMException 名、HTTP ステータス |
| `times` | 当たる回数の上限（省略で無制限） |

例：status の読み込みを 3 秒遅らせる（中身は即読む）
```js
await __testenv.faults.set([{area:'nas', op:'read', path:'/status/[^/]+\\.json$', delayMs:3000, delayPhase:'after'}])
```

## 検証用ヘルパー（`window.__testenv`）

| 関数 | 内容 |
|---|---|
| `run(name, params)` | `scenarios/<name>.js` を実行（本体のグローバル関数をそのまま使える） |
| `faults.set / add / list / clear` | 障害注入 |
| `log.mark()` / `log.since(seq)` / `log.reads(true)` | 書き込みログ（`reads(true)` で読み込みも記録） |
| `nas.read / readJson / list(path)` | 偽 NAS を障害注入なしで直接読む |
| `r2.read / readJson(key)` | 偽 R2 を障害注入なしで直接読む |
| `snapshot(name)` / `restore(name)` | `data/` の保存と復元（同じ状態から何度も試す） |
| `nextPick = 'フォルダ'` | 次のフォルダ選択をダイアログなしで返す（自動化用） |
| `trace` | 起動順の記録（Firebase の準備・`access.json` の読み込みなど） |
| `sleep(ms)` / `waitFor(fn, ms)` | 待機 |

## 再現シナリオ（`scenarios/`）

| ファイル | 内容 | 実行 |
|---|---|---|
| `status_race.js` | ① 自動取り込み中にステータスを変えると、画面が古い値に戻るか | NAS プロジェクトのタブで `await __testenv.run('status_race')` |
| `status_save_fail.js` | ② ステータスの保存失敗が利用者に知らされるか／変更が残るか | `await __testenv.run('status_save_fail')` |
| `r2_lost_update.js` | ③ R2 で A のステータス変更が B の無関係な保存で消えるか | 2 タブで step 1→2→3（ファイル先頭の説明参照） |

## 再現できないこと

- Firestore のセキュリティルール、本物の Worker の Firebase トークン検証
- 本物の NAS（SMB）固有のロック・遅延の揺らぎ（障害注入で近似）
- Google Drive 等の同期ソフトの競合コピー（`data/nas/` にファイルを手で置けば再現可）
- 顧客自前 R2（テナントの `r2Endpoint`）は未対応

## 片付け

- コンソールの「testenv/data を初期化」、または `py testenv/server.py --reset`
- ブラウザ側の保存（ログイン中ユーザー・接続中プロジェクト）は各ポートのサイトデータに残ります。消す場合はブラウザの「サイトデータを削除」で `127.0.0.1:877x` を消してください。
