# Phase 2 セットアップガイド

## 📋 提供されたファイル

以下のファイルを、あなたのプロジェクトに追加します：

- `api_create-checkout-session.js` → `/api/create-checkout-session.js` へ移動
- `api_webhook.js` → `/api/webhook.js` へ移動
- `api_get-gold-balance.js` → `/api/get-gold-balance.js` へ移動
- `api_consume-gold.js` → `/api/consume-gold.js` へ移動

---

## 🚀 統合ステップ

### STEP 1：`/api` フォルダを作成

プロジェクトのルートに `/api` フォルダを作成してください：

```
real-dog-sim/
  ├── api/          ← 新規作成
  │   ├── create-checkout-session.js
  │   ├── webhook.js
  │   ├── get-gold-balance.js
  │   └── consume-gold.js
  ├── package.json
  └── ...
```

### STEP 2：ファイルを `/api` フォルダに移動

上記の 4つのファイルを `/api` フォルダにコピーしてください。

### STEP 3：ファイル名から「api_」プレフィックスを削除

例：
- `api_create-checkout-session.js` → `create-checkout-session.js`

### STEP 4：必要な npm パッケージをインストール

ターミナルで以下を実行：

```bash
npm install stripe @supabase/supabase-js
```

### STEP 5：GitHub にプッシュ

```bash
git add .
git commit -m "Phase 2: Add backend APIs for in-app purchase"
git push origin main
```

### STEP 6：Vercel で自動デプロイ確認

Vercel ダッシュボードで、ステータスが「Ready」に変わるまで待ってください（2〜5分）。

---

## 🧪 テスト方法

### テスト1：ゴールド残高取得

```bash
curl -X POST http://localhost:3000/api/get-gold-balance \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-123"}'
```

期待される応答：
```json
{"balance": 0}
```

### テスト2：Stripe 決済フロー

1. ゲーム内で「ゴールド購入」ボタンをクリック
2. Stripe のテストカード（`4242 4242 4242 4242`）で決済
3. ゴールド残高が増えたか確認

---

## ⚠️ よくあるエラーと対処法

### エラー1：`Cannot find module 'stripe'`

**原因**：stripe パッケージがインストールされていない

**対処**：
```bash
npm install stripe
```

### エラー2：`STRIPE_SECRET_KEY is undefined`

**原因**：Vercel の環境変数が設定されていない

**対処**：Vercel ダッシュボード → Settings → Environment Variables を確認

### エラー3：Webhook が反応しない

**原因**：`STRIPE_WEBHOOK_SECRET` が設定されていない

**対処**：
- Stripe ダッシュボーム → Developers → Webhooks
- エンドポイント `https://your-domain.vercel.app/api/webhook` を追加
- Signing secret をコピーして Vercel に設定

---

## 📞 サポート

エラーが出た場合は、以下の情報を提供してください：

1. エラーメッセージの全文
2. どのステップで出たか
3. Vercel のログ（Deployments → Logs）

---

## ✅ 完了チェックリスト

- [ ] `/api` フォルダを作成
- [ ] 4つの API ファイルをコピー
- [ ] npm install stripe @supabase/supabase-js を実行
- [ ] GitHub にプッシュ
- [ ] Vercel でステータス「Ready」を確認
- [ ] テストで動作確認

すべて完了したら、「完了しました」と連絡してください！ 🎉
