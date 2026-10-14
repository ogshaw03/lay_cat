# 顧客自前 R2 セットアップ手順

LayCAT のテナントが「自分の Cloudflare アカウント＋ R2 バケット＋ Worker」を用意して、LayCAT 本体から独立してストレージを運用する手順です。

- 運営 R2（既定）はお試し・小規模運用向け。
- 顧客自前 R2 は中〜大規模運用、データガバナンス、コスト分離が必要な場合向け。

既存の運営 R2 プロジェクトを顧客自前 R2 に **自動マイグレーションする機能はありません**。顧客自前 R2 設定後に作成する新規プロジェクトから顧客 R2 に保存されます。

---

## 全体像

```
┌────────────────────────────────────────────┐
│ LayCAT 本体（ブラウザ）                    │
│ Firebase laycat-54ee4 で Google ログイン    │
└────────────────────────────────────────────┘
                 ↓ ID トークン Bearer
┌────────────────────────────────────────────┐
│ 顧客 Worker（顧客 Cloudflare account）     │
│ laycat-r2-api-customer.js                  │
│ - Firebase JWT 検証（公開鍵のみ・SA 不要） │
│ - _access.json で ACL 判定                 │
└────────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│ 顧客 R2 バケット（1 テナント専用）         │
│ キー構造：projects/<pid>/<path>            │
└────────────────────────────────────────────┘
```

---

## 事前準備（1 回だけ）

### 必要なもの

- **Cloudflare アカウント**（Workers＋ R2 を有効化、クレジットカード登録済み）
- **Node.js**（インストーラの手順は下記）
- **LayCAT 本体での操作権限**
  - テナント所属 → そのテナントの **owner または admin**
  - 個人ユーザー → 自分のマイページから設定可能（下記の Firestore ルール更新が必要）
  - 運営（operator）→ **operator テナント**の owner/admin として自分を登録する必要がある

### Node.js のインストール

PowerShell で `node --version` を叩いて `v20.x.x` 等が出ればスキップ。

出なければ：

