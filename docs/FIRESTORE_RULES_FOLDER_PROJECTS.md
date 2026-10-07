# Firestore ルール：NAS プロジェクト参加履歴（Lv.3 暗号化）

LayCAT v.126 で追加した「NAS プロジェクト参加履歴の暗号化同期」機能のための Firestore ルール追加分。

## 新規コレクション：`laycatUserPrivate/{emailKey}`

本人（emailKey が自分のメールの正規化キーと一致するユーザー）だけが読み書きできる。
中身：
- `encKeyB64`：AES-GCM 256bit 鍵（base64 の文字列）。初回ログイン時に自動発行。
- `folderProjects`：`{ [pid]: {nameEnc, nameIv, hintEnc, hintIv, addedAt} }`。name / folderHint はこの `encKeyB64` で暗号化（本人以外は復号不可）。
- `createdAt`：ISO タイムスタンプ。

## 追加するルール

Firebase コンソール → Firestore → ルールタブに以下を追加：

```javascript
match /laycatUserPrivate/{emailKey} {
  allow read, write: if request.auth != null
    && request.auth.token.email != null
    && request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_') == emailKey;
}

// v.127：NAS プロジェクト招待（オーナー → 新規メンバー）
match /laycatFolderInvites/{token} {
  allow create: if request.auth != null
    && request.resource.data.fromEmailKey == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_');
  allow read, delete: if request.auth != null
    && (resource.data.toEmailKey   == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_')
     || resource.data.fromEmailKey == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_'));
  allow update: if false;
}

// v.134：NAS プロジェクト削除指示（Phase 3）
match /laycatFolderRevocations/{token} {
  allow create: if request.auth != null
    && request.resource.data.fromEmailKey == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_');
  allow read, delete: if request.auth != null
    && (resource.data.toEmailKey   == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_')
     || resource.data.fromEmailKey == request.auth.token.email.lower().replace('[.@#$/\\[\\]]', '_'));
  allow update: if false;
}
```

**ポイント**
- `allow read` を他ユーザーに開けないこと（既存の `laycatUsers/{emailKey}` と違い、こちらはプライベート）。
- Firestore ルールのメール正規化は クライアント側 (`String(email).toLowerCase().replace(/[.@#$/\[\]]/g, '_')`) と**厳密に一致**させる。角括弧のエスケープが必要なので要注意。

## 動作確認

1. ルールを反映（Firebase コンソールで公開）。
2. LayCAT にログイン → 「⇄ プロジェクトに接続」→ フォルダピッカーで NAS プロジェクトを選択。
3. Firestore コンソールで `laycatUserPrivate/<自分のメールキー>` を開き、`folderProjects.<pid>` に `nameEnc`/`hintEnc` が暗号文（base64）で入っていることを確認。
4. 別端末（別ブラウザ）で同じアカウントでログイン → 「⇄ プロジェクトに接続」モーダルを開くと「以前接続した NAS プロジェクト」セクションに復号された名前で表示される。クリック→ピッカーで同じ NAS フォルダを選べば接続完了。
5. 他ユーザー（別メール）でログインして自分の `laycatUserPrivate/<自分のメールキー>` を読もうとすると `PERMISSION_DENIED`。

## 脅威モデル

| 脅威 | この対策で防げるか |
|------|------|
| 他 LayCAT ユーザーが別人の参加プロジェクト名を Firestore 直読で見る | ✅ 防げる（ルールで read 拒否） |
| Firestore バックアップ / DB ダンプが流出してプロジェクト名・フォルダ名が見られる | ✅ 防げる（中身は AES-GCM 暗号文） |
| Firebase プロジェクト管理者（Google Cloud コンソール保有者）が中を見る | ❌ 鍵も Firestore 上にあるため同時に見られる（既存の脅威モデル通り） |
| LayCAT のソースコードが流出して暗号化方式が解析される | △ AES-GCM 自体は十分強いので、鍵が流出しない限りは安全 |

Firebase プロジェクト管理者からも隠したい場合は Phase 2 でクライアント発行の鍵をパスフレーズで保護する選択肢あり（Argon2id などで派生）。本リリースでは「DB ダンプ漏洩対策」までを射程とする。
