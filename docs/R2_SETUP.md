# LayCAT × Cloudflare R2 セットアップ手順

LayCAT のプロジェクトデータ（`laycat.project.json`＋動画・画像・リール）を Cloudflare R2 に置くための、
運営（ogusho1101@gmail.com）向けのセットアップメモです。

- 前提：**アクセス制御（Firebase Auth／`laynaAccess`）は Firestore のまま**。R2 は「プロジェクトデータの置き場」だけを担当する。
- R2 バケットは公開しない（すべて Cloudflare Workers のプロキシ API 経由でアクセス）。
- 認可：Worker が Firebase の ID トークンを検証し、そのユーザーが `laynaAccess` に登録済みかを確認したうえで、要求パスがそのプロジェクトのプレフィックスに収まっているかチェックする。
- 既存プロジェクト（フォルダ運用）はそのまま維持。R2 は新規プロジェクト向けの選択肢として追加する（併用）。

---

## 全体像

```
[ブラウザ・LayCAT]
   │  ① ログイン（Firebase Auth → ID トークン取得）
   │  ② PUT/GET/DELETE /api/r2/{projectId}/{path}
   ▼
[Cloudflare Workers（laycat-r2-api）]
   │  ・ID トークン検証（Firebase 公開鍵）
   │  ・Firestore で allowedEmails/allowedDomains/invited を確認
   │  ・path プレフィックスが projectId 直下か検査
   ▼
[Cloudflare R2 バケット（laycat-projects）]
   projects/<projectId>/laycat.project.json
   projects/<projectId>/media/<file>
   projects/<projectId>/reels/reels.json
```

---

## 1. Cloudflare アカウント作成 → R2 バケット作成

1. https://dash.cloudflare.com/sign-up でアカウント作成（既存アカウントがあればそれで OK）。
2. 左メニュー **R2 Object Storage** を開き、`R2 を有効化`。
   - 無料枠：ストレージ 10GB / 月、Class A（書き込み系）100万リクエスト / 月、Class B（読み取り系）1000万リクエスト / 月、**エグレス完全無料**。
3. **Create bucket**：
   - Name: `laycat-projects`（半角小文字・ハイフン）
   - Location: `Automatic`（または `APAC` 明示）
   - Public access: **無効のまま**（Worker 経由のみ）

---

## 2. Worker（プロキシ API）をデプロイ

`worker/laycat-r2-api.js`（このリポジトリに同梱）をベースに、Cloudflare Workers としてデプロイする。

### 2-1. wrangler をインストール

```bash
npm i -g wrangler
wrangler login
```

### 2-2. Worker プロジェクトを作成

```bash
mkdir laycat-r2-worker && cd laycat-r2-worker
# このリポジトリの worker/laycat-r2-api.js を index.js としてコピー
cp /path/to/lay_cat/worker/laycat-r2-api.js index.js
```

`wrangler.toml` を作成：

```toml
name = "laycat-r2-api"
main = "index.js"
compatibility_date = "2025-01-01"

[[r2_buckets]]
binding = "R2"                       # Worker から env.R2 でアクセス
bucket_name = "laycat-projects"

[vars]
FIREBASE_PROJECT_ID = "layna-app"    # Firestore と同じ projectId
ALLOW_ORIGIN = "https://ogshaw03.github.io"
# 開発時は "*" ではなく "https://ogshaw03.github.io,http://localhost:8080" のようにカンマ区切りで指定
```

### 2-3. Firestore アクセス用の Service Account

Worker から Firestore（`laynaAccess/*`）を読むために、Firebase コンソールで
`Project settings > Service accounts > Generate new private key` を実行。
出てきた JSON の中身を丸ごと Worker Secret として登録：

```bash
wrangler secret put FIREBASE_SERVICE_ACCOUNT
# プロンプトで JSON を1行にして貼り付け（改行を \n にエスケープ）
```

### 2-4. デプロイ

```bash
wrangler deploy
```

デプロイ後のエンドポイント例：`https://laycat-r2-api.<你のサブドメイン>.workers.dev`

---

## 3. LayCAT 側の設定

`laycat_dev.html`（Dev）でまずテスト。ログイン後、
環境設定 → 「Cloudflare R2 エンドポイント」に Worker の URL を貼る（実装後に UI 追加予定）。

登録された URL は `localStorage` に保存され、R2 モードのプロジェクトからのみ使用される。
ローカルフォルダ運用のプロジェクトには影響しない。

---

## 4. CORS

Worker 側の `ALLOW_ORIGIN` に LayCAT が乗るオリジンを列挙する：

- 本番（Beta）：`https://ogshaw03.github.io`
- 開発時のローカルプレビュー：追加したければカンマ区切り

R2 バケット自体の CORS 設定は**不要**（アクセスは Worker のみ・ブラウザから直接 R2 は叩かない）。

---

## 5. データレイアウト

```
laycat-projects/                       # R2 バケット
└── projects/
    └── <projectId>/                   # 例: n_1710000000_ab12
        ├── laycat.project.json        # プロジェクトメタ（フォルダ運用と同じフォーマット）
        ├── media/                     # 動画・画像
        │   ├── v_1710000001_cd34.mp4
        │   └── ...
        └── reels/
            └── reels.json
```

- 1 プロジェクト＝1 プレフィックス（`projects/<projectId>/`）。Worker はリクエストされた key の先頭がこの形か検査し、他プロジェクト領域へのアクセスを拒否する。
- 命名規則はフォルダ運用と同じで、`laycat.project.json` のスキーマも同じ（暗号化封筒も同じ形）。
  ローカル→R2、R2→ローカルの相互移行が理論上できる（実装は後回し）。

---

## 6. 料金の目安（無料枠を超えた場合）

- ストレージ：$0.015 / GB / 月（1TB＝月 $15）
- Class A：$4.50 / 100万リクエスト（PUT/POST/COPY/DELETE/LIST）
- Class B：$0.36 / 100万リクエスト（GET/HEAD）
- エグレス：**$0**

LayCAT の想定使い方（数名〜十数名、動画中心）だと**当面は無料枠内**で回る想定。
Firestore にプロジェクトデータを載せた場合の見積もり（毎月数十ドル〜）と比較して安価。

---

## 7. トラブルシュート

- **401/403**：Firebase ID トークンが期限切れ・`laynaAccess` に未登録・別プロジェクトの key を触った、のいずれか。ブラウザで再ログインしてから試す。
- **404**：バケット内にファイルが無い。初回書き込み前の GET は 404 でも正常。
- **CORS エラー**：Worker の `ALLOW_ORIGIN` に現在のオリジンが含まれていない。
- **wrangler deploy が Missing binding**：`wrangler.toml` の `[[r2_buckets]]` が抜けているか、bucket_name が誤り。

---

## 8. 削除・移行

- プロジェクト削除：LayCAT 側で `storage.delProject(id)` を呼ぶと、Worker DELETE で
  `projects/<projectId>/` 配下を全消去する（R2 の LIST → DELETE ループ）。
- ローカル → R2 移行：将来対応。当面は「新規プロジェクトは R2、既存はローカルのまま」。
