# 顧客自前 R2（簡易版 Worker）のセキュリティ評価

LayCAT の顧客自前 R2 Worker（[`worker/laycat-r2-api-customer.js`](../worker/laycat-r2-api-customer.js)）のセキュリティ面の整理。運営版と比べて意図的に軽量化しているので、どこが守れていてどこが要注意かを記録しておく。

関連資料：
- セットアップ手順：[`docs/CUSTOMER_R2_SETUP.md`](./CUSTOMER_R2_SETUP.md)
- 設計の 4 択（事前合意）：顧客 R2 の設定単位＝テナント／認証＝laycat-54ee4 Firebase JWT／ACL＝`_access.json` のみ／キー構造＝`projects/<pid>/` 直書き

---

## 認証・認可の 2 層

### 層 1：**Firebase ID トークン検証**（Worker レベル）

全リクエストに `Authorization: Bearer <ID トークン>` が必要。Worker は以下を検証：

- 署名の正当性（Google の公開 JWKS で RSA-SHA256 検証）
- トークンの発行者（`iss` が `https://securetoken.google.com/laycat-54ee4`）
- 対象プロジェクト（`aud` が `laycat-54ee4`）
- 期限（`exp` 未来、`iat` 未来すぎない）
- サブジェクト（`sub` 存在）

→ **「Firebase 発行の有効な ID トークン」以外は 401** で跳ねる。他の Firebase プロジェクトのトークンも通らない。

### 層 2：**`_access.json` ACL**（プロジェクトレベル）

プロジェクトごとに R2 の `projects/<pid>/_access.json` に owner/members リストがあり、`request.email` が含まれていないと **403**。

- ブートストラップ時のみ、`_access.json` 不存在のプロジェクトに「自分が owner で書く」1 回だけ特別許可
- 既存プロジェクトの `_access.json` 変更は、既にメンバーの owner しかできない

---

## 運営版との比較

| 判定 | 運営 Worker | 顧客 Worker |
|---|---|---|
| Firebase ID トークン検証 | ✅ | ✅ 同じ |
| `_access.json` per-project ACL | ✅ | ✅ 同じ |
| グローバル allowlist (`laynaAccess/config`) | ✅ | ❌ なし |
| テナントメンバーシップ (Firestore) | ✅ | ❌ なし |
| 運営エスカレーション | ✅（v2.0.1 で削除済） | ❌ なし |

**なぜ顧客版は "簡易" でも大丈夫か**：運営版の 3〜5 行目（グローバル allowlist、tenant member、エスカレーション）は「SaaS 全体での横断的な管理のため」であって、**単一テナント専用の顧客 R2 ではそもそも不要**。顧客は自分の `_access.json` を自分で管理すれば十分。

---

## OK な脅威（守れる）

| 脅威 | 守れる理由 |
|---|---|
| **他人がデータを読む** | Firebase トークンが無いと認証通らない、認証通っても `_access.json` に居ないと 403 |
| **トークン偽造** | Google の秘密鍵が無いと署名偽造不能（RSA-2048） |
| **古いトークンの再利用** | `exp` チェックで期限切れ拒否（Firebase ID トークンは 1 時間で切れる） |
| **別 Firebase プロジェクトのトークン** | `aud` チェックで `laycat-54ee4` 以外は拒否 |
| **R2 直接アクセス** | 顧客 R2 バケットは Cloudflare アカウント内でプライベート。Worker 以外からは触れない |
| **運営が顧客データを覗く** | 顧客 Cloudflare アカウント内に完結、運営は Firebase トークンを持たないしバケットにもアクセスできない |
| **CSRF** | トークンを Authorization ヘッダに載せる方式で、クッキー自動送信ではない |

---

## 気を付けないといけない点

### 1. **CORS `ALLOW_ORIGIN` の設定が緩いと XSS 時の被害が広がる**

誰かが XSS で LayCAT ユーザーの ID トークンを盗んで、そのトークンでこの Worker を叩けば認証通過してしまう。これは運営版も同じ。

- 対策：`ALLOW_ORIGIN` に信頼できるオリジン（`https://ogshaw03.github.io` 等）だけ列挙。`*` は本番で使わない

### 2. **ブートストラップ時の owner なりすまし**

`_access.json` 不存在のプロジェクトに「自分を owner として」書く経路がある。悪意ある認証ユーザーが**まだ存在しない pid** を推測してブートストラップすれば、その pid を占拠できる。

- 現実性：pid は `nd_<10 文字ランダム>` なので 36^10 ≈ 3.7 × 10^15 通りで総当りは非現実的
- もう一段固めるなら：ブートストラップした owner を Firestore に別途記録して LayCAT 側で検証、など