1. [https://nodejs.org/](https://nodejs.org/) を開く
2. **LTS 版**をダウンロード（画面左側の緑ボタン）
3. インストーラを実行：
   - 「Add to PATH」の**チェックは外さない**
   - 「npm package manager」の**チェックは外さない**
   - 「Automatically install the necessary tools」の**チェックは外して OK**（Python 等のビルドツールは不要）
4. インストール完了後、**PowerShell を一度閉じて開き直す**（PATH 反映のため）
5. 確認：

```powershell
node --version    # v20.x.x
npm --version     # 10.x.x
npx --version     # 10.x.x
```

3 つとも出れば OK。

### PowerShell の実行ポリシー緩和

PowerShell は既定でスクリプト実行がブロックされており、`npx` も実行できません。1 度だけ緩和します：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

確認プロンプトで **`Y`** を入力して Enter。

- `RemoteSigned`：ローカルで作ったスクリプトは自由に実行可、ネットから落としたものは署名が必要
- `CurrentUser`：自分のユーザーのみに適用
- Microsoft の公式ドキュメントでも開発者向けに案内されている設定

### Firestore ルールの更新（運営側で 1 度だけ）

個人ユーザーがマイページから自前 R2 を設定するには Firestore ルール更新が必要です。

1. [https://ogshaw03.github.io/lay_cat/access-console.html](https://ogshaw03.github.io/lay_cat/access-console.html) をハードリロード（Ctrl+Shift+R）
2. 「Firestore ルール」セクションに表示されるルール全文をコピー
3. [Firebase コンソール](https://console.firebase.google.com/) → `laycat-54ee4` → Firestore Database → **ルール** タブ
4. 既存ルールを全部削除し、コピーしたルールを貼り付け → **公開**

これで `tenants/personal__<emailKey>` および `tenants/<tid>.r2Endpoint` を正しい権限で書けるようになります。

---

## デプロイ手順

### Step 1: R2 バケットを作成

**ダッシュボードで作る唯一のステップ**です。

1. Cloudflare ダッシュボード → **R2 Object Storage** → **Create bucket**
2. バケット名を決める（例：`my-company-laycat`）
   - **バケット名は顧客ごとに固有**。後で `wrangler.toml` に書く
3. リージョンは **Auto** でよい

Worker 自体はダッシュボードで「Create application」等を押さなくて OK。次のステップで wrangler が自動作成します。

### Step 2: Worker プロジェクトを用意

1. 任意の作業ディレクトリを作る（例：`E:\laycat-customer-worker\`）
2. このリポジトリから以下 2 ファイルを**作業ディレクトリにコピー**：
   - `worker/laycat-r2-api-customer.js`
   - `worker/wrangler.customer.toml.example`
3. `wrangler.customer.toml.example` を **`wrangler.toml`** にリネーム
4. `wrangler.toml` をテキストエディタで開き、以下 2 箇所を変更：
   - `name` → **自分の Worker 名**（他ユーザーと被らない名前、例：`my-company-laycat-r2`）
   - `bucket_name` → Step 1 で作ったバケット名
5. 以下は**変更しない**：
   - `FIREBASE_PROJECT_ID = "laycat-54ee4"` ← LayCAT 本体の Firebase と一致させる必要あり
   - `ALLOW_ORIGIN` ← LayCAT 本体の URL が入っている（自前ホスティングなら追加）

PowerShell で以下をまとめて実行する場合：

```powershell
mkdir E:\laycat-customer-worker
cd E:\laycat-customer-worker
Copy-Item "E:\OG_Tools\lay_cat\lay_cat\worker\laycat-r2-api-customer.js" .
Copy-Item "E:\OG_Tools\lay_cat\lay_cat\worker\wrangler.customer.toml.example" "wrangler.toml"
notepad wrangler.toml   # メモ帳で開いて name と bucket_name を編集
```

### Step 3: Worker をデプロイ

```powershell
cd E:\laycat-customer-worker
npx wrangler login       # ブラウザが開く → Cloudflare アカウントで Authorize
npx wrangler whoami      # 自分のアカウント名を確認
npx wrangler deploy
```

`wrangler login` ではブラウザで Cloudflare が「Wrangler がアカウントにアクセスしていいか」と聞いてくるので **Authorize** を押します。これは「ターミナルから `wrangler` コマンドで自分の Cloudflare リソースを操作していい」という同意です。

デプロイ成功時の出力例：

```
Uploaded my-company-laycat-r2 (2.49 sec)
Deployed my-company-laycat-r2 triggers (0.65 sec)
  https://my-company-laycat-r2.ogusho1101.workers.dev
Current Version ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**この URL（`https://<worker-name>.<サブドメイン>.workers.dev`）を控える**。Step 5 で使う。

### Step 4: 疎通確認

PowerShell では `curl` が `Invoke-WebRequest` の別名になっていて警告が出ることがあるので、**`curl.exe` と `.exe` 付きで実行**：

```powershell
curl.exe https://<自分の Worker URL>/api/r2/health
```

`<自分の Worker URL>` には **Step 3 で出た URL（`https://my-company-laycat-r2.<サブドメイン>.workers.dev`）** を貼り付けます。`<サブドメイン>` のままだと「ホスト名を解析できませんでした」エラーになるので注意。

成功レスポンス：

```json
{"ok":true,"edition":"customer","ts":"2026-10-14T..."}
```

**`edition:"customer"` が返ることが重要**。もし返ってこない or 別の値（`unknown` 等）なら、間違えて運営版（`laycat-r2-api.js`）をデプロイしている可能性があります。

### Step 5: LayCAT 本体にエンドポイントを登録

**URL は `https://<worker-name>.<サブドメイン>.workers.dev` までで、`/api/r2/...` は含めない**（クライアントが自動で付加します）。

LayCAT 本体をハードリロード（Ctrl+Shift+R）してから、アカウント種別に応じて以下へ：

#### テナント所属ユーザー（owner / admin）

1. 右上の **🏢 テナント管理** → テナント選択
2. 「R2 ストレージ」セクション
3. エンドポイント入力欄に Worker URL を貼る
4. **疎通確認** ボタンで `edition: customer` が返ることを確認
5. **保存**

#### 個人ユーザー（純粋な個人、どのテナントにも所属していない）

1. 右上のユーザー名クリック → **マイページ**
2. 「R2 ストレージ」セクションに個人用の UI が出る
3. エンドポイント URL を入力 → **疎通確認** → **保存**

#### 運営（operator）ユーザー

1. まず access-console から **operator テナント**（`tenants/operator`）を作成し、自分を owner または admin として登録
2. LayCAT 本体をリロード → **🏢 テナント管理** → `operator` テナント選択
3. 「R2 ストレージ」セクションで設定

マイページを開いた時に「R2 ストレージ」セクションにあなたの状態が自動判定されて案内が表示されます（個人は入力 UI、operator / テナント member は該当モーダルへの案内）。

### Step 6: 新規プロジェクトを作成

- このテナント／個人で新規に R2 プロジェクトを作ると、自動的に顧客 R2 に保存される
- 既存の運営 R2 プロジェクトはそのまま運営 R2 に残る（混在可能）
- クライアントは tid 毎のエンドポイントを 5 分キャッシュするので、設定直後に反映しない場合はハードリロード

---

## 補足：`wrangler deploy` がやっていること

ダッシュボードから手動で全部やるのではなく CLI コマンド 1 発でデプロイできるのは、`wrangler` が以下を自動化しているからです：

1. **`wrangler.toml` を読む**：Worker 名・ランタイム・バインディング設定を取得
2. **コードをバンドル**：`laycat-r2-api-customer.js` と依存関係を Workers 用の形式にまとめる
3. **Cloudflare API に認証**：`wrangler login` で保存された OAuth トークンを使う
4. **Worker スクリプトをアップロード**：
   - 無ければ **新規作成**（ダッシュボードに表示されるようになる）
   - あれば **既存の Worker を上書き**（同じ名前なら差分更新）
5. **バインディング登録**：R2 バケット（`bucket_name` で指定）と環境変数（`FIREBASE_PROJECT_ID`、`ALLOW_ORIGIN` 等）を Worker に設定
6. **ルーティング有効化**：`<worker-name>.<サブドメイン>.workers.dev` に公開
7. **バージョン ID 発行**：ロールバック可能なデプロイ記録を残す

全部ダッシュボードから手動でもできますが、約 300 行のコードを貼り付けたりバインディングを 1 つずつ UI で設定したりは煩雑なので、CLI 推奨です。

---

## よくある質問

### Q. Firebase の Service Account は必要？
いいえ。顧客 Worker は Firebase の **公開鍵のみ**で JWT を検証します（Google のパブリック JWKS を叩くだけ）。SA JSON は不要・secret 登録不要です。

### Q. 既存の運営 R2 プロジェクトを顧客 R2 に移動したい
現状、自動マイグレ機能はありません。手動手順：
1. 運営 R2 からプロジェクトデータをダウンロード
2. 顧客 R2 の該当プロジェクト pid にアップロード
3. 運営 R2 のプロジェクトを purge

将来マイグレツールを提供する予定。

### Q. 顧客 R2 設定を外した場合（エンドポイント空欄で保存）
- そのテナントのプロジェクトは **運営 R2** を見に行くようになります
- **既存の顧客 R2 のデータは参照できなくなります**（キーが運営 R2 側に存在しないため 404）
- バックアップせずに戻すとデータ消失扱いになるので注意

### Q. 複数のテナントが同じ顧客 R2 を共有できる？
現状は **1 顧客 Worker = 1 テナント専用** の設計（URL に tid を含めないため）。将来マルチテナント化が必要なら顧客 Worker 側も `tenants/<tid>/` プレフィックスを付ける拡張が必要（運営 Worker と同じ構造になる）。

### Q. Cloudflare のコスト目安
R2 の 2026 年現在の料金：
- ストレージ：$0.015/GB/月
- Class A 操作（PUT/POST）：$4.50/1M リクエスト
- Class B 操作（GET）：$0.36/1M リクエスト
- エグレス（データ転送）：**無料**

LayCAT の 1 プロジェクトあたり典型値（経験則、動画 100 本程度）：
- ストレージ：5〜50 GB
- 月間リクエスト：数千〜数万回

小規模なら月数ドル、動画多めで中規模なら月数十ドルの想定。

---

## トラブルシューティング

### `npx : 用語 'npx' は認識されません`
Node.js が未インストール or PATH が通っていない。事前準備セクションの Node.js インストール手順を実施して PowerShell を再起動。

### `npx : このシステムではスクリプトの実行が無効になっているため…`
PowerShell 実行ポリシーが制限中。事前準備セクションの `Set-ExecutionPolicy` コマンドを実行。

### `curl : パラメーター 'Uri' をバインドできません。…"無効な URI"`
URL に `<your-subdomain>` のような placeholder が残っている。Step 3 のデプロイ出力に出た実 URL に置き換える。

### `curl` 実行時に「セキュリティ警告」ダイアログが出る
PowerShell の `curl` が `Invoke-WebRequest` のエイリアスで HTML 解析時のスクリプト警告を出している。`curl.exe` と `.exe` を付けて本物の curl を呼ぶ。

### `curl.exe https://...` が `{"error":"unauthorized","detail":"no bearer"}` を返す
Worker 自体は正常。root パス（`/`）には認証が必須なだけ。**`/api/r2/health`** のパスを付けて叩き直す（認証不要）。

### 疎通確認で `edition: unknown` または別の値が返る
古い `laycat-r2-api.js`（運営版）がデプロイされていないか確認。顧客版は `laycat-r2-api-customer.js`。

### プロジェクト作成が「保存に失敗」する
PowerShell で `npx wrangler tail` を叩いて Worker ログを確認：
- `auth_fail=aud mismatch` → `FIREBASE_PROJECT_ID` を `laycat-54ee4` から変えてしまっている
- `not-a-project-member` → `_access.json` のブートストラップ失敗。LayCAT 本体 v.013 以上を使っているか確認

### ブラウザコンソールに CORS エラー
`ALLOW_ORIGIN` に自分がアクセスしているオリジンが含まれていない。カンマ区切りで追加して `wrangler deploy` し直す。

### 保存成功のトーストは出たが新規プロジェクトが運営 R2 に行く
作成時に `resolveTidForNewProject` が返す tid と、設定を保存した tid が異なる可能性。マイページを開き直して「R2 ストレージ」セクションの表示を確認：
- 「あなたは operator です…」と出る → operator テナントで設定する必要あり
- 「あなたのプロジェクトは <テナント名> テナントに保存されます」と出る → そのテナントの owner/admin がテナント管理モーダルから設定する必要あり

### `/api/r2/mine` が常に空
顧客 R2 に `projects/*/_access.json` が存在しないか、自分がその owner/members に入っていない。Cloudflare ダッシュボードで R2 バケットの中身を確認。

### Firestore `tenants/personal__xxx` への書込が拒否される
Firestore ルールが未更新。事前準備セクションの Firestore ルール更新手順を実施。

---

## 内部実装リンク

- Worker 本体：[`worker/laycat-r2-api-customer.js`](../worker/laycat-r2-api-customer.js)
- 設定テンプレ：[`worker/wrangler.customer.toml.example`](../worker/wrangler.customer.toml.example)
- クライアント側のエンドポイント解決：`storage._r2._endpointForTid()` / `_urlFor()` in `laycat_dev.html` and `pmboard_dev.html`
- Firebase ヘルパー：`window.__laynaFB.getTenantR2Endpoint()` / `updateTenantR2Endpoint()` in `laycat_dev.html`
- Firestore ルール：[`access-console.html`](../access-console.html) の `RULES` 定数
