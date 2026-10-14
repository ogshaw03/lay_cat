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

## 事前準備

- Cloudflare アカウント（Workers＋ R2 を有効化、クレジットカード登録済み）
- Node.js がインストール済み（`npx wrangler` を使うため）
- LayCAT 本体で、設定するテナントの **owner または admin 権限** を持っていること

---

## 手順

### Step 1: Cloudflare で R2 バケットを作成

1. Cloudflare ダッシュボード → R2 → 「Create bucket」
2. バケット名を決める（例：`my-company-laycat`）
   - **バケット名は顧客ごとに固有**。あとで `wrangler.toml` に書く
3. リージョンは好みで（通常 Auto で OK）

### Step 2: Worker プロジェクトを用意

1. 任意のディレクトリを作成（例：`laycat-customer-worker/`）
2. このリポジトリから以下 2 ファイルをコピー：
   - `worker/laycat-r2-api-customer.js`
   - `worker/wrangler.customer.toml.example`
3. `wrangler.customer.toml.example` を `wrangler.toml` にリネーム
4. 以下を編集：
   - `name` を自分の Worker 名に（例：`my-company-laycat-r2`）
   - `bucket_name` を Step 1 で作ったバケット名に（例：`my-company-laycat`）
   - `ALLOW_ORIGIN` に LayCAT 本体の URL を記載（通常 `https://ogshaw03.github.io` のまま。自前ホスティングなら追加）
   - `FIREBASE_PROJECT_ID` は **`laycat-54ee4` のまま変更しない**（LayCAT 本体の Firebase ユーザーを認証するため）

### Step 3: Worker をデプロイ

```bash
cd laycat-customer-worker/
npx wrangler login       # ブラウザが開く → Cloudflare アカウントでログイン
npx wrangler whoami      # 自分のアカウントを確認
npx wrangler deploy
```

成功するとデプロイ URL が表示される：

```
Deployed my-company-laycat-r2 triggers (0.XX sec)
  https://my-company-laycat-r2.<your-subdomain>.workers.dev
```

この URL を控える（Step 5 で使う）。

### Step 4: 疎通確認

```bash
curl https://my-company-laycat-r2.<your-subdomain>.workers.dev/api/r2/health
```

以下のような JSON が返れば OK：

```json
{"ok":true,"edition":"customer","ts":"2026-10-14T..."}
```

### Step 5: LayCAT 本体にエンドポイントを登録

1. LayCAT 本体を開く（`https://ogshaw03.github.io/lay_cat/laycat_dev.html`）
2. 右上の「🏢 テナント管理」ボタン → テナントを選択
3. 「R2 ストレージ」セクション
4. エンドポイント入力欄に Step 3 の URL を貼る
5. 「疎通確認」ボタンで `edition: customer` が返ることを確認
6. 「保存」ボタン → 完了

### Step 6: 新規プロジェクトを作成

- このテナントで新しく R2 プロジェクトを作成すると、自動的に顧客 R2 に保存される
- 既存の運営 R2 プロジェクトは引き続き運営 R2 に残る（混在可能）

---

## よくある質問

### Q. Firebase の Service Account は必要？
いいえ。顧客 Worker は Firebase の **公開鍵のみ**で JWT を検証します（Google のパブリック JWKS を叩くだけ）。SA JSON は不要・secret 登録不要です。

### Q. 既存の運営 R2 プロジェクトを顧客 R2 に移動したい
現状、自動マイグレ機能はありません。手動手順：
1. 運営 R2 からプロジェクトデータをダウンロード（`storage._r2.getBlob` 等を使って全ファイル取得）
2. 顧客 R2 の該当プロジェクト pid にアップロード（LayCAT 側で接続後に手動書き戻し）
3. 運営 R2 のプロジェクトを purge

将来マイグレツールを提供する予定（Phase 2）。

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
- エグレス（データ転送）：無料

LayCAT の 1 プロジェクトあたり典型値（経験則、動画 OMK 100 本程度）：
- ストレージ：5〜50 GB（動画ファイル含む）
- 月間リクエスト：数千〜数万回

小規模なら月数ドル、動画多めで中規模なら月数十ドルの想定。

---

## トラブルシューティング

### 疎通確認で `edition: unknown` または別の値が返る
- Worker がデプロイ失敗している可能性。`npx wrangler deploy` のログを確認
- 古い `laycat-r2-api.js`（運営版）がデプロイされていないか確認。顧客版は `laycat-r2-api-customer.js`

### プロジェクト作成が「保存に失敗」する
- Worker ログを `npx wrangler tail` で確認
- `auth_fail=aud mismatch` → `FIREBASE_PROJECT_ID` を `laycat-54ee4` に戻す（変更していないか確認）
- `not-a-project-member` → `_access.json` のブートストラップが失敗。LayCAT 本体で作成時に自動書き込みされるはずなので、クライアント v.013 以上を使っているか確認

### ブラウザコンソールに CORS エラー
- `ALLOW_ORIGIN` に自分がアクセスしているオリジンが含まれているか確認
- 複数オリジン対応するにはカンマ区切り（`"https://a.com,https://b.com"`）

### `/api/r2/mine` が常に空
- 顧客 R2 に `projects/*/\_access.json` が存在しないか、自分がその owner/members に入っていない
- Cloudflare ダッシュボードで R2 バケットの中身を確認

---

## 内部実装リンク

- Worker 本体：[`worker/laycat-r2-api-customer.js`](../worker/laycat-r2-api-customer.js)
- 設定テンプレ：[`worker/wrangler.customer.toml.example`](../worker/wrangler.customer.toml.example)
- クライアント側のエンドポイント解決：`storage._r2._endpointForTid()` / `_urlFor()` in `laycat_dev.html` and `pmboard_dev.html`
- Firebase ヘルパー：`window.__laynaFB.getTenantR2Endpoint()` / `updateTenantR2Endpoint()` in `laycat_dev.html`