### 3. **`_access.json` が R2 の信頼のベース**

- Worker の権限で `_access.json` を上書きできれば権限を奪える
- 現在のルール：既にメンバー（owner/member）の人だけが `_access.json` を書き換え可能。これは `checkProjectAcl` 経由 → `object` ハンドラ経由で ACL 済み
- 懸念点：member が勝手に自分を owner に昇格できる（members 配列と owner の整合性チェックが Worker 側に無い）
   - 対策：Worker 側で「owner フィールドの変更は現 owner だけ」等のバリデーション追加の余地あり。現状はそこまで固めていない

### 4. **R2 列挙の権限**

`/api/r2/mine` は R2 バケット全体を列挙してアクセスできる `_access.json` を探す。認証通ったユーザー全員がバケットの `projects/*/_access.json` を列挙できる。

- 影響：`projects/<pid>` の pid 一覧が認証ユーザー全員に見える（owner/members に自分が居ないプロジェクトも pid だけは漏れる）
- 現実性：顧客 R2 は 1 テナント専用なのでテナント内の pid 一覧が全員に見えてもあまり問題ない
- 気になるなら：Firestore で memberships インデックスを作って Worker はそれだけ見る、という方式に差し替え可能（運営版の方式）

### 5. **Firestore ルールへの依存**

Worker 自体は Firestore を見ないので「Firestore ルール次第で情報漏れ」はこの Worker の責任ではないが、LayCAT 全体で言うと：

- `tenants/<tid>.r2Endpoint` は現在 `read: signedIn()` → 認証通ったユーザー全員が **他テナントの顧客 Worker URL** を見られる
- URL が漏れても Worker 側で ACL が効くので実被害は小さいが、情報開示としては気になるなら Firestore ルールで制限する余地あり

### 6. **Cloudflare アカウントの保護**

- 顧客 Cloudflare アカウント自体が侵害されれば R2 データが全部流出
- 顧客側で 2FA 必須にすべき
- API Token を発行して GitHub Actions 等に置く場合は秘匿必須

### 7. **運営版 Worker の `_access.json` と差がある**

運営版は `_access.json` 書換時に Firestore の `laycatMemberships` インデックスも同期する。顧客版はしない。これにより：

- 顧客 R2 プロジェクトは LayCAT 本体の「参加可能プロジェクト一覧」で、Firestore memberships 経由では見えない（R2 の `/api/r2/mine` を顧客 Worker 側に叩いて初めて見える）
- 影響：クロステナント招待（他テナントのユーザーを顧客 R2 プロジェクトに招待する）がやりにくい。_access.json に追加しても、相手が自分で顧客 Worker URL を知って接続する必要がある
- セキュリティではなく運用の課題

---

## 総合評価

| 項目 | 評価 |
|---|---|
| 認証（なりすまし防止）| 🟢 強い（Firebase の公開鍵検証） |
| 認可（アクセス制御）| 🟡 標準的（`_access.json` ベース、member/owner の 2 階層のみ） |
| データ暗号化（通信路）| 🟢 TLS（Cloudflare が提供）|
| データ暗号化（保存時）| 🟢 R2 は at-rest 暗号化標準 |
| 悪意ある内部者（運営）対策 | 🟢 強い（顧客側に完全に閉じる）|
| 悪意ある内部者（テナント member）対策 | 🟡 普通（member は他 member のデータも読み書き可、owner に昇格可）|
| 監査ログ | 🟡 `console.log` の `[audit]` 行のみ、Firestore 書込みなし（運営版はある）|

---

## 推奨改善（必要なら）

Phase 2 以降で検討候補：

1. **owner 変更の制限**：Worker 側で「owner フィールド変更は現 owner だけ」バリデーション
2. **Firestore memberships 同期**（軽量版）：顧客 Worker からも Firestore に書く経路を作る（SA JSON を顧客に預ける必要あり、トレードオフ）
3. **監査ログの外部送信**：Cloudflare Logpush 等で BI 側に流す
4. **IP 制限**：Cloudflare WAF で特定 IP だけ許可
5. **署名付き URL**：GET をトークン認証ではなく短寿命 URL ベースに（R2 presigned URL）

---

## 結論

**通常の制作会社の運用には十分安全**。SOC2 や HIPAA クラスのコンプライアンス要件があるとしても、`_access.json` ACL の挙動を監査可能にする追加実装（owner 変更ロック等）で対応可能。

むしろ **データガバナンス的には運営版より強い**：顧客 Cloudflare アカウントに完全に閉じていて、運営は顧客の R2 を一切覗けない構造になっている。
